/* ============================================================
   MediCore HMS — Supabase connection layer
   ------------------------------------------------------------
   Config resolution (first match wins):
     1. .env → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
     2. Runtime config saved from Settings → Database
        (localStorage "medicore-sb-cfg")
   The project's publishable key ships with the build; the
   project URL is pasted once in the UI or set in .env.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seedDB } from "./data";
import type { DB } from "./data";

const CFG_KEY = "medicore-sb-cfg";

/** Publishable key for this deployment (safe client-side — RLS guards the data). */
export const BUILTIN_KEY = "sb_publishable_-ZsHlt4CAE7VMDTGeAr3uQ_SXfRVB2_";

export interface SbConfig {
  url: string;
  key: string;
}

function readCfg(): SbConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const c = JSON.parse(raw) as SbConfig;
      if (c && c.url) return c;
    }
  } catch {
    /* corrupt config — ignore */
  }
  return null;
}

function normalizeUrl(u: string): string {
  const t = u.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
}

export function getConfig(): SbConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) return { url: normalizeUrl(envUrl), key: envKey };
  return readCfg();
}

export const hasConfig = (): boolean => {
  const c = getConfig();
  return !!c && !!c.url && !!c.key;
};
export const configuredUrl = (): string => getConfig()?.url ?? "";
export const configuredKey = (): string => getConfig()?.key ?? BUILTIN_KEY;

export function saveSbConfig(url: string, key: string): void {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: normalizeUrl(url), key: key.trim() || BUILTIN_KEY }));
  client = null; // force a fresh client on next call
}

export function clearSbConfig(): void {
  localStorage.removeItem(CFG_KEY);
  client = null;
}

export function maskedUrl(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.length > 20 ? `${h.slice(0, 8)}…${h.slice(-10)}` : h;
  } catch {
    return url;
  }
}

/* ---------------- lazy client ---------------- */

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  const cfg = getConfig();
  if (!cfg || !cfg.url || !cfg.key) return null;
  if (!client) {
    client = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function need(): SupabaseClient {
  const sb = getClient();
  if (!sb) throw new Error("Not connected to Supabase");
  return sb;
}

/* ---------------- connection test ---------------- */

export interface ConnTest {
  ok: boolean;
  /** project reachable and schema present, but no rows yet */
  empty: boolean;
  error?: string;
  hint?: string;
}

export async function testConnection(url: string, key: string): Promise<ConnTest> {
  let c: SupabaseClient;
  try {
    c = createClient(normalizeUrl(url), key.trim() || BUILTIN_KEY, { auth: { persistSession: false } });
  } catch {
    return { ok: false, empty: false, error: "Invalid project URL", hint: "Use the Project URL from Supabase → Project Settings → API." };
  }
  try {
    const { count, error } = await c.from("app_meta").select("id", { count: "exact", head: true });
    if (error) {
      const missing = /does not exist|42P01|schema cache/i.test(error.message ?? "");
      return {
        ok: false, empty: false,
        error: missing ? "Tables not found in this project" : error.message ?? "Connection failed",
        hint: missing ? "Run supabase/schema.sql in the Supabase SQL editor, then try again." : "Check the URL and publishable key.",
      };
    }
    return { ok: true, empty: (count ?? 0) === 0 };
  } catch (e) {
    return { ok: false, empty: false, error: (e as Error).message, hint: "The project URL could not be reached." };
  }
}

/* ---------------- table map (entity key → Postgres table) ---------------- */

export interface TableSpec {
  key: keyof DB;
  table: string;
  pk: string;
  fullReplace?: boolean;
}

export const TABLES: TableSpec[] = [
  { key: "patients", table: "patients", pk: "mrn" },
  { key: "staff", table: "staff", pk: "id" },
  { key: "appointments", table: "appointments", pk: "id" },
  { key: "consultations", table: "consultations", pk: "id" },
  { key: "labOrders", table: "lab_orders", pk: "id" },
  { key: "rxOrders", table: "rx_orders", pk: "id" },
  { key: "medicines", table: "medicines", pk: "id" },
  { key: "inventory", table: "inventory", pk: "id" },
  { key: "invoices", table: "invoices", pk: "id" },
  { key: "beds", table: "beds", pk: "id" },
  { key: "admissions", table: "admissions", pk: "id" },
  { key: "emergencies", table: "emergencies", pk: "id" },
  { key: "claims", table: "claims", pk: "id" },
  { key: "notifications", table: "notifications", pk: "id" },
  { key: "audit", table: "audit_log", pk: "id" },
  { key: "queues", table: "queues", pk: "key" },
  { key: "vitalsLog", table: "vitals_log", pk: "id" },
];

function dbTable(db: DB, key: keyof DB): Record<string, unknown>[] {
  if (key === "vitalsLog") {
    return db.vitalsLog.map((row, i) => ({ id: `V-${i + 1}`, patientMrn: row.patientMrn, v: row.v }));
  }
  if (key === "queues") {
    return Object.entries(db.queues).map(([k, q]) => ({ key: k, seq: q.seq, serving: q.serving ?? null, waiting: q.waiting }));
  }
  return db[key] as unknown as Record<string, unknown>[];
}

/* ---------------- diff helpers ---------------- */

export function changedTables(prev: DB, next: DB): (keyof DB)[] {
  const all: (keyof DB)[] = [...TABLES.map((t) => t.key), "trends"];
  return all.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}

export function deletedIds(prev: DB, next: DB, spec: TableSpec): string[] {
  const before = new Set(dbTable(prev, spec.key).map((r) => String(r[spec.pk])));
  const after = new Set(dbTable(next, spec.key).map((r) => String(r[spec.pk])));
  return [...before].filter((id) => !after.has(id));
}

/* ---------------- cloud operations ---------------- */

export async function fetchCloud(): Promise<Partial<DB> | null> {
  const sb = need();
  const out: Partial<DB> = {};
  for (const t of TABLES) {
    const { data, error } = await sb.from(t.table).select("*");
    if (error) throw new Error(`${t.table}: ${error.message}`);
    if (t.key === "queues") {
      const queues: Record<string, { seq: number; serving: string | null; waiting: string[] }> = {};
      (data as Record<string, unknown>[]).forEach((row) => {
        const k = String(row.key);
        queues[k] = { seq: Number(row.seq ?? 0), serving: row.serving == null ? null : String(row.serving), waiting: (row.waiting as string[]) ?? [] };
      });
      if (Object.keys(queues).length) out.queues = queues as DB["queues"];
    } else if (t.key === "vitalsLog") {
      out.vitalsLog = (data as Record<string, unknown>[]).map((row) => ({ patientMrn: String(row.patientMrn), v: row.v as DB["vitalsLog"][number]["v"] }));
    } else {
      (out as Record<string, unknown>)[t.key] = data;
    }
  }
  const meta = await sb.from("app_meta").select("*").limit(1);
  if (!meta.error && meta.data && meta.data.length) {
    const m = meta.data[0] as Record<string, unknown>;
    if (m.registrations && m.revenue) {
      out.trends = {
        registrations: m.registrations as number[],
        revenue: m.revenue as number[],
        labels: (m.labels as string[]) ?? [],
      };
    }
  }
  return out;
}

export async function cloudHasData(): Promise<boolean> {
  const sb = need();
  const { data, error } = await sb.from("app_meta").select("id", { count: "exact", head: true });
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function pushTables(db: DB, keys: (keyof DB)[]): Promise<void> {
  const sb = need();
  for (const key of keys) {
    if (key === "trends") {
      const { error } = await sb.from("app_meta").upsert(
        { id: "global", registrations: db.trends.registrations, revenue: db.trends.revenue, labels: db.trends.labels },
        { onConflict: "id" }
      );
      if (error) throw new Error(`app_meta: ${error.message}`);
      continue;
    }
    const spec = TABLES.find((t) => t.key === key);
    if (!spec) continue;
    const rows = dbTable(db, key);
    if (!rows.length) continue;
    const { error } = await sb.from(spec.table).upsert(rows, { onConflict: spec.pk });
    if (error) throw new Error(`${spec.table}: ${error.message}`);
  }
}

export async function purgeDeleted(spec: TableSpec, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sb = need();
  const { error } = await sb.from(spec.table).delete().in(spec.pk, ids);
  if (error) throw new Error(`${spec.table}: ${error.message}`);
}

export async function pushAll(db: DB): Promise<void> {
  // parents before children so foreign keys resolve on a fresh project
  const order: (keyof DB)[] = [
    "patients", "staff", "beds", "invoices",
    "appointments", "consultations", "labOrders", "rxOrders", "admissions", "emergencies", "claims", "vitalsLog",
    "medicines", "inventory", "notifications", "audit", "queues", "trends",
  ];
  await pushTables(db, order);
}

export const demoDB = seedDB;
