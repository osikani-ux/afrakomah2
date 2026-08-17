import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { seedDB, nowISO, todayISO } from "./data";
import type { DB, InvoiceItem, Notif, Role, Staff, ViewId } from "./data";
import {
  hasConfig, fetchCloud, cloudHasData, pushTables, pushAll,
  changedTables, deletedIds, purgeDeleted, TABLES,
  saveSbConfig, clearSbConfig, testConnection,
} from "./supabase";
import type { TableSpec, ConnTest } from "./supabase";

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
  login: (staffId: string) => void;
  logout: () => void;
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

let toastSeq = 1;
let auditSeq = 100;
let notifSeq = 100;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [user, setUser] = useState<Staff | null>(loadUser);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [nav, setNav] = useState<Nav>({ view: "dashboard" });
  const [booting, setBooting] = useState(() => hasConfig());
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

  /* ---------- boot: hydrate from Supabase when configured ---------- */
  useEffect(() => {
    if (!hasConfig()) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const local = loadDB();
      try {
        const has = await withTimeout(cloudHasData(), 8000);
        if (!has) {
          // Fresh project — push this device's dataset so every
          // workstation starts from the same live database.
          await withTimeout(pushAll(local), 20000);
          if (cancelled) return;
          setDb(local);
        } else {
          const cloud = await withTimeout(fetchCloud(), 15000);
          if (cancelled) return;
          if (cloud) setDb(mergeCloud(local, cloud));
        }
        setSync({ mode: "cloud", syncing: false, pending: 0, lastSyncAt: nowISO(), error: null });
      } catch (e) {
        if (cancelled) return;
        setSync({ mode: "cloud", syncing: false, pending: 0, lastSyncAt: null, error: (e as Error).message });
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- local cache (offline fallback in every mode) ---------- */
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

  /* ---------- debounced cloud push ---------- */
  const schedulePush = useCallback((changed: (keyof DB)[], prev: DB, next: DB) => {
    if (!hasConfig()) return;
    changed.forEach((k) => pendingKeys.current.add(k));
    // collect deleted primary keys for keyed tables
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

  const login = useCallback(
    (staffId: string) => {
      const s = dbRef.current.staff.find((x) => x.id === staffId);
      if (!s) return;
      setUser(s);
      const home: Record<Role, ViewId> = {
        admin: "dashboard", doctor: "patients", nurse: "wards", reception: "patients",
        lab: "lab", pharmacist: "pharmacy", billing: "billing",
      };
      setNav({ view: home[s.role] });
      toast(`Signed in as ${s.name} — ${s.dept}`, "ok");
    },
    [toast]
  );

  const logout = useCallback(() => {
    setUser(null);
    setNav({ view: "dashboard" });
  }, []);

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
      toast("Cloud database seeded — all tables pushed to Supabase", "ok");
      mutate(() => {}, { audit: "Seeded Supabase cloud database from this device" });
    } catch (e) {
      setSync((s) => ({ ...s, syncing: false, error: (e as Error).message }));
      toast(`Seed failed — ${(e as Error).message}`, "danger");
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
          toast("Connected — this device's dataset seeded the fresh project", "ok");
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

  const value = useMemo(
    () => ({ db, user, login, logout, mutate, toast, toasts, dismissToast, nav, go, booting, sync, pullNow, seedCloud, connect, disconnect }),
    [db, user, login, logout, mutate, toast, toasts, dismissToast, nav, go, booting, sync, pullNow, seedCloud, connect, disconnect]
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
