import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { emptyDB, nowISO, todayISO, ROLE_META } from "./data";
import type { DB, InvoiceItem, Notif, Role, Staff, ViewId } from "./data";

/* ============================================================
   MediCore HMS — local store
   Everything lives on this device (localStorage). No network,
   no external database, no auth service: sign-in is role-based
   and the roster of staff accounts is managed in Settings.
   ============================================================ */

export interface Nav {
  view: ViewId;
  patient?: string;
  tab?: string;
}

export interface ToastMsg {
  id: number;
  text: string;
  tone: "ok" | "warn" | "danger" | "info";
}

interface MutateOpts {
  audit?: string;
  notify?: { text: string; icon: Notif["icon"]; roles: Role[] };
}

export interface NewAccount {
  name: string;
  role: Role;
  dept?: string;
  title?: string;
  phone?: string;
  staffId?: string;
}

interface StoreShape {
  db: DB;
  user: Staff | null;
  login: (name: string, role: Role, existingId?: string) => void;
  logout: () => void;
  mutate: (fn: (d: DB) => void, opts?: MutateOpts) => void;
  createAccount: (a: NewAccount) => void;
  toast: (text: string, tone?: ToastMsg["tone"]) => void;
  toasts: ToastMsg[];
  dismissToast: (id: number) => void;
  nav: Nav;
  go: (view: ViewId, params?: Partial<Omit<Nav, "view">>) => void;
}

const Ctx = createContext<StoreShape>(null!);
export const useStore = () => useContext(Ctx);

const DB_KEY = "medicore-db-v4";
const USER_KEY = "medicore-user-v4";

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.v === 4) return parsed;
    }
  } catch {
    /* fall through to a fresh database */
  }
  return emptyDB();
}

const HOME: Record<Role, ViewId> = {
  admin: "dashboard", doctor: "patients", nurse: "wards", reception: "patients",
  lab: "lab", pharmacist: "pharmacy", billing: "billing",
};

let toastSeq = 1;
let auditSeq = Date.now() % 100000;
let notifSeq = Date.now() % 100000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [user, setUser] = useState<Staff | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [nav, setNav] = useState<Nav>({ view: "dashboard" });

  const dbRef = useRef(db);
  const userRef = useRef(user);
  userRef.current = user;

  /* restore the signed-in workstation on load */
  useEffect(() => {
    try {
      const id = localStorage.getItem(USER_KEY);
      if (!id) return;
      const s = dbRef.current.staff.find((x) => x.id === id);
      if (s && s.active) {
        setUser(s);
        setNav({ view: HOME[s.role] });
      }
    } catch {
      /* no stored session */
    }
  }, []);

  /* persist the working copy */
  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* storage full — work continues in memory */
    }
  }, [db]);

  const toast = useCallback((text: string, tone: ToastMsg["tone"] = "ok") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mutate = useCallback((fn: (d: DB) => void, opts?: MutateOpts) => {
    const u = userRef.current;
    const prev = dbRef.current;
    const next = structuredClone(prev);
    fn(next);
    if (opts?.audit && u) {
      next.audit.unshift({ id: `AU-${auditSeq++}`, at: nowISO(), user: u.name, role: u.role, action: opts.audit });
      next.audit = next.audit.slice(0, 120);
    }
    if (opts?.notify) {
      next.notifications.unshift({
        id: `N-${notifSeq++}`, at: nowISO(), icon: opts.notify.icon,
        text: opts.notify.text, read: false, roles: opts.notify.roles,
      });
      next.notifications = next.notifications.slice(0, 60);
    }
    dbRef.current = next;
    setDb(next);
  }, []);

  /* ---------- local sign-in (role-based, on-device) ---------- */
  const login = useCallback(
    (name: string, role: Role, existingId?: string) => {
      let staff: Staff | undefined;
      if (existingId) {
        staff = dbRef.current.staff.find((s) => s.id === existingId);
      }
      const isNew = !staff;
      if (!staff) {
        const id = nid("S", dbRef.current.staff.map((s) => s.id));
        staff = {
          id,
          name: name.trim(),
          role,
          dept: ROLE_META[role].label,
          title: ROLE_META[role].label,
          phone: "—",
          status: "on-duty",
          schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          active: true,
        };
        mutate((d) => {
          d.staff.push(staff!);
        });
      } else if (staff.status !== "on-duty") {
        mutate((d) => {
          const s = d.staff.find((x) => x.id === staff!.id)!;
          s.status = "on-duty";
        });
      }
      mutate(() => {}, { audit: `${staff!.name} signed in to the ${ROLE_META[role].label} workspace${isNew ? " (account created)" : ""}` });
      setUser({ ...staff!, status: "on-duty" });
      try {
        localStorage.setItem(USER_KEY, staff!.id);
      } catch {
        /* session not persisted */
      }
      setNav({ view: HOME[role] });
      toast(`Welcome, ${staff!.name} — ${ROLE_META[role].label} workspace`, "ok");
    },
    [mutate, toast]
  );

  const logout = useCallback(() => {
    mutate(() => {}, { audit: `${userRef.current?.name ?? "Staff"} signed out` });
    setUser(null);
    setNav({ view: "dashboard" });
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, [mutate]);

  /* ---------- staff account provisioning (Settings) ---------- */
  const createAccount = useCallback(
    (a: NewAccount) => {
      mutate(
        (d) => {
          const id = a.staffId ?? nid("S", d.staff.map((s) => s.id));
          const exists = d.staff.some((s) => s.id === id);
          if (!exists) {
            d.staff.push({
              id,
              name: a.name.trim(),
              role: a.role,
              dept: a.dept ?? ROLE_META[a.role].label,
              title: a.title ?? ROLE_META[a.role].label,
              phone: a.phone ?? "—",
              status: "off-duty",
              schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"],
              active: true,
            });
          }
        },
        {
          audit: `Created ${ROLE_META[a.role].label} account for ${a.name}`,
          notify: { text: `New staff account: ${a.name} — ${ROLE_META[a.role].label}`, icon: "alert", roles: ["admin"] },
        }
      );
      toast(`${a.name} added as ${ROLE_META[a.role].label}`, "ok");
    },
    [mutate, toast]
  );

  const go = useCallback((view: ViewId, params?: Partial<Omit<Nav, "view">>) => {
    setNav({ view, ...params });
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(
    () => ({ db, user, login, logout, mutate, createAccount, toast, toasts, dismissToast, nav, go }),
    [db, user, login, logout, mutate, createAccount, toast, toasts, dismissToast, nav, go]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- shared domain helpers ---------------- */

export function nid(prefix: string, ids: string[]) {
  const max = ids.reduce((m, id) => {
    const n = parseInt(id.split("-").pop() || "0", 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}-${max + 1}`;
}

/** Adds a line item to the patient's open invoice today (creates one if needed). */
export function charge(d: DB, mrn: string, item: InvoiceItem) {
  let inv = d.invoices.find((i) => i.patientMrn === mrn && i.status !== "paid" && i.date === todayISO());
  if (!inv) {
    inv = { id: nid("INV", d.invoices.map((i) => i.id)), patientMrn: mrn, date: todayISO(), items: [], paid: 0, status: "unpaid" };
    d.invoices.unshift(inv);
  }
  inv.items.push(item);
}

export const invTotal = (items: InvoiceItem[]) => items.reduce((s, i) => s + i.amount, 0);
export const invBalance = (inv: { items: InvoiceItem[]; paid: number }) =>
  Math.max(0, invTotal(inv.items) - inv.paid);

export const invoiceStatus = (inv: { items: InvoiceItem[]; paid: number }): "unpaid" | "partial" | "paid" => {
  const t = invTotal(inv.items);
  if (inv.paid <= 0) return "unpaid";
  return inv.paid >= t - 0.001 ? "paid" : "partial";
};
