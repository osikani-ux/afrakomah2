import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { emptyDB, nowISO, todayISO, ROLE_META } from "./data";
import type { DB, InvoiceItem, Notif, Role, Staff, ViewId } from "./data";
import {
  hasConfig, fetchCloud, cloudHasData, pushTables, pushAll,
  changedTables, deletedIds, purgeDeleted, TABLES,
  saveSbConfig, clearSbConfig, testConnection,
  authSignIn, authGetSession, authOnChange, authSignOut, adminCreateUser,
} from "./supabase";
import type { TableSpec, ConnTest, AuthUser, NewAccount } from "./supabase";

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

export interface SyncState {
  mode: "cloud" | "local";
  syncing: boolean;
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
}

interface MutateOpts {
  audit?: string;
  notify?: { text: string; icon: Notif["icon"]; roles: Role[] };
}

interface StoreShape {
  db: DB;
  user: Staff | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  mutate: (fn: (d: DB) => void, opts?: MutateOpts) => void;
  toast: (text: string, tone?: ToastMsg["tone"]) => void;
  toasts: ToastMsg[];
  dismissToast: (id: number) => void;
  nav: Nav;
  go: (view: ViewId, params?: Partial<Omit<Nav, "view">>) => void;
  booting: boolean;
  sync: SyncState;
  pullNow: () => Promise<void>;
  seedCloud: () => Promise<void>;
  connect: (url: string, key: string) => Promise<ConnTest>;
  disconnect: () => void;
  createAccount: (a: NewAccount) => Promise<{ error: string | null; needsConfirm: boolean }>;
}

const Ctx = createContext<StoreShape>(null!);
export const useStore = () => useContext(Ctx);

const DB_KEY = "medicore-db-v4";

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

/** Cloud rows win; empty cloud tables fall back to the local snapshot. */
function mergeCloud(local: DB, cloud: Partial<DB>): DB {
  const out: DB = structuredClone(local);
  (Object.keys(cloud) as (keyof DB)[]).forEach((k) => {
    const val = cloud[k];
    if (val === undefined || val === null) return;
    const empty = Array.isArray(val) ? val.length === 0 : Object.keys(val as object).length === 0;
    if (!empty) (out as unknown as Record<string, unknown>)[k] = val;
  });
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => window.setTimeout(() => rej(new Error("Connection timed out")), ms)),
  ]);
}

const HOME: Record<Role, ViewId> = {
  admin: "dashboard", doctor: "patients", nurse: "wards", reception: "patients",
  lab: "lab", pharmacist: "pharmacy", billing: "billing",
};

/** Resolves an authenticated identity to a staff record, provisioning
 *  one on first sign-in from the user's metadata. */
function resolveStaff(au: AuthUser, d: DB): { staff: Staff; isNew: boolean } {
  const existing = d.staff.find((s) => (s.email && s.email.toLowerCase() === au.email.toLowerCase()) || (au.staffId && s.id === au.staffId));
  if (existing) return { staff: existing, isNew: false };
  const staff: Staff = {
    id: au.staffId ?? `S-${au.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    name: au.name,
    role: au.role,
    dept: au.dept ?? ROLE_META[au.role].label,
    title: au.title ?? ROLE_META[au.role].label,
    phone: au.phone ?? "—",
    status: "on-duty",
    schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    active: true,
    email: au.email,
  };
  return { staff, isNew: true };
}

let toastSeq = 1;
let auditSeq = Date.now() % 100000;
let notifSeq = Date.now() % 100000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [user, setUser] = useState<Staff | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [nav, setNav] = useState<Nav>({ view: "dashboard" });
  const [booting, setBooting] = useState(true);
  const [sync, setSync] = useState<SyncState>({
    mode: hasConfig() ? "cloud" : "local",
    syncing: false, pending: 0, lastSyncAt: null, error: null,
  });

  const dbRef = useRef(db);
  const userRef = useRef(user);
  userRef.current = user;

  const syncTimer = useRef<number | null>(null);
  const pendingKeys = useRef<Set<keyof DB>>(new Set());
  const pendingDeletes = useRef<Map<string, Set<string>>>(new Map());

  /* ---------- boot: hydrate database, restore secure session ---------- */
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    // hard failsafe — the app must reach a usable screen no matter what
    const failsafe = window.setTimeout(() => setBooting(false), 12000);
    (async () => {
      if (hasConfig()) {
        const local = loadDB();
        try {
          const has = await withTimeout(cloudHasData(), 8000);
          if (!has) {
            // Fresh project — push this device's structure so every
            // workstation starts from the same live database.
            await withTimeout(pushAll(local), 20000);
            if (!cancelled) {
              dbRef.current = local;
              setDb(local);
            }
          } else {
            const cloud = await withTimeout(fetchCloud(), 15000);
            if (!cancelled && cloud) {
              const merged = mergeCloud(local, cloud);
              dbRef.current = merged;
              setDb(merged);
            }
          }
          if (!cancelled) setSync({ mode: "cloud", syncing: false, pending: 0, lastSyncAt: nowISO(), error: null });
        } catch (e) {
          if (!cancelled) setSync({ mode: "cloud", syncing: false, pending: 0, lastSyncAt: null, error: (e as Error).message });
        }

        // restore the signed-in session (Supabase keeps the token)
        try {
          const au = await withTimeout(authGetSession(), 8000);
          if (!cancelled && au) {
            const { staff, isNew } = resolveStaff(au, dbRef.current);
            if (!staff.active) {
              await authSignOut();
            } else {
              if (isNew) {
                dbRef.current = { ...dbRef.current, staff: [...dbRef.current.staff, staff] };
                setDb(dbRef.current);
                schedulePushRef.current?.(["staff"], dbRef.current, dbRef.current);
              }
              setUser(staff);
              setNav({ view: HOME[staff.role] });
            }
          }
        } catch {
          /* session restore is best-effort */
        }
        if (!cancelled) unsub = authOnChange((au) => {
          if (!au) {
            setUser(null);
            setNav({ view: "dashboard" });
          }
        });
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- local cache (offline fallback in every mode) ---------- */
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

  /* ---------- debounced cloud push ---------- */
  const schedulePush = useCallback((changed: (keyof DB)[], prev: DB, next: DB) => {
    if (!hasConfig()) return;
    changed.forEach((k) => pendingKeys.current.add(k));
    changed.forEach((k) => {
      const spec = TABLES.find((t) => t.key === k);
      if (!spec || spec.fullReplace) return;
      const ids = deletedIds(prev, next, spec as TableSpec);
      if (ids.length) {
        const set = pendingDeletes.current.get(spec.table) ?? new Set<string>();
        ids.forEach((id) => set.add(id));
        pendingDeletes.current.set(spec.table, set);
      }
    });
    setSync((s) => ({ ...s, syncing: true, pending: pendingKeys.current.size }));
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      const keys = [...pendingKeys.current];
      pendingKeys.current.clear();
      const snapshot = dbRef.current;
      const dels = [...pendingDeletes.current.entries()];
      pendingDeletes.current.clear();
      try {
        for (const [table, ids] of dels) {
          const spec = TABLES.find((t) => t.table === table);
          if (spec) await purgeDeleted(spec, [...ids]);
        }
        await pushTables(snapshot, keys);
        setSync((s) => ({ ...s, syncing: false, error: null, lastSyncAt: nowISO(), pending: pendingKeys.current.size }));
      } catch (e) {
        setSync((s) => ({ ...s, syncing: false, error: (e as Error).message, pending: 0 }));
      }
    }, 650);
  }, []);
  const schedulePushRef = useRef<typeof schedulePush | null>(null);
  schedulePushRef.current = schedulePush;

  const mutate = useCallback(
    (fn: (d: DB) => void, opts?: MutateOpts) => {
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
      const changed = changedTables(prev, next);
      if (changed.length) schedulePush(changed, prev, next);
    },
    [schedulePush]
  );

  /* ---------- authentication ---------- */
  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const res = await authSignIn(email, password);
      if (!res.ok) return res.error;
      const { staff, isNew } = resolveStaff(res.user, dbRef.current);
      if (!staff.active) {
        await authSignOut();
        return "This account has been deactivated by an administrator.";
      }
      if (isNew) {
        mutate((d) => {
          d.staff.push(staff);
          d.audit.unshift({
            id: `AU-${auditSeq++}`, at: nowISO(), user: staff.name, role: staff.role,
            action: `Signed in — staff account provisioned from Supabase Auth (${staff.email})`,
          });
        });
      } else {
        mutate(() => {}, { audit: `Signed in to the ${ROLE_META[staff.role].label} workspace` });
      }
      setUser(staff);
      setNav({ view: HOME[staff.role] });
      toast(`Welcome, ${staff.name} — ${ROLE_META[staff.role].label} workspace`, "ok");
      return null;
    },
    [mutate, toast]
  );

  const signOut = useCallback(async () => {
    mutate(() => {}, { audit: "Signed out" });
    await authSignOut();
    setUser(null);
    setNav({ view: "dashboard" });
  }, [mutate]);

  const go = useCallback((view: ViewId, params?: Partial<Omit<Nav, "view">>) => {
    setNav({ view, ...params });
    window.scrollTo({ top: 0 });
  }, []);

  /* ---------- manual cloud operations (Settings) ---------- */
  const pullNow = useCallback(async () => {
    if (!hasConfig()) {
      toast("No Supabase connection — paste your project URL in Settings → Database", "info");
      return;
    }
    setSync((s) => ({ ...s, syncing: true, error: null }));
    try {
      const cloud = await withTimeout(fetchCloud(), 15000);
      if (cloud) {
        const merged = mergeCloud(dbRef.current, cloud);
        dbRef.current = merged;
        setDb(merged);
      }
      setSync((s) => ({ ...s, syncing: false, lastSyncAt: nowISO() }));
      toast("Pulled latest records from Supabase", "ok");
    } catch (e) {
      setSync((s) => ({ ...s, syncing: false, error: (e as Error).message }));
      toast(`Pull failed — ${(e as Error).message}`, "danger");
    }
  }, [toast]);

  const seedCloud = useCallback(async () => {
    if (!hasConfig()) {
      toast("No Supabase connection — paste your project URL in Settings → Database", "warn");
      return;
    }
    setSync((s) => ({ ...s, syncing: true, error: null }));
    try {
      await withTimeout(pushAll(dbRef.current), 25000);
      setSync((s) => ({ ...s, syncing: false, lastSyncAt: nowISO() }));
      toast("Cloud database updated — all tables pushed to Supabase", "ok");
      mutate(() => {}, { audit: "Pushed full database to Supabase cloud" });
    } catch (e) {
      setSync((s) => ({ ...s, syncing: false, error: (e as Error).message }));
      toast(`Push failed — ${(e as Error).message}`, "danger");
    }
  }, [toast, mutate]);

  /* ---------- runtime connection (Settings → Database) ---------- */
  const connect = useCallback(
    async (url: string, key: string): Promise<ConnTest> => {
      let res: ConnTest;
      try {
        res = await withTimeout(testConnection(url, key), 9000);
      } catch (e) {
        res = { ok: false, empty: false, error: (e as Error).message, hint: "The project URL could not be reached." };
      }
      if (!res.ok) return res;
      saveSbConfig(url, key);
      setSync({ mode: "cloud", syncing: true, pending: 0, lastSyncAt: null, error: null });
      try {
        const local = dbRef.current;
        if (res.empty) {
          await withTimeout(pushAll(local), 25000);
          toast("Connected — this device's records seeded the fresh project", "ok");
          mutate(() => {}, { audit: "Connected Supabase project and seeded cloud database" });
        } else {
          const cloud = await withTimeout(fetchCloud(), 15000);
          if (cloud) {
            const merged = mergeCloud(local, cloud);
            dbRef.current = merged;
            setDb(merged);
          }
          toast("Connected — live records merged from Supabase", "ok");
          mutate(() => {}, { audit: "Connected Supabase project (cloud-first merge)" });
        }
        setSync({ mode: "cloud", syncing: false, pending: 0, lastSyncAt: nowISO(), error: null });
      } catch (e) {
        setSync((s) => ({ ...s, syncing: false, error: (e as Error).message }));
        toast(`Connected, but first sync failed — ${(e as Error).message}`, "warn");
      }
      return res;
    },
    [toast, mutate]
  );

  const disconnect = useCallback(() => {
    clearSbConfig();
    setSync({ mode: "local", syncing: false, pending: 0, lastSyncAt: null, error: null });
    toast("Disconnected — running on this device's data", "info");
  }, [toast]);

  /* ---------- account provisioning (admin → other departments) ---------- */
  const createAccount = useCallback(
    async (a: NewAccount): Promise<{ error: string | null; needsConfirm: boolean }> => {
      const res = await adminCreateUser(a);
      if (!res.ok) return { error: res.error, needsConfirm: false };
      mutate(
        (d) => {
          const id = a.staffId ?? nid("S", d.staff.map((s) => s.id));
          const exists = d.staff.some((s) => s.email?.toLowerCase() === a.email.trim().toLowerCase());
          if (!exists) {
            d.staff.push({
              id, name: a.name.trim(), role: a.role,
              dept: a.dept ?? ROLE_META[a.role].label,
              title: a.title ?? ROLE_META[a.role].label,
              phone: a.phone ?? "—",
              status: "off-duty",
              schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"],
              active: true,
              email: a.email.trim(),
            });
          }
        },
        {
          audit: `Provisioned ${ROLE_META[a.role].label} account for ${a.name} (${a.email})`,
          notify: { text: `New account created: ${a.name} — ${ROLE_META[a.role].label}`, icon: "alert", roles: ["admin"] },
        }
      );
      return { error: null, needsConfirm: res.needsConfirm };
    },
    [mutate]
  );

  const value = useMemo(
    () => ({ db, user, signIn, signOut, mutate, toast, toasts, dismissToast, nav, go, booting, sync, pullNow, seedCloud, connect, disconnect, createAccount }),
    [db, user, signIn, signOut, mutate, toast, toasts, dismissToast, nav, go, booting, sync, pullNow, seedCloud, connect, disconnect, createAccount]
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
