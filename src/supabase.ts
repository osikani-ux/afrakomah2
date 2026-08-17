/* ============================================================
   MediCore HMS — Supabase connection layer

   Configure via environment variables (see .env.example):
     VITE_SUPABASE_URL        https://xxxx.supabase.co
     VITE_SUPABASE_ANON_KEY   <your anon/public key>

   Run supabase/schema.sql in the Supabase SQL editor first.
   When the variables are missing the app boots in local mode
   (localStorage) and everything keeps working offline.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./data";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

export const isSupabaseConfigured = url.startsWith("http") && anonKey.length > 20;
export const supabaseUrl = url;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null;

export function maskedUrl(u: string) {
  try {
    const host = new URL(u).host;
    const ref = host.split(".")[0];
    return `${ref.slice(0, 4)}••••${ref.slice(-3)}.${host.split(".").slice(1).join(".")}`;
  } catch {
    return u;
  }
}

/* ---------------- table map: DB key -> Postgres table ---------------- */

export interface TableSpec {
  key: keyof DB;
  table: string;
  pk: string;
  /** Replace the whole table instead of row-diff upsert (keyless rows). */
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
  { key: "queues", table: "queues", pk: "key", fullReplace: true },
  { key: "vitalsLog", table: "vitals_log", pk: "id", fullReplace: true },
];

/** Keys of DB that map to rows with a primary key. */
type RowKey = Exclude<keyof DB, "v" | "trends" | "queues" | "vitalsLog">;

function rowsOf(db: DB, key: keyof DB): Record<string, unknown>[] {
  if (key === "queues") {
    return Object.entries(db.queues).map(([k, q]) => ({ key: k, seq: q.seq, serving: q.serving ?? null, waiting: q.waiting }));
  }
  if (key === "vitalsLog") {
    return db.vitalsLog.map((e, i) => ({ id: `${e.patientMrn}-${i}`, patientMrn: e.patientMrn, v: e.v }));
  }
  return db[key] as unknown as Record<string, unknown>[];
}

/* ---------------- load everything from the cloud ---------------- */

export async function fetchCloud(): Promise<Partial<DB> | null> {
  if (!supabase) return null;
  const selects = TABLES.map((t) => supabase!.from(t.table).select("*"));
  const results = await Promise.all(selects);
  for (const r of results) if (r.error) throw new Error(r.error.message);

  const out: Partial<DB> = {};
  TABLES.forEach((t, i) => {
    const rows = (results[i].data ?? []) as Record<string, unknown>[];
    if (t.key === "queues") {
      const queues: DB["queues"] = {};
      rows.forEach((r) => {
        queues[String(r.key)] = { seq: Number(r.seq ?? 0), serving: r.serving == null ? null : String(r.serving), waiting: (r.waiting as string[]) ?? [] };
      });
      if (Object.keys(queues).length) out.queues = queues;
    } else if (t.key === "vitalsLog") {
      out.vitalsLog = rows
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((r) => ({ patientMrn: String(r.patientMrn), v: r.v as DB["vitalsLog"][number]["v"] }));
    } else {
      (out as Record<string, unknown>)[t.key] = rows;
    }
  });

  // trends singleton
  const meta = await supabase.from("app_meta").select("*").eq("id", "trends").maybeSingle();
  if (!meta.error && meta.data) {
    out.trends = {
      registrations: meta.data.registrations ?? [],
      revenue: meta.data.revenue ?? [],
      labels: meta.data.labels ?? [],
    };
  }
  return out;
}

/** True when the cloud database already holds data (any patients). */
export async function cloudHasData(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from("patients").select("mrn", { count: "exact", head: true });
  return !error && (data?.length ?? 0) > 0;
}

/* ---------------- push changed tables ---------------- */

export async function pushTables(db: DB, changedKeys: (keyof DB)[]) {
  if (!supabase) return;
  for (const key of changedKeys) {
    if (key === "trends") {
      await pushTrends(db);
      continue;
    }
    const spec = TABLES.find((t) => t.key === key);
    if (!spec) continue;
    const rows = rowsOf(db, key);
    if (spec.fullReplace) {
      const del = await supabase.from(spec.table).delete().neq(spec.pk, "");
      if (del.error) throw new Error(del.error.message);
      if (rows.length) {
        const ins = await supabase.from(spec.table).insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
    } else {
      const up = await supabase.from(spec.table).upsert(rows, { onConflict: spec.pk, ignoreDuplicates: false });
      if (up.error) throw new Error(up.error.message);
    }
  }
}

export async function pushTrends(db: DB) {
  if (!supabase) return;
  const up = await supabase.from("app_meta").upsert({ id: "trends", ...db.trends }, { onConflict: "id" });
  if (up.error) throw new Error(up.error.message);
}

/** Push the entire database (used by "reseed cloud"). */
export async function pushAll(db: DB) {
  if (!supabase) return;
  await pushTables(db, [...TABLES.map((t) => t.key), "trends"] as (keyof DB)[]);
}

/** Row-diff helper: which table keys differ between two DB snapshots? */
export function changedTables(prev: DB, next: DB): (keyof DB)[] {
  const keys: (keyof DB)[] = [...TABLES.map((t) => t.key), "trends"];
  return keys.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}

/** Deleted primary keys per table (for remote cleanup). */
export function deletedIds(prev: DB, next: DB, spec: TableSpec): string[] {
  if (spec.fullReplace) return [];
  const before = new Set((prev[spec.key as RowKey] as { id?: string; mrn?: string }[]).map((r) => String(spec.pk === "mrn" ? r.mrn : r.id)));
  const after = new Set((next[spec.key as RowKey] as { id?: string; mrn?: string }[]).map((r) => String(spec.pk === "mrn" ? r.mrn : r.id)));
  return [...before].filter((id) => !after.has(id));
}

export async function purgeDeleted(spec: TableSpec, ids: string[]) {
  if (!supabase || ids.length === 0) return;
  const res = await supabase.from(spec.table).delete().in(spec.pk, ids);
  if (res.error) throw new Error(res.error.message);
}
