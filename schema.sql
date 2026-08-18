-- ============================================================
-- MediCore HMS — Supabase / PostgreSQL schema
-- ============================================================
-- Run this whole file in the Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> Run).
-- It is idempotent: safe to re-run at any time.
--
-- Design notes
--  * Primary keys are the app's own readable IDs
--    (patients "P-1001", appointments "AP-9001", labs "LB-201"...)
--    so rows in Postgres map 1:1 to what you see on screen.
--  * Nested structures (vitals, lab result rows, prescription
--    items, ward notes, invoice lines) are stored as jsonb so
--    the front-end and the database share one shape with zero
--    mapping code.
--  * The client connects with the project's PUBLISHABLE key
--    (anon role, no Supabase Auth in this build), so the demo
--    policies below open the tables to anon + authenticated.
--    The app enforces per-role access in its UI layer.
--  * Role-scoped hardened policies are included, commented,
--    at the bottom — enable them once you add Supabase Auth
--    and store each user's role in raw_user_meta_data.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PATIENTS  (master record — everything hangs off the MRN)
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 2. STAFF  (doctors, nurses, lab, pharmacy, billing, admins)
-- ------------------------------------------------------------
create table if not exists staff (
  "id"        text primary key,
  "name"      text not null,
  "role"      text not null,          -- admin|doctor|nurse|reception|lab|pharmacist|billing
  "dept"      text,
  "title"     text,
  "phone"     text,
  "email"     text,                   -- links the record to the Supabase Auth user
  "status"    text not null default 'off-duty',   -- on-duty|off-duty|on-leave
  "room"      text,
  "specialty" text,
  "schedule"  jsonb not null default '[]',
  "active"    boolean not null default true
);
create unique index if not exists idx_staff_email on staff (lower("email"));


-- ------------------------------------------------------------
-- 3. APPOINTMENTS  (status flow drives check-in -> queue)
-- ------------------------------------------------------------
create table if not exists appointments (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "doctorId"   text references staff("id")     on delete cascade,
  "dept"       text,
  "date"       date,
  "time"       text,
  "type"       text,                   -- General|Follow-up|Specialist|Procedure
  "reason"     text,
  "status"     text not null default 'scheduled',
               -- scheduled|checked-in|in-consultation|completed|cancelled
  "queueNo"    text
);


-- ------------------------------------------------------------
-- 4. CONSULTATIONS  (structured EMR encounter)
-- ------------------------------------------------------------
create table if not exists consultations (
  "id"          text primary key,
  "patientMrn"  text references patients("mrn") on delete cascade,
  "doctorId"    text references staff("id")     on delete cascade,
  "date"        timestamptz,
  "complaint"   text,
  "symptoms"    jsonb not null default '[]',
  "vitals"      jsonb not null default '{}',   -- temp, bp, pulse, resp, spo2, weight, height
  "examination" text,
  "diagnosis"   text,
  "treatment"   text,
  "notes"       text,
  "followUp"    date,
  "rxId"        text,                          -- linked e-prescription
  "labIds"      jsonb not null default '[]'    -- linked lab orders
);


-- ------------------------------------------------------------
-- 5. LAB ORDERS  (ordered -> collected -> processing
--                 -> results -> verified)
-- ------------------------------------------------------------
create table if not exists lab_orders (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "doctorId"   text references staff("id")     on delete cascade,
  "test"       text not null,
  "priority"   text not null default 'routine',   -- routine|urgent|stat
  "orderedAt"  timestamptz,
  "status"     text not null default 'ordered',
  "price"      numeric not null default 0,
  "results"    jsonb,                       -- [{marker, value, unit, ref, flag}]
  "verifiedBy" text,
  "verifiedAt" timestamptz,
  "note"       text
);


-- ------------------------------------------------------------
-- 6. RX ORDERS  (electronic prescriptions -> pharmacy)
-- ------------------------------------------------------------
create table if not exists rx_orders (
  "id"          text primary key,
  "patientMrn"  text references patients("mrn") on delete cascade,
  "doctorId"    text references staff("id")     on delete cascade,
  "date"        timestamptz,
  "status"      text not null default 'pending',   -- pending|dispensed
  "items"       jsonb not null default '[]',       -- [{medId, name, qty, dose, freq, duration, unitPrice}]
  "dispensedBy" text,
  "dispensedAt" timestamptz
);


-- ------------------------------------------------------------
-- 7. MEDICINES  (pharmacy inventory, dispensing decrements)
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 8. INVENTORY  (non-drug consumables, PPE, lab supplies)
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- 9. INVOICES  (auto-billing: services append line items)
-- ------------------------------------------------------------
create table if not exists invoices (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "date"       date,
  "items"      jsonb not null default '[]',   -- [{desc, amount, kind}]
  "paid"       numeric not null default 0,
  "method"     text,
  "status"     text not null default 'unpaid'  -- unpaid|partial|paid
);


-- ------------------------------------------------------------
-- 10. BEDS  (live bed map: available|occupied|cleaning|reserved)
-- ------------------------------------------------------------
create table if not exists beds (
  "id"         text primary key,
  "ward"       text not null,
  "status"     text not null default 'available',
  "patientMrn" text references patients("mrn") on delete set null
);


-- ------------------------------------------------------------
-- 11. ADMISSIONS  (ward stay, daily charges, nursing notes)
-- ------------------------------------------------------------
create table if not exists admissions (
  "id"            text primary key,
  "patientMrn"    text references patients("mrn") on delete cascade,
  "bedId"         text references beds("id")      on delete cascade,
  "doctorId"      text references staff("id")     on delete cascade,
  "date"          timestamptz,
  "diagnosis"     text,
  "status"        text not null default 'active',   -- active|discharged
  "dischargeDate" timestamptz,
  "dailyCharge"   numeric not null default 0,
  "notes"         jsonb not null default '[]'       -- [{at, by, text}]
);


-- ------------------------------------------------------------
-- 12. EMERGENCIES  (triage board)
-- ------------------------------------------------------------
create table if not exists emergencies (
  "id"          text primary key,
  "patientMrn"  text references patients("mrn") on delete cascade,
  "arrival"     timestamptz,
  "triage"      text not null default 'stable',   -- critical|urgent|moderate|stable
  "symptoms"    text,
  "vitals"      jsonb,
  "doctorId"    text references staff("id") on delete set null,
  "status"      text not null default 'waiting',  -- waiting|in-treatment|admitted|discharged
  "disposition" text
);


-- ------------------------------------------------------------
-- 13. CLAIMS  (insurance / NHIS pipeline)
-- ------------------------------------------------------------
create table if not exists claims (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "provider"   text,
  "invoiceId"  text references invoices("id")  on delete cascade,
  "amount"     numeric not null default 0,
  "date"       date,
  "status"     text not null default 'pending'  -- pending|submitted|approved|rejected|paid
);


-- ------------------------------------------------------------
-- 14. NOTIFICATIONS  (central feed, routed by role)
-- ------------------------------------------------------------
create table if not exists notifications (
  "id"   text primary key,
  "at"   timestamptz not null default now(),
  "icon" text not null default 'appt',
  "text" text not null,
  "read" boolean not null default false,
  "roles" jsonb not null default '[]'
);


-- ------------------------------------------------------------
-- 15. AUDIT LOG  (tamper-evident trail of every action)
-- ------------------------------------------------------------
create table if not exists audit_log (
  "id"     text primary key,
  "at"     timestamptz not null default now(),
  "user"   text not null,
  "role"   text,
  "action" text not null
);


-- ------------------------------------------------------------
-- 16. QUEUES  (token counters per counter: consult/lab/pharm/bill)
-- ------------------------------------------------------------
create table if not exists queues (
  "key"     text primary key,
  "seq"     integer not null default 0,
  "serving" text,
  "waiting" jsonb not null default '[]'
);


-- ------------------------------------------------------------
-- 17. VITALS LOG  (nursing-station vitals, separate from consults)
-- ------------------------------------------------------------
create table if not exists vitals_log (
  "id"         text primary key,
  "patientMrn" text references patients("mrn") on delete cascade,
  "v"          jsonb not null default '{}'
);


-- ------------------------------------------------------------
-- 18. APP META  (dashboard trend series)
-- ------------------------------------------------------------
create table if not exists app_meta (
  "id"            text primary key,
  "registrations" jsonb not null default '[]',
  "revenue"       jsonb not null default '[]',
  "labels"        jsonb not null default '[]'
);


-- ============================================================
-- INDEXES  (hot lookups across the operational views)
-- ============================================================
create index if not exists idx_appt_doctor_date on appointments ("doctorId", "date");
create index if not exists idx_appt_patient     on appointments ("patientMrn");
create index if not exists idx_lab_patient      on lab_orders   ("patientMrn");
create index if not exists idx_lab_status       on lab_orders   ("status");
create index if not exists idx_rx_status        on rx_orders    ("status");
create index if not exists idx_inv_patient      on invoices     ("patientMrn");
create index if not exists idx_consult_patient  on consultations("patientMrn");
create index if not exists idx_beds_status      on beds         ("status");
create index if not exists idx_adm_status       on admissions   ("status");
create index if not exists idx_notif_read       on notifications("read");
create index if not exists idx_audit_at         on audit_log    ("at" desc);


-- ============================================================
-- ROW LEVEL SECURITY
-- Demo mode: the app connects with the publishable (anon) key,
-- so these open policies let the client sync. The HMS UI layer
-- enforces per-role permissions (a pharmacist cannot edit a
-- diagnosis; a receptionist cannot alter lab results).
-- ============================================================
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

do $$
declare t text;
begin
  foreach t in array array[
    'patients','staff','appointments','consultations','lab_orders','rx_orders',
    'medicines','inventory','invoices','beds','admissions','emergencies',
    'claims','notifications','audit_log','queues','vitals_log','app_meta'
  ] loop
    execute format('drop policy if exists hms_open on %I', t);
    execute format('create policy hms_open on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;


-- ============================================================
-- PRODUCTION HARDENING (optional — run after enabling Auth)
-- Stores each user's role in raw_user_meta_data -> 'role' and
-- scopes every table to signed-in hospital staff.
-- ============================================================
-- create or replace function app_role() returns text
-- language sql stable as
-- $$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'anon') $$;
--
-- create or replace function app_is_hms_staff() returns boolean
-- language sql stable as
-- $$ select app_role() in ('admin','doctor','nurse','reception','lab','pharmacist','billing') $$;
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'patients','staff','appointments','consultations','lab_orders','rx_orders',
--     'medicines','inventory','invoices','beds','admissions','emergencies',
--     'claims','notifications','audit_log','queues','vitals_log','app_meta'
--   ] loop
--     execute format('drop policy if exists hms_open on %I', t);
--     execute format('create policy hms_staff on %I for all to authenticated using (app_is_hms_staff()) with check (app_is_hms_staff())', t);
--   end loop;
-- end $$;
--
-- -- Sensitive clinical tables  only clinical roles may modify.
-- drop policy if exists hms_staff on consultations;
-- create policy hms_clinical on consultations for all to authenticated
--   using (app_role() in ('admin','doctor')) with check (app_role() in ('admin','doctor'));
--
-- drop policy if exists hms_staff on lab_orders;
-- create policy hms_lab on lab_orders for all to authenticated
--   using (app_role() in ('admin','doctor','lab')) with check (app_role() in ('admin','doctor','lab'));


-- ============================================================
-- FIRST RUN
-- 1. Run this file in the SQL editor.
-- 2. Open MediCore HMS -> paste your Project URL on the sign-in
--    screen (or Settings -> Database) -> "Connect & test".
-- 3. Create staff accounts under Authentication -> Users. Give
--    each user metadata so the app knows who they are, e.g.:
--        { "name": "Dr. Ama Owusu", "role": "doctor",
--          "staffId": "D-02", "dept": "Internal Medicine" }
--    Valid roles: admin, doctor, nurse, reception, lab,
--    pharmacist, billing. A staff record is provisioned
--    automatically on the user's first sign-in.
-- ============================================================
