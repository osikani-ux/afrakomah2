/* ============================================================
   MediCore HMS — data model, catalogs and helpers
   ============================================================ */

export type Role =
  | "admin"
  | "doctor"
  | "nurse"
  | "reception"
  | "lab"
  | "pharmacist"
  | "billing";

export type ViewId =
  | "dashboard"
  | "patients"
  | "appointments"
  | "queue"
  | "doctors"
  | "wards"
  | "lab"
  | "pharmacy"
  | "inventory"
  | "emergency"
  | "billing"
  | "insurance"
  | "staff"
  | "reports"
  | "notifications"
  | "settings";

export interface Staff {
  id: string;
  name: string;
  role: Role;
  dept: string;
  title: string;
  phone: string;
  status: "on-duty" | "off-duty" | "on-leave";
  room?: string;
  specialty?: string;
  schedule: string[];
  active: boolean;
  email?: string;
}

export interface Patient {
  mrn: string;
  nationalId: string;
  name: string;
  dob: string;
  gender: "Male" | "Female";
  phone: string;
  address: string;
  bloodGroup: string;
  allergies: string[];
  insurance: { provider: string; memberNo: string; type: string; expiry: string } | null;
  nextOfKin: { name: string; phone: string; relation: string };
  history: string[];
  medications: string[];
  registeredAt: string;
  status: "outpatient" | "admitted" | "emergency" | "discharged";
}

export type ApptStatus =
  | "scheduled"
  | "checked-in"
  | "in-consultation"
  | "completed"
  | "cancelled";

export interface Appointment {
  id: string;
  patientMrn: string;
  doctorId: string;
  dept: string;
  date: string;
  time: string;
  type: "General" | "Follow-up" | "Specialist" | "Procedure";
  reason: string;
  status: ApptStatus;
  queueNo?: string;
}

export interface Vitals {
  temp: number;
  bpSys: number;
  bpDia: number;
  pulse: number;
  resp: number;
  spo2: number;
  weight?: number;
  height?: number;
  takenAt: string;
  by: string;
}

export interface PatientVitals {
  patientMrn: string;
  v: Vitals;
}

export interface LabResultRow {
  marker: string;
  value: string;
  unit: string;
  ref: string;
  flag: "H" | "L" | "P" | "-";
}

export type LabStatus = "ordered" | "collected" | "processing" | "results" | "verified";

export interface LabOrder {
  id: string;
  patientMrn: string;
  doctorId: string;
  test: string;
  priority: "routine" | "urgent" | "stat";
  orderedAt: string;
  status: LabStatus;
  price: number;
  results?: LabResultRow[];
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
}

export interface RxItem {
  medId: string;
  name: string;
  qty: number;
  dose: string;
  freq: string;
  duration: string;
  unitPrice: number;
}

export interface RxOrder {
  id: string;
  patientMrn: string;
  doctorId: string;
  date: string;
  status: "pending" | "dispensed";
  items: RxItem[];
  dispensedBy?: string;
  dispensedAt?: string;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  batch: string;
  supplier: string;
  stock: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  expiry: string;
  location: string;
  reorderLevel: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  reorderLevel: number;
  location: string;
  lastRestocked: string;
}

export interface InvoiceItem {
  desc: string;
  amount: number;
  kind: "consultation" | "lab" | "pharmacy" | "bed" | "procedure" | "other";
}

export interface Invoice {
  id: string;
  patientMrn: string;
  date: string;
  items: InvoiceItem[];
  paid: number;
  method?: string;
  status: "unpaid" | "partial" | "paid";
}

export interface WardConfig {
  id: string;
  name: string;
  daily: number;
}

export interface Bed {
  id: string;
  ward: string;
  status: "available" | "occupied" | "cleaning" | "reserved";
  patientMrn?: string;
}

export interface Admission {
  id: string;
  patientMrn: string;
  bedId: string;
  doctorId: string;
  date: string;
  diagnosis: string;
  status: "active" | "discharged";
  dischargeDate?: string;
  dailyCharge: number;
  notes: { at: string; by: string; text: string }[];
}

export type TriageLevel = "critical" | "urgent" | "moderate" | "stable";

export interface EmergencyCase {
  id: string;
  patientMrn: string;
  arrival: string;
  triage: TriageLevel;
  symptoms: string;
  vitals?: Partial<Vitals>;
  doctorId?: string;
  status: "waiting" | "in-treatment" | "admitted" | "discharged";
  disposition?: string;
}

export interface Claim {
  id: string;
  patientMrn: string;
  provider: string;
  invoiceId: string;
  amount: number;
  date: string;
  status: "pending" | "submitted" | "approved" | "rejected" | "paid";
}

export interface Consultation {
  id: string;
  patientMrn: string;
  doctorId: string;
  date: string;
  complaint: string;
  symptoms: string[];
  vitals: Vitals;
  examination: string;
  diagnosis: string;
  treatment: string;
  notes: string;
  followUp?: string;
  rxId?: string;
  labIds: string[];
}

export interface Notif {
  id: string;
  at: string;
  icon: "appt" | "lab" | "rx" | "stock" | "bed" | "bill" | "claim" | "alert" | "vitals";
  text: string;
  read: boolean;
  roles: Role[];
}

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  role: Role;
  action: string;
}

export interface QueueState {
  serving: string | null;
  waiting: string[];
  seq: number;
}

export interface DB {
  v: number;
  patients: Patient[];
  staff: Staff[];
  appointments: Appointment[];
  consultations: Consultation[];
  labOrders: LabOrder[];
  rxOrders: RxOrder[];
  medicines: Medicine[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  wards: WardConfig[];
  beds: Bed[];
  admissions: Admission[];
  emergencies: EmergencyCase[];
  claims: Claim[];
  notifications: Notif[];
  audit: AuditEntry[];
  queues: Record<string, QueueState>;
  vitalsLog: PatientVitals[];
  trends: { registrations: number[]; revenue: number[]; labels: string[] };
}

export const ROLES: Role[] = ["admin", "doctor", "nurse", "reception", "lab", "pharmacist", "billing"];

/* ---------------- helpers ---------------- */

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dISO = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const nowISO = () => new Date().toISOString();

export const fmtDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtShort = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const minsSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

export const ghs = (n: number) =>
  "GH₵ " + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ageFrom = (dob: string) => {
  const b = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
};

export const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.|Nurse)\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export const hoursAgoISO = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const atToday = (hh: number, mm = 0) => {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};

/* ---------------- catalogs ---------------- */

export const ROLE_META: Record<Role, { label: string; blurb: string }> = {
  admin: { label: "Administrator", blurb: "Full system control" },
  doctor: { label: "Doctor", blurb: "Consultations & records" },
  nurse: { label: "Nurse", blurb: "Wards & vitals" },
  reception: { label: "Receptionist", blurb: "Registration & booking" },
  lab: { label: "Lab Technician", blurb: "Samples & results" },
  pharmacist: { label: "Pharmacist", blurb: "Dispensing & stock" },
  billing: { label: "Billing Officer", blurb: "Invoices & claims" },
};

export const LAB_CATALOG: Record<
  string,
  { name: string; price: number; markers: { marker: string; unit: string; ref: string; min: number; max: number; qual?: boolean }[] }
> = {
  CBC: {
    name: "Complete Blood Count",
    price: 60,
    markers: [
      { marker: "WBC", unit: "×10⁹/L", ref: "4.0 – 11.0", min: 4, max: 11 },
      { marker: "RBC", unit: "×10¹²/L", ref: "4.5 – 5.9", min: 4.5, max: 5.9 },
      { marker: "Hemoglobin", unit: "g/dL", ref: "13.0 – 17.0", min: 13, max: 17 },
      { marker: "Hematocrit", unit: "%", ref: "40 – 52", min: 40, max: 52 },
      { marker: "Platelets", unit: "×10⁹/L", ref: "150 – 450", min: 150, max: 450 },
    ],
  },
  RBS: {
    name: "Random Blood Sugar",
    price: 35,
    markers: [{ marker: "Glucose (random)", unit: "mmol/L", ref: "3.9 – 7.8", min: 3.9, max: 7.8 }],
  },
  MP: {
    name: "Malaria Parasite (MP)",
    price: 40,
    markers: [{ marker: "Malaria Parasite", unit: "", ref: "Negative", min: 0, max: 0, qual: true }],
  },
  UA: {
    name: "Urinalysis",
    price: 45,
    markers: [
      { marker: "pH", unit: "", ref: "4.5 – 8.0", min: 4.5, max: 8 },
      { marker: "Protein", unit: "", ref: "Negative", min: 0, max: 0, qual: true },
      { marker: "Glucose", unit: "", ref: "Negative", min: 0, max: 0, qual: true },
    ],
  },
  LFT: {
    name: "Liver Function Test",
    price: 120,
    markers: [
      { marker: "ALT", unit: "U/L", ref: "7 – 56", min: 7, max: 56 },
      { marker: "AST", unit: "U/L", ref: "10 – 40", min: 10, max: 40 },
      { marker: "Total Bilirubin", unit: "µmol/L", ref: "3 – 21", min: 3, max: 21 },
    ],
  },
  RFT: {
    name: "Kidney Function Test",
    price: 120,
    markers: [
      { marker: "Creatinine", unit: "µmol/L", ref: "62 – 106", min: 62, max: 106 },
      { marker: "Urea", unit: "mmol/L", ref: "2.5 – 7.1", min: 2.5, max: 7.1 },
    ],
  },
  LIPID: {
    name: "Lipid Profile",
    price: 150,
    markers: [
      { marker: "Total Cholesterol", unit: "mmol/L", ref: "< 5.2", min: 0, max: 5.2 },
      { marker: "LDL", unit: "mmol/L", ref: "< 3.4", min: 0, max: 3.4 },
      { marker: "HDL", unit: "mmol/L", ref: "> 1.0", min: 1, max: 99 },
      { marker: "Triglycerides", unit: "mmol/L", ref: "< 1.7", min: 0, max: 1.7 },
    ],
  },
};

export const COMMON_DIAGNOSES = [
  "Uncomplicated Malaria (B54)",
  "Essential Hypertension (I10)",
  "Type 2 Diabetes Mellitus (E11)",
  "Acute Upper Respiratory Infection (J06)",
  "Urinary Tract Infection (N39.0)",
  "Peptic Ulcer Disease (K27)",
  "Asthma (J45)",
  "Pneumonia (J18)",
  "Anaemia (D64)",
  "Gastroenteritis (A09)",
  "Cellulitis (L03)",
  "Pregnancy — Antenatal Care (Z34)",
];

export const SYMPTOMS = [
  "Fever",
  "Headache",
  "Cough",
  "Fatigue",
  "Nausea",
  "Chills",
  "Chest pain",
  "Abdominal pain",
  "Dizziness",
  "Sore throat",
  "Body aches",
  "Vomiting",
  "Diarrhoea",
  "Rash",
];

export const FREQS = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "At bedtime", "As needed"];

export const WARD_META: Record<string, { name: string; daily: number }> = {
  A: { name: "Ward A — General Male", daily: 180 },
  B: { name: "Ward B — General Female", daily: 180 },
  C: { name: "Ward C — Paediatrics", daily: 150 },
  D: { name: "Ward D — Maternity", daily: 200 },
};

/** Resolves a ward's live config, with a graceful fallback for legacy ids. */
export const wardOf = (wards: WardConfig[], id: string): WardConfig =>
  wards.find((w) => w.id === id) ?? { id, name: WARD_META[id]?.name ?? `Ward ${id}`, daily: WARD_META[id]?.daily ?? 180 };

/** Suggests the next free bed number in a ward, e.g. A-07. */
export const nextBedNo = (wardId: string, beds: Bed[]) => {
  const max = beds
    .filter((b) => b.ward === wardId)
    .reduce((m, b) => {
      const n = parseInt(b.id.split("-").pop() || "0", 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
  return `${wardId}-${String(max + 1).padStart(2, "0")}`;
};

export const QUEUE_DEPTS = [
  { key: "consult", label: "General Consultation", prefix: "A", room: "Consultation Room 3", icon: "stetho" },
  { key: "lab", label: "Laboratory", prefix: "L", room: "Sample Room 1", icon: "flask" },
  { key: "pharm", label: "Pharmacy", prefix: "PH", room: "Dispensing Window 2", icon: "pill" },
  { key: "bill", label: "Billing & Cashier", prefix: "B", room: "Cashier Counter 1", icon: "receipt" },
] as const;

/* ---------------- fresh database ---------------- */

/**
 * Builds a clean, empty hospital database. Beds and queue counters
 * are structural (the physical ward layout), not data — everything
 * clinical, financial and staffing starts empty and fills up as the
 * hospital works.
 */
export function emptyDB(): DB {
  const wards: WardConfig[] = (Object.keys(WARD_META) as (keyof typeof WARD_META)[]).map((w) => ({
    id: w,
    name: WARD_META[w].name.replace(/^Ward [A-Z] — /, ""),
    daily: WARD_META[w].daily,
  }));

  const beds: Bed[] = [];
  wards.forEach((w) => {
    for (let i = 1; i <= 6; i++) {
      beds.push({ id: `${w.id}-${String(i).padStart(2, "0")}`, ward: w.id, status: "available" });
    }
  });

  const queues: Record<string, QueueState> = {};
  QUEUE_DEPTS.forEach((q) => {
    queues[q.key] = { serving: null, waiting: [], seq: 0 };
  });

  return {
    v: 5,
    patients: [],
    staff: [],
    appointments: [],
    consultations: [],
    labOrders: [],
    rxOrders: [],
    medicines: [],
    inventory: [],
    invoices: [],
    wards,
    beds,
    admissions: [],
    emergencies: [],
    claims: [],
    notifications: [],
    audit: [],
    queues,
    vitalsLog: [],
    trends: {
      registrations: Array.from({ length: 14 }, () => 0),
      revenue: Array.from({ length: 14 }, () => 0),
      labels: Array.from({ length: 14 }, (_, i) => fmtShort(dISO(i - 13))),
    },
  };
}
