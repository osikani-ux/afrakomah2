-- ============================================================
-- MediCore HMS — Supabase schema
-- Run this whole file in the Supabase SQL editor (Dashboard →
-- SQL Editor → New query). It is idempotent (safe to re-run).
--
-- The front-end stores nested structures (vitals, results,
-- prescription items, notes…) as jsonb so the app and the
-- database share one shape with zero mapping code.
-- ============================================================

create table if not exists patients (
  "mrn"           text primary key,
  "nationalId"    text not null,
  "name"          text not null,
  "dob"           date,
  "gender"        text,
  "phone"         text,
  "address"       text,
  "bloodGroup"    text,
  "allergies"     jsonb not null default '[]',
  "insurance"     jsonb,
  "nextOfKin"     jsonb not null default '{}',
  "history"       jsonb not null default '[]',
  "medications"   jsonb not null default '[]',
  "registeredAt"  timestamptz,
  "status"        text not null default 'outpatient'
);

create table if not exists staff (
  "id"        text primary key,
  "name"      text not null,
  "role"      text not null,
  "dept"      text,
  "title"     text,
  "phone"     text,
  "status"    text not null default 'off-duty',
  "room"      text,
  "specialty" text,
  "schedule"  jsonb not null default '[]',
  "active"    boolean not null default true
);

create table if not exists appointments (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "doctorId"   text references staff("id") on delete cascade,
  "dept"       text,
  "date"       date,
  "time"       text,
  "type"       text,
  "reason"     text,
  "status"     text not null default 'scheduled',
  "queueNo"    text
);

create table if not exists consultations (
  "id"          text primary key,
  "patientMrn"  text references patients("mrn") on delete cascade,
  "doctorId"    text references staff("id") on delete cascade,
  "date"        timestamptz,
  "complaint"   text,
  "symptoms"    jsonb not null default '[]',
  "vitals"      jsonb not null default '{}',
  "examination" text,
  "diagnosis"   text,
  "treatment"   text,
  "notes"       text,
  "followUp"    date,
  "rxId"        text,
  "labIds"      jsonb not null default '[]'
);

create table if not exists lab_orders (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "doctorId"   text references staff("id") on delete cascade,
  "test"       text not null,
  "priority"   text not null default 'routine',
  "orderedAt"  timestamptz,
  "status"     text not null default 'ordered',
  "price"      numeric not null default 0,
  "results"    jsonb,
  "verifiedBy" text,
  "verifiedAt" timestamptz,
  "note"       text
);

create table if not exists rx_orders (
  "id"           text primary key,
  "patientMrn"   text references patients("mrn") on delete cascade,
  "doctorId"     text references staff("id") on delete cascade,
  "date"         timestamptz,
  "status"       text not null default 'pending',
  "items"        jsonb not null default '[]',
  "dispensedBy"  text,
  "dispensedAt"  timestamptz
);

create table if not exists medicines (
  "id"           text primary key,
  "name"         text not null,
  "category"     text,
  "batch"        text,
  "supplier"     text,
  "stock"        integer not null default 0,
  "unit"         text,
  "buyPrice"     numeric not null default 0,
  "sellPrice"    numeric not null default 0,
  "expiry"       date,
  "location"     text,
  "reorderLevel" integer not null default 0
);

create table if not exists inventory (
  "id"            text primary key,
  "name"          text not null,
  "category"      text,
  "stock"         integer not null default 0,
  "unit"          text,
  "reorderLevel"  integer not null default 0,
  "location"      text,
  "lastRestocked" date
);

create table if not exists invoices (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "date"       date,
  "items"      jsonb not null default '[]',
  "paid"       numeric not null default 0,
  "method"     text,
  "status"     text not null default 'unpaid'
);

create table if not exists beds (
  "id"         text primary key,
  "ward"       text not null,
  "status"     text not null default 'available',
  "patientMrn" text references patients("mrn") on delete set null
);

create table if not exists admissions (
  "id"             text primary key,
  "patientMrn"     text references patients("mrn") on delete cascade,
  "bedId"          text references beds("id") on delete cascade,
  "doctorId"       text references staff("id") on delete cascade,
  "date"           timestamptz,
  "diagnosis"      text,
  "status"         text not null default 'active',
  "dischargeDate"  timestamptz,
  "dailyCharge"    numeric not null default 0,
  "notes"          jsonb not null default '[]'
);

create table if not exists emergencies (
  "id"          text primary key,
  "patientMrn"  text references patients("mrn") on delete cascade,
  "arrival"     timestamptz,
  "triage"      text not null default 'stable',
  "symptoms"    text,
  "vitals"      jsonb,
  "doctorId"    text references staff("id") on delete set null,
  "status"      text not null default 'waiting',
  "disposition" text
);

create table if not exists claims (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "provider"   text,
  "invoiceId"  text references invoices("id") on delete cascade,
  "amount"     numeric not null default 0,
  "date"       date,
  "status"     text not null default 'pending'
);

create table if not exists notifications (
  "id"    text primary key,
  "at"    timestamptz not null default now(),
  "icon"  text not null default 'appt',
  "text"  text not null,
  "read"  boolean not null default false,
  "roles" jsonb not null default '[]'
);

create table if not exists audit_log (
  "id"     text primary key,
  "at"     timestamptz not null default now(),
  "user"   text not null,
  "role"   text,
  "action" text not null
);

create table if not exists queues (
  "key"     text primary key,
  "seq"     integer not null default 0,
  "serving" text,
  "waiting" jsonb not null default '[]'
);

create table if not exists vitals_log (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "v"          jsonb not null default '{}'
);

create table if not exists app_meta (
  "id"            text primary key,
  "registrations" jsonb not null default '[]',
  "revenue"       jsonb not null default '[]',
  "labels"        jsonb not null default '[]'
);

-- ---------------- indexes ----------------
create index if not exists idx_appt_doctor_date on appointments ("doctorId", "date");
create index if not exists idx_appt_patient     on appointments ("patientMrn");
create index if not exists idx_lab_patient      on lab_orders ("patientMrn");
create index if not exists idx_lab_status       on lab_orders ("status");
create index if not exists idx_rx_status        on rx_orders ("status");
create index if not exists idx_inv_patient      on invoices ("patientMrn");
create index if not exists idx_consult_patient  on consultations ("patientMrn");
create index if not exists idx_beds_status      on beds ("status");
create index if not exists idx_audit_at         on audit_log ("at" desc);

-- ---------------- row level security ----------------
-- Role-based access. Roles come from the Supabase Auth user's
-- raw_user_meta_data -> 'role' (set it when you create users).
alter table patients       enable row level security;
alter table staff          enable row level security;
alter table appointments   enable row level security;
alter table consultations  enable row level security;
alter table lab_orders     enable row level security;
alter table rx_orders      enable row level security;
alter table medicines      enable row level security;
alter table inventory      enable row level security;
alter table invoices       enable row level security;
alter table beds           enable row level security;
alter table admissions     enable row level security;
alter table emergencies    enable row level security;
alter table claims         enable row level security;
alter table notifications  enable row level security;
alter table audit_log      enable row level security;
alter table queues         enable row level security;
alter table vitals_log     enable row level security;
alter table app_meta       enable row level security;

create or replace function app_role() returns text
language sql stable as
$$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'anon') $$;

create or replace function app_is_hms_staff() returns boolean
language sql stable as
$$ select app_role() in ('admin','doctor','nurse','reception','lab','pharmacist','billing') $$;

-- Staff roles read/write every operational table (write-scope per
-- table is refined below for the sensitive ones).
do $$
declare t text;
begin
  foreach t in array array[
    'patients','staff','appointments','consultations','lab_orders','rx_orders',
    'medicines','inventory','invoices','beds','admissions','emergencies',
    'claims','notifications','audit_log','queues','vitals_log','app_meta'
  ] loop
    execute format('drop policy if exists hms_read on %I', t);
    execute format('create policy hms_read on %I for select to authenticated using (app_is_hms_staff())', t);
    execute format('drop policy if exists hms_write on %I', t);
    execute format('create policy hms_write on %I for all to authenticated using (app_is_hms_staff()) with check (app_is_hms_staff())', t);
  end loop;
end $$;

-- Sensitive clinical data: only clinical roles may modify records.
drop policy if exists hms_write on consultations;
create policy hms_write on consultations for all to authenticated
  using (app_role() in ('admin','doctor')) with check (app_role() in ('admin','doctor'));

drop policy if exists hms_write on lab_orders;
create policy hms_write on lab_orders for all to authenticated
  using (app_role() in ('admin','doctor','lab')) with check (app_role() in ('admin','doctor','lab'));

drop policy if exists hms_write on audit_log;
create policy hms_write on audit_log for insert to authenticated
  with check (app_is_hms_staff());

-- ============================================================
-- First run: after creating the tables, open MediCore HMS →
-- Settings → Database → "Seed cloud from this device" to push
-- the demo dataset, or connect your own seeded database.
-- ============================================================
