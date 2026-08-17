import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { seedDB, nowISO, todayISO } from "./data";
import type { DB, InvoiceItem, Notif, Role, Staff, ViewId } from "./data";

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

interface StoreShape {
  db: DB;
  user: Staff | null;
  login: (staffId: string) => void;
  logout: () => void;
  mutate: (fn: (d: DB) => void, opts?: MutateOpts) => void;
  toast: (text: string, tone?: ToastMsg["tone"]) => void;
  toasts: ToastMsg[];
  dismissToast: (id: number) => void;
  nav: Nav;
  go: (view: ViewId, params?: Partial<Omit<Nav, "view">>) => void;
}

const Ctx = createContext<StoreShape>(null!);
export const useStore = () => useContext(Ctx);

const DB_KEY = "medicore-db-v3";
const USER_KEY = "medicore-user-v3";

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.v === 3) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return seedDB();
}

function loadUser(): Staff | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as Staff;
  } catch {
    /* ignore */
  }
  return null;
}

let toastSeq = 1;
let auditSeq = 100;
let notifSeq = 100;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [user, setUser] = useState<Staff | null>(loadUser);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [nav, setNav] = useState<Nav>({ view: "dashboard" });
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* storage full — demo continues in memory */
    }
  }, [db]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, [user]);

  const toast = useCallback((text: string, tone: ToastMsg["tone"] = "ok") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mutate = useCallback((fn: (d: DB) => void, opts?: MutateOpts) => {
    const u = userRef.current;
    setDb((prev) => {
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
      return next;
    });
  }, []);

  const login = useCallback(
    (staffId: string) => {
      const s = db.staff.find((x) => x.id === staffId);
      if (!s) return;
      setUser(s);
      const home: Record<Role, ViewId> = {
        admin: "dashboard", doctor: "patients", nurse: "wards", reception: "patients",
        lab: "lab", pharmacist: "pharmacy", billing: "billing",
      };
      setNav({ view: home[s.role] });
      toast(`Signed in as ${s.name} — ${s.dept}`, "ok");
    },
    [db.staff, toast]
  );

  const logout = useCallback(() => {
    setUser(null);
    setNav({ view: "dashboard" });
  }, []);

  const go = useCallback((view: ViewId, params?: Partial<Omit<Nav, "view">>) => {
    setNav({ view, ...params });
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(
    () => ({ db, user, login, logout, mutate, toast, toasts, dismissToast, nav, go }),
    [db, user, login, logout, mutate, toast, toasts, dismissToast, nav, go]
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
