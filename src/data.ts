/* ============================================================
   MediCore HMS — data model, catalogs, helpers and seed database
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

export const QUEUE_DEPTS = [
  { key: "consult", label: "General Consultation", prefix: "A", room: "Consultation Room 3", icon: "stetho" },
  { key: "lab", label: "Laboratory", prefix: "L", room: "Sample Room 1", icon: "flask" },
  { key: "pharm", label: "Pharmacy", prefix: "PH", room: "Dispensing Window 2", icon: "pill" },
  { key: "bill", label: "Billing & Cashier", prefix: "B", room: "Cashier Counter 1", icon: "receipt" },
] as const;

/* ---------------- seed database ---------------- */

const S = (
  id: string, name: string, role: Role, dept: string, title: string, phone: string,
  status: Staff["status"], extra?: Partial<Staff>
): Staff => ({
  id, name, role, dept, title, phone, status,
  schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"], active: true, ...extra,
});

const P = (
  mrn: string, name: string, dob: string, gender: Patient["gender"], phone: string,
  bloodGroup: string, status: Patient["status"], extra?: Partial<Patient>
): Patient => ({
  mrn, name, dob, gender, phone, bloodGroup, status,
  nationalId: "GH" + mrn.slice(2) + "25",
  address: "Accra, Ghana",
  allergies: [],
  insurance: null,
  nextOfKin: { name: "—", phone: "—", relation: "—" },
  history: [],
  medications: [],
  registeredAt: atToday(-9 * 24 - parseInt(mrn.slice(2), 10)),
  ...extra,
});

export function seedDB(): DB {
  const today = todayISO();

  const staff: Staff[] = [
    S("U-01", "Daniel Ofori", "admin", "Administration", "Hospital Administrator", "024 555 0101", "on-duty"),
    S("D-01", "Dr. Kwame Mensah", "doctor", "General Practice", "Senior Medical Officer", "024 555 0201", "on-duty", { specialty: "General Practice", room: "Consult 1" }),
    S("D-02", "Dr. Ama Serwaa Owusu", "doctor", "Internal Medicine", "Consultant Physician", "024 555 0202", "on-duty", { specialty: "Internal Medicine", room: "Consult 4" }),
    S("D-03", "Dr. Yaw Boateng", "doctor", "Paediatrics", "Paediatrician", "024 555 0203", "on-duty", { specialty: "Paediatrics", room: "Consult 5" }),
    S("D-04", "Dr. Efua Asante", "doctor", "Obstetrics & Gynaecology", "Consultant OBGYN", "024 555 0204", "off-duty", { specialty: "OBGYN", room: "Consult 6", schedule: ["Mon", "Wed", "Fri"] }),
    S("D-05", "Dr. Kojo Adjei", "doctor", "Surgery", "General Surgeon", "024 555 0205", "on-duty", { specialty: "General Surgery", room: "Theatre 2" }),
    S("D-06", "Dr. Abena Darko", "doctor", "Cardiology", "Consultant Cardiologist", "024 555 0206", "on-duty", { specialty: "Cardiology", room: "Consult 7", schedule: ["Tue", "Thu", "Fri"] }),
    S("D-07", "Dr. Nana Osei", "doctor", "Emergency", "Emergency Physician", "024 555 0207", "on-duty", { specialty: "Emergency Medicine", room: "Resus Bay" }),
    S("D-08", "Dr. Akosua Frimpong", "doctor", "Radiology", "Radiologist", "024 555 0208", "on-leave", { specialty: "Radiology", room: "Imaging Suite" }),
    S("U-02", "Gifty Appiah", "nurse", "Ward A", "Charge Nurse", "020 555 0301", "on-duty"),
    S("U-03", "Samuel Tetteh", "nurse", "Ward C", "Staff Nurse", "020 555 0302", "on-duty"),
    S("U-04", "Linda Mensimah", "nurse", "Ward B", "Staff Nurse", "020 555 0303", "off-duty"),
    S("U-05", "Kwesi Amoako", "lab", "Laboratory", "Senior Lab Technician", "054 555 0401", "on-duty"),
    S("U-06", "Selorm Agbeko", "pharmacist", "Pharmacy", "Superintendent Pharmacist", "054 555 0501", "on-duty"),
    S("U-07", "Mariam Alhassan", "reception", "Front Desk", "Lead Receptionist", "055 555 0601", "on-duty"),
    S("U-08", "Josephine Baah", "billing", "Finance", "Billing Officer", "055 555 0701", "on-duty"),
  ];

  const patients: Patient[] = [
    P("P-1001", "Kofi Asare", "1988-03-14", "Male", "024 401 2210", "O+", "outpatient", {
      address: "Osu, Accra", allergies: ["Penicillin"],
      insurance: { provider: "NHIS", memberNo: "NH-4482-101", type: "Informal Sector", expiry: dISO(160) },
      nextOfKin: { name: "Abena Asare", phone: "024 401 2211", relation: "Spouse" },
      history: ["Malaria (2024)", "Tonsillitis (2023)"], medications: ["Artemether-Lumefantrine (current course)"],
    }),
    P("P-1002", "Adwoa Nyarko", "1975-11-02", "Female", "020 318 7745", "A+", "admitted", {
      address: "Tema, Community 8", allergies: ["Sulfa drugs"],
      insurance: { provider: "NHIS", memberNo: "NH-2214-889", type: "Formal Sector", expiry: dISO(220) },
      nextOfKin: { name: "Kwame Nyarko", phone: "020 318 7746", relation: "Spouse" },
      history: ["Hypertension (2019)", "Appendectomy (2015)"], medications: ["Amlodipine 5mg", "Losartan 50mg"],
    }),
    P("P-1003", "Kwabena Oduro", "1962-06-21", "Male", "054 220 9981", "B+", "outpatient", {
      address: "Kumasi, Ahodwo", allergies: [],
      insurance: { provider: "Acacia Health", memberNo: "AC-88121", type: "Family Plan", expiry: dISO(75) },
      history: ["Type 2 Diabetes (2018)", "Hypertension (2020)"], medications: ["Metformin 500mg", "Amlodipine 5mg"],
    }),
    P("P-1004", "Mansa Baiden", "2016-01-30", "Female", "024 909 3312", "O-", "outpatient", {
      address: "Dansoman, Accra", allergies: ["None known"],
      nextOfKin: { name: "Efua Baiden", phone: "024 909 3313", relation: "Mother" },
      history: ["UTIs (recurrent)"], medications: [],
    }),
    P("P-1005", "Yaw Darko", "1994-09-12", "Male", "055 771 2044", "AB+", "outpatient", {
      address: "Madina, Accra", allergies: ["Aspirin"],
      insurance: { provider: "NHIS", memberNo: "NH-7731-402", type: "Informal Sector", expiry: dISO(-12) },
      history: ["Asthma (childhood)"], medications: ["Salbutamol inhaler PRN"],
    }),
    P("P-1006", "Akua Sarpong", "1990-05-05", "Female", "024 662 8890", "A-", "admitted", {
      address: "East Legon, Accra", allergies: [],
      insurance: { provider: "Nationwide Medical", memberNo: "NM-50221", type: "Corporate", expiry: dISO(300) },
      nextOfKin: { name: "Kojo Sarpong", phone: "024 662 8891", relation: "Spouse" },
      history: ["Pregnancy — 34 weeks"], medications: ["Iron + Folate"],
    }),
    P("P-1007", "Nana Yaa Owusuwaa", "1949-12-01", "Female", "020 118 5529", "O+", "admitted", {
      address: "Adabraka, Accra", allergies: ["Codeine"],
      insurance: { provider: "NHIS", memberNo: "NH-0091-771", type: "Pensioner", expiry: dISO(190) },
      history: ["Heart failure (2021)", "Osteoarthritis"], medications: ["Furosemide 40mg", "Digoxin 125µg"],
    }),
    P("P-1008", "Kojo Antwi", "2001-07-19", "Male", "054 900 1123", "B-", "emergency", {
      address: "Kaneshie, Accra", allergies: ["None known"],
      nextOfKin: { name: "Mercy Antwi", phone: "054 900 1124", relation: "Mother" },
      history: [], medications: [],
    }),
    P("P-1009", "Ama Konadu", "1983-02-11", "Female", "024 775 6641", "O+", "outpatient", {
      address: "Spintex, Accra", allergies: ["Latex"],
      insurance: { provider: "NHIS", memberNo: "NH-6620-018", type: "Formal Sector", expiry: dISO(120) },
      history: ["Peptic ulcer (2022)"], medications: ["Omeprazole 20mg PRN"],
    }),
    P("P-1010", "Fiifi Arthur", "1970-04-25", "Male", "027 320 4415", "A+", "admitted", {
      address: "Cape Coast", allergies: [],
      insurance: { provider: "Acacia Health", memberNo: "AC-30199", type: "Individual", expiry: dISO(45) },
      history: ["Peptic ulcer bleeding (2024)"], medications: [],
    }),
    P("P-1011", "Esi Cudjoe", "2019-10-08", "Female", "024 512 9907", "O+", "outpatient", {
      address: "Ashaiman", allergies: ["None known"],
      nextOfKin: { name: "Daniel Cudjoe", phone: "024 512 9908", relation: "Father" },
      history: ["Malaria (Jan 2025)"], medications: [],
    }),
    P("P-1012", "Yaw Mensimah", "1955-08-17", "Male", "020 887 3341", "O+", "outpatient", {
      address: "Tamale", allergies: ["Penicillin"],
      insurance: { provider: "NHIS", memberNo: "NH-1123-654", type: "Pensioner", expiry: dISO(95) },
      history: ["Essential hypertension", "Gout"], medications: ["Amlodipine 5mg", "Allopurinol 100mg"],
    }),
    P("P-1013", "Adjoa Lamptey", "1996-06-06", "Female", "055 240 7789", "B+", "admitted", {
      address: "Jamestown, Accra", allergies: [],
      insurance: { provider: "NHIS", memberNo: "NH-9912-220", type: "Informal Sector", expiry: dISO(210) },
      history: ["Pregnancy — 39 weeks, in labour"], medications: [],
    }),
    P("P-1014", "Osei Bonsu", "1979-01-23", "Male", "024 356 0098", "A+", "outpatient", {
      address: "Teshie, Accra", allergies: ["Ibuprofen"],
      history: ["Chronic sinusitis"], medications: [],
    }),
  ];

  const appointments: Appointment[] = [
    { id: "APT-9001", patientMrn: "P-1001", doctorId: "D-01", dept: "General Practice", date: today, time: "08:00", type: "General", reason: "Fever and chills — Day 3", status: "completed", queueNo: "A021" },
    { id: "APT-9002", patientMrn: "P-1003", doctorId: "D-02", dept: "Internal Medicine", date: today, time: "08:30", type: "Follow-up", reason: "Diabetes review — HbA1c results", status: "completed", queueNo: "A022" },
    { id: "APT-9003", patientMrn: "P-1009", doctorId: "D-01", dept: "General Practice", date: today, time: "09:00", type: "General", reason: "Epigastric pain", status: "completed", queueNo: "A023" },
    { id: "APT-9004", patientMrn: "P-1012", doctorId: "D-06", dept: "Cardiology", date: today, time: "09:30", type: "Specialist", reason: "BP not controlled on current dose", status: "in-consultation", queueNo: "A024" },
    { id: "APT-9005", patientMrn: "P-1005", doctorId: "D-01", dept: "General Practice", date: today, time: "10:00", type: "General", reason: "Wheeze after cold", status: "checked-in", queueNo: "A025" },
    { id: "APT-9006", patientMrn: "P-1014", doctorId: "D-01", dept: "General Practice", date: today, time: "10:30", type: "General", reason: "Recurrent headaches", status: "checked-in", queueNo: "A026" },
    { id: "APT-9007", patientMrn: "P-1004", doctorId: "D-03", dept: "Paediatrics", date: today, time: "11:00", type: "General", reason: "Pain on urination", status: "checked-in", queueNo: "A027" },
    { id: "APT-9008", patientMrn: "P-1011", doctorId: "D-03", dept: "Paediatrics", date: today, time: "11:30", type: "Follow-up", reason: "Post-malaria review", status: "checked-in", queueNo: "A028" },
    { id: "APT-9009", patientMrn: "P-1002", doctorId: "D-02", dept: "Internal Medicine", date: today, time: "12:00", type: "Specialist", reason: "Ward round review", status: "scheduled" },
    { id: "APT-9010", patientMrn: "P-1006", doctorId: "D-04", dept: "Obstetrics & Gynaecology", date: today, time: "13:30", type: "Follow-up", reason: "34-week antenatal check", status: "scheduled" },
    { id: "APT-9011", patientMrn: "P-1010", doctorId: "D-05", dept: "Surgery", date: today, time: "14:00", type: "Procedure", reason: "Endoscopy pre-op assessment", status: "scheduled" },
    { id: "APT-9012", patientMrn: "P-1007", doctorId: "D-06", dept: "Cardiology", date: today, time: "14:30", type: "Follow-up", reason: "Heart failure medication review", status: "scheduled" },
    { id: "APT-9013", patientMrn: "P-1001", doctorId: "D-01", dept: "General Practice", date: dISO(1), time: "09:00", type: "Follow-up", reason: "Malaria treatment review", status: "scheduled" },
    { id: "APT-9014", patientMrn: "P-1003", doctorId: "D-02", dept: "Internal Medicine", date: dISO(2), time: "10:30", type: "Specialist", reason: "Renal function review", status: "scheduled" },
    { id: "APT-9015", patientMrn: "P-1009", doctorId: "D-01", dept: "General Practice", date: dISO(-1), time: "09:30", type: "General", reason: "General check-up", status: "cancelled" },
  ];

  const consultations: Consultation[] = [
    {
      id: "CON-701", patientMrn: "P-1001", doctorId: "D-01", date: atToday(-3),
      complaint: "Fever, chills and body aches for 3 days", symptoms: ["Fever", "Chills", "Headache", "Body aches"],
      vitals: { temp: 38.6, bpSys: 112, bpDia: 74, pulse: 96, resp: 18, spo2: 97, weight: 78, height: 175, takenAt: atToday(-3), by: "Nurse Gifty Appiah" },
      examination: "Febrile, not pale, no jaundice. Chest clear, abdomen soft, no hepatosplenomegaly.",
      diagnosis: "Uncomplicated Malaria (B54)", treatment: "Artemether-Lumefantrine full course; paracetamol PRN; plenty of fluids.",
      notes: "MP smear positive (++). Advised rest for 3 days. Return if vomiting or dark urine.",
      followUp: dISO(1), rxId: "RX-3001", labIds: ["LAB-2101", "LAB-2102"],
    },
    {
      id: "CON-702", patientMrn: "P-1003", doctorId: "D-02", date: atToday(-5),
      complaint: "Routine diabetes and BP review", symptoms: ["Fatigue"],
      vitals: { temp: 36.8, bpSys: 148, bpDia: 92, pulse: 82, resp: 16, spo2: 98, weight: 91, height: 170, takenAt: atToday(-5), by: "Nurse Samuel Tetteh" },
      examination: "BMI 31.5. Foot exam normal, no sensory loss. CVS S1+S2, no murmurs.",
      diagnosis: "Type 2 Diabetes Mellitus (E11)", treatment: "Continue Metformin 500mg BD. Increase Amlodipine to 10mg. Diet and exercise counselling.",
      notes: "RBS 9.4 — above target. Booked renal function and lipid profile.",
      followUp: dISO(2), rxId: "RX-3002", labIds: ["LAB-2103", "LAB-2104"],
    },
    {
      id: "CON-703", patientMrn: "P-1009", doctorId: "D-01", date: atToday(-8),
      complaint: "Burning epigastric pain, worse on empty stomach", symptoms: ["Abdominal pain", "Nausea"],
      vitals: { temp: 36.9, bpSys: 118, bpDia: 76, pulse: 78, resp: 15, spo2: 99, weight: 64, height: 165, takenAt: atToday(-8), by: "Nurse Gifty Appiah" },
      examination: "Mild epigastric tenderness, no guarding. Negative Murphy's sign.",
      diagnosis: "Peptic Ulcer Disease (K27)", treatment: "Omeprazole 20mg BD before meals for 8 weeks. Avoid NSAIDs.",
      notes: "Test-and-treat for H. pylori discussed; stool antigen if symptoms persist.",
      followUp: dISO(20), rxId: "RX-3003", labIds: [],
    },
  ];

  const labOrders: LabOrder[] = [
    { id: "LAB-2101", patientMrn: "P-1001", doctorId: "D-01", test: "MP", priority: "urgent", orderedAt: atToday(-3), status: "verified", price: 40, verifiedBy: "Kwesi Amoako", verifiedAt: atToday(-3 + 2 / 24), results: [{ marker: "Malaria Parasite", value: "Positive (++)", unit: "", ref: "Negative", flag: "P" }] },
    { id: "LAB-2102", patientMrn: "P-1001", doctorId: "D-01", test: "CBC", priority: "routine", orderedAt: atToday(-3), status: "verified", price: 60, verifiedBy: "Kwesi Amoako", verifiedAt: atToday(-3 + 4 / 24), results: [
      { marker: "WBC", value: "9.8", unit: "×10⁹/L", ref: "4.0 – 11.0", flag: "-" },
      { marker: "RBC", value: "4.1", unit: "×10¹²/L", ref: "4.5 – 5.9", flag: "L" },
      { marker: "Hemoglobin", value: "11.9", unit: "g/dL", ref: "13.0 – 17.0", flag: "L" },
      { marker: "Hematocrit", value: "36", unit: "%", ref: "40 – 52", flag: "L" },
      { marker: "Platelets", value: "132", unit: "×10⁹/L", ref: "150 – 450", flag: "L" },
    ] },
    { id: "LAB-2103", patientMrn: "P-1003", doctorId: "D-02", test: "RBS", priority: "routine", orderedAt: atToday(-5), status: "verified", price: 35, verifiedBy: "Kwesi Amoako", verifiedAt: atToday(-5 + 3 / 24), results: [{ marker: "Glucose (random)", value: "9.4", unit: "mmol/L", ref: "3.9 – 7.8", flag: "H" }] },
    { id: "LAB-2104", patientMrn: "P-1003", doctorId: "D-02", test: "RFT", priority: "routine", orderedAt: atToday(-2), status: "processing", price: 120 },
    { id: "LAB-2105", patientMrn: "P-1002", doctorId: "D-02", test: "LFT", priority: "urgent", orderedAt: hoursAgoISO(5), status: "results", price: 120, results: [
      { marker: "ALT", value: "64", unit: "U/L", ref: "7 – 56", flag: "H" },
      { marker: "AST", value: "48", unit: "U/L", ref: "10 – 40", flag: "H" },
      { marker: "Total Bilirubin", value: "18", unit: "µmol/L", ref: "3 – 21", flag: "-" },
    ] },
    { id: "LAB-2106", patientMrn: "P-1004", doctorId: "D-03", test: "UA", priority: "urgent", orderedAt: hoursAgoISO(2), status: "ordered", price: 45 },
    { id: "LAB-2107", patientMrn: "P-1011", doctorId: "D-03", test: "MP", priority: "routine", orderedAt: hoursAgoISO(1.5), status: "ordered", price: 40 },
    { id: "LAB-2108", patientMrn: "P-1007", doctorId: "D-06", test: "RFT", priority: "stat", orderedAt: hoursAgoISO(3), status: "collected", price: 120 },
    { id: "LAB-2109", patientMrn: "P-1010", doctorId: "D-05", test: "CBC", priority: "routine", orderedAt: hoursAgoISO(4), status: "processing", price: 60 },
  ];

  const rxOrders: RxOrder[] = [
    { id: "RX-3001", patientMrn: "P-1001", doctorId: "D-01", date: atToday(-3), status: "dispensed", dispensedBy: "Selorm Agbeko", dispensedAt: atToday(-3 + 1 / 24), items: [
      { medId: "M-04", name: "Artemether-Lumefantrine 20/120mg", qty: 24, dose: "4 tabs", freq: "Twice daily", duration: "3 days", unitPrice: 3.5 },
      { medId: "M-02", name: "Paracetamol 500mg", qty: 12, dose: "2 tabs", freq: "Three times daily", duration: "As needed", unitPrice: 0.8 },
    ] },
    { id: "RX-3002", patientMrn: "P-1003", doctorId: "D-02", date: atToday(-5), status: "dispensed", dispensedBy: "Selorm Agbeko", dispensedAt: atToday(-5 + 2 / 24), items: [
      { medId: "M-06", name: "Metformin 500mg", qty: 60, dose: "1 tab", freq: "Twice daily", duration: "30 days", unitPrice: 1.2 },
      { medId: "M-05", name: "Amlodipine 10mg", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 1.8 },
    ] },
    { id: "RX-3003", patientMrn: "P-1009", doctorId: "D-01", date: atToday(-8), status: "dispensed", dispensedBy: "Selorm Agbeko", dispensedAt: atToday(-8 + 1 / 24), items: [
      { medId: "M-08", name: "Omeprazole 20mg", qty: 56, dose: "1 cap", freq: "Twice daily", duration: "28 days", unitPrice: 1.5 },
    ] },
    { id: "RX-3004", patientMrn: "P-1007", doctorId: "D-06", date: atToday(-2), status: "pending", items: [
      { medId: "M-13", name: "Furosemide 40mg", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 1.1 },
      { medId: "M-14", name: "Digoxin 125µg", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 2.4 },
    ] },
    { id: "RX-3005", patientMrn: "P-1002", doctorId: "D-02", date: hoursAgoISO(6), status: "pending", items: [
      { medId: "M-05", name: "Amlodipine 10mg", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 1.8 },
      { medId: "M-07", name: "Losartan 50mg", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 2.2 },
    ] },
    { id: "RX-3006", patientMrn: "P-1006", doctorId: "D-04", date: hoursAgoISO(1), status: "pending", items: [
      { medId: "M-15", name: "Iron + Folate", qty: 30, dose: "1 tab", freq: "Once daily", duration: "30 days", unitPrice: 0.9 },
      { medId: "M-02", name: "Paracetamol 500mg", qty: 10, dose: "2 tabs", freq: "As needed", duration: "PRN", unitPrice: 0.8 },
    ] },
  ];

  const medicines: Medicine[] = [
    { id: "M-01", name: "Amoxicillin 500mg", category: "Antibiotic", batch: "AMX-2451", supplier: "Mediphar Ghana", stock: 420, unit: "caps", buyPrice: 0.6, sellPrice: 1.0, expiry: dISO(300), location: "Shelf A1", reorderLevel: 200 },
    { id: "M-02", name: "Paracetamol 500mg", category: "Analgesic", batch: "PCM-8890", supplier: "Ernest Chemists", stock: 950, unit: "tabs", buyPrice: 0.4, sellPrice: 0.8, expiry: dISO(420), location: "Shelf A2", reorderLevel: 300 },
    { id: "M-03", name: "Ibuprofen 400mg", category: "NSAID", batch: "IBU-1123", supplier: "Ernest Chemists", stock: 180, unit: "tabs", buyPrice: 0.5, sellPrice: 1.0, expiry: dISO(260), location: "Shelf A2", reorderLevel: 150 },
    { id: "M-04", name: "Artemether-Lumefantrine 20/120mg", category: "Antimalarial", batch: "ALU-7741", supplier: "Zuellig Pharma", stock: 340, unit: "tabs", buyPrice: 2.1, sellPrice: 3.5, expiry: dISO(210), location: "Shelf B1", reorderLevel: 200 },
    { id: "M-05", name: "Amlodipine 10mg", category: "Antihypertensive", batch: "AML-3302", supplier: "Mediphar Ghana", stock: 95, unit: "tabs", buyPrice: 1.1, sellPrice: 1.8, expiry: dISO(340), location: "Shelf C1", reorderLevel: 150 },
    { id: "M-06", name: "Metformin 500mg", category: "Antidiabetic", batch: "MET-5519", supplier: "Mediphar Ghana", stock: 510, unit: "tabs", buyPrice: 0.7, sellPrice: 1.2, expiry: dISO(380), location: "Shelf C1", reorderLevel: 200 },
    { id: "M-07", name: "Losartan 50mg", category: "Antihypertensive", batch: "LOS-9087", supplier: "Zuellig Pharma", stock: 240, unit: "tabs", buyPrice: 1.4, sellPrice: 2.2, expiry: dISO(290), location: "Shelf C1", reorderLevel: 120 },
    { id: "M-08", name: "Omeprazole 20mg", category: "PPI", batch: "OMP-6612", supplier: "Ernest Chemists", stock: 320, unit: "caps", buyPrice: 0.9, sellPrice: 1.5, expiry: dISO(25), location: "Shelf B2", reorderLevel: 150 },
    { id: "M-09", name: "Ceftriaxone 1g Injection", category: "Antibiotic", batch: "CFT-2208", supplier: "Zuellig Pharma", stock: 0, unit: "vials", buyPrice: 8.0, sellPrice: 14.0, expiry: dISO(280), location: "Shelf D1", reorderLevel: 60 },
    { id: "M-10", name: "ORS Sachets", category: "Rehydration", batch: "ORS-4410", supplier: "Mediphar Ghana", stock: 210, unit: "sachets", buyPrice: 0.8, sellPrice: 1.5, expiry: dISO(500), location: "Shelf A3", reorderLevel: 100 },
    { id: "M-11", name: "Salbutamol Inhaler 100µg", category: "Respiratory", batch: "SAL-7783", supplier: "Zuellig Pharma", stock: 14, unit: "inhalers", buyPrice: 28.0, sellPrice: 45.0, expiry: dISO(320), location: "Shelf B3", reorderLevel: 20 },
    { id: "M-12", name: "Cetirizine 10mg", category: "Antihistamine", batch: "CET-1009", supplier: "Ernest Chemists", stock: 260, unit: "tabs", buyPrice: 0.5, sellPrice: 1.0, expiry: dISO(-15), location: "Shelf A2", reorderLevel: 100 },
    { id: "M-13", name: "Furosemide 40mg", category: "Diuretic", batch: "FUR-8845", supplier: "Mediphar Ghana", stock: 130, unit: "tabs", buyPrice: 0.6, sellPrice: 1.1, expiry: dISO(240), location: "Shelf C2", reorderLevel: 80 },
    { id: "M-14", name: "Digoxin 125µg", category: "Cardiac", batch: "DIG-3371", supplier: "Zuellig Pharma", stock: 55, unit: "tabs", buyPrice: 1.5, sellPrice: 2.4, expiry: dISO(200), location: "Shelf C2", reorderLevel: 40 },
    { id: "M-15", name: "Iron + Folate", category: "Supplement", batch: "IRF-5520", supplier: "Mediphar Ghana", stock: 400, unit: "tabs", buyPrice: 0.5, sellPrice: 0.9, expiry: dISO(360), location: "Shelf A3", reorderLevel: 150 },
    { id: "M-16", name: "Azithromycin 250mg", category: "Antibiotic", batch: "AZT-9917", supplier: "Zuellig Pharma", stock: 85, unit: "caps", buyPrice: 2.8, sellPrice: 4.5, expiry: dISO(150), location: "Shelf D1", reorderLevel: 100 },
  ];

  const inventory: InventoryItem[] = [
    { id: "INV-01", name: "Surgical Gloves (M)", category: "PPE", stock: 12, unit: "pairs", reorderLevel: 50, location: "Store 1", lastRestocked: dISO(-21) },
    { id: "INV-02", name: "Syringes 5ml", category: "Consumables", stock: 340, unit: "pcs", reorderLevel: 200, location: "Store 1", lastRestocked: dISO(-9) },
    { id: "INV-03", name: "Face Masks (3-ply)", category: "PPE", stock: 48, unit: "boxes", reorderLevel: 60, location: "Store 2", lastRestocked: dISO(-14) },
    { id: "INV-04", name: "Gauze Rolls", category: "Consumables", stock: 120, unit: "rolls", reorderLevel: 80, location: "Store 1", lastRestocked: dISO(-6) },
    { id: "INV-05", name: "IV Cannula 18G", category: "Consumables", stock: 25, unit: "pcs", reorderLevel: 40, location: "Store 1", lastRestocked: dISO(-30) },
    { id: "INV-06", name: "Alcohol Swabs", category: "Consumables", stock: 500, unit: "pcs", reorderLevel: 250, location: "Store 2", lastRestocked: dISO(-3) },
    { id: "INV-07", name: "CBC Reagent Pack", category: "Lab Supplies", stock: 6, unit: "packs", reorderLevel: 10, location: "Lab Store", lastRestocked: dISO(-18) },
    { id: "INV-08", name: "Bed Sheets (Ward)", category: "Linen", stock: 74, unit: "pcs", reorderLevel: 40, location: "Linen Room", lastRestocked: dISO(-5) },
    { id: "INV-09", name: "A4 Paper", category: "Stationery", stock: 18, unit: "reams", reorderLevel: 20, location: "Admin Store", lastRestocked: dISO(-25) },
  ];

  const invoices: Invoice[] = [
    { id: "INV-5001", patientMrn: "P-1001", date: dISO(-3), items: [
      { desc: "General Consultation — Dr. Mensah", amount: 100, kind: "consultation" },
      { desc: "Lab: Malaria Parasite (MP)", amount: 40, kind: "lab" },
      { desc: "Lab: Complete Blood Count", amount: 60, kind: "lab" },
      { desc: "Pharmacy: Artemether-Lumefantrine ×24", amount: 84, kind: "pharmacy" },
      { desc: "Pharmacy: Paracetamol 500mg ×12", amount: 9.6, kind: "pharmacy" },
    ], paid: 293.6, method: "NHIS + Cash", status: "paid" },
    { id: "INV-5002", patientMrn: "P-1003", date: dISO(-5), items: [
      { desc: "Specialist Consultation — Dr. Owusu", amount: 150, kind: "consultation" },
      { desc: "Lab: Random Blood Sugar", amount: 35, kind: "lab" },
      { desc: "Pharmacy: Metformin 500mg ×60", amount: 72, kind: "pharmacy" },
      { desc: "Pharmacy: Amlodipine 10mg ×30", amount: 54, kind: "pharmacy" },
    ], paid: 161.5, method: "Acacia Health (part) + MoMo", status: "partial" },
    { id: "INV-5003", patientMrn: "P-1002", date: dISO(-2), items: [
      { desc: "Ward admission deposit — Ward B", amount: 400, kind: "bed" },
      { desc: "Bed charges ×2 nights", amount: 360, kind: "bed" },
      { desc: "Lab: Liver Function Test", amount: 120, kind: "lab" },
    ], paid: 0, status: "unpaid" },
    { id: "INV-5004", patientMrn: "P-1009", date: dISO(-8), items: [
      { desc: "General Consultation — Dr. Mensah", amount: 100, kind: "consultation" },
      { desc: "Pharmacy: Omeprazole 20mg ×56", amount: 84, kind: "pharmacy" },
    ], paid: 184, method: "MoMo", status: "paid" },
    { id: "INV-5005", patientMrn: "P-1007", date: dISO(-1), items: [
      { desc: "Emergency assessment", amount: 200, kind: "consultation" },
      { desc: "Bed charges — Ward B ×1 night", amount: 180, kind: "bed" },
      { desc: "Lab: Kidney Function Test", amount: 120, kind: "lab" },
    ], paid: 200, method: "Cash", status: "partial" },
    { id: "INV-5006", patientMrn: "P-1010", date: today, items: [
      { desc: "Surgical pre-op assessment — Dr. Adjei", amount: 180, kind: "consultation" },
      { desc: "Lab: Complete Blood Count", amount: 60, kind: "lab" },
    ], paid: 0, status: "unpaid" },
    { id: "INV-5007", patientMrn: "P-1013", date: today, items: [
      { desc: "Maternity admission — Ward D", amount: 500, kind: "bed" },
      { desc: "Procedure: Normal delivery", amount: 900, kind: "procedure" },
    ], paid: 0, status: "unpaid" },
  ];

  const beds: Bed[] = [];
  const occupied: Record<string, string> = {
    "A-02": "P-1010", "B-01": "P-1002", "B-04": "P-1007", "D-02": "P-1006", "D-03": "P-1013",
  };
  (["A", "B", "C", "D"] as const).forEach((w) => {
    for (let i = 1; i <= 6; i++) {
      const id = `${w}-${String(i).padStart(2, "0")}`;
      const patientMrn = occupied[id];
      beds.push({
        id, ward: w, patientMrn,
        status: patientMrn ? "occupied" : id === "A-05" || id === "B-06" ? "cleaning" : id === "C-01" ? "reserved" : "available",
      });
    }
  });

  const admissions: Admission[] = [
    { id: "ADM-801", patientMrn: "P-1002", bedId: "B-01", doctorId: "D-02", date: atToday(-2 * 24), diagnosis: "Hypertensive urgency", status: "active", dailyCharge: 180, notes: [
      { at: atToday(-30), by: "Nurse Linda Mensimah", text: "BP 158/96 on waking. Medication administered 08:00." },
      { at: atToday(-6), by: "Dr. Ama Serwaa Owusu", text: "Reviewed. Continue IV antihypertensives, repeat LFTs tomorrow." },
    ] },
    { id: "ADM-802", patientMrn: "P-1007", bedId: "B-04", doctorId: "D-06", date: atToday(-1 * 24), diagnosis: "Decompensated heart failure", status: "active", dailyCharge: 180, notes: [
      { at: atToday(-8), by: "Nurse Linda Mensimah", text: "SpO₂ 94% on 2L O₂. Strict fluid balance chart started." },
    ] },
    { id: "ADM-803", patientMrn: "P-1010", bedId: "A-02", doctorId: "D-05", date: atToday(-1 * 24 - 4), diagnosis: "Pre-operative — PUD bleeding", status: "active", dailyCharge: 180, notes: [
      { at: atToday(-10), by: "Dr. Kojo Adjei", text: "NBM from midnight. Cross-match 2 units." },
    ] },
    { id: "ADM-804", patientMrn: "P-1006", bedId: "D-02", doctorId: "D-04", date: atToday(-1 * 24 - 8), diagnosis: "Antenatal — 34 weeks, observation", status: "active", dailyCharge: 200, notes: [
      { at: atToday(-4), by: "Nurse Gifty Appiah", text: "Fetal heart rate 142 bpm. CTG reactive." },
    ] },
    { id: "ADM-805", patientMrn: "P-1013", bedId: "D-03", doctorId: "D-04", date: hoursAgoISO(7), diagnosis: "In labour — 39 weeks", status: "active", dailyCharge: 200, notes: [
      { at: hoursAgoISO(6), by: "Nurse Gifty Appiah", text: "Cervix 4cm dilated. Partograph started." },
    ] },
  ];

  const emergencies: EmergencyCase[] = [
    { id: "EM-401", patientMrn: "P-1008", arrival: hoursAgoISO(0.4), triage: "critical", symptoms: "RTA — chest pain, difficulty breathing, BP dropping", vitals: { bpSys: 82, bpDia: 50, pulse: 128, resp: 26, spo2: 88 }, doctorId: "D-07", status: "in-treatment" },
    { id: "EM-402", patientMrn: "P-1005", arrival: hoursAgoISO(1.2), triage: "urgent", symptoms: "Acute asthma exacerbation, wheeze, unable to complete sentences", vitals: { pulse: 112, resp: 28, spo2: 91 }, doctorId: "D-07", status: "in-treatment" },
    { id: "EM-403", patientMrn: "P-1011", arrival: hoursAgoISO(2.1), triage: "moderate", symptoms: "High-grade fever with convulsion at home, now conscious", vitals: { temp: 39.4, pulse: 130 }, status: "waiting" },
    { id: "EM-404", patientMrn: "P-1014", arrival: hoursAgoISO(3.4), triage: "stable", symptoms: "Deep laceration left forearm from kitchen knife, bleeding controlled", status: "waiting" },
  ];

  const claims: Claim[] = [
    { id: "CLM-601", patientMrn: "P-1001", provider: "NHIS", invoiceId: "INV-5001", amount: 165, date: dISO(-3), status: "paid" },
    { id: "CLM-602", patientMrn: "P-1003", provider: "Acacia Health", invoiceId: "INV-5002", amount: 150, date: dISO(-5), status: "approved" },
    { id: "CLM-603", patientMrn: "P-1009", provider: "NHIS", invoiceId: "INV-5004", amount: 100, date: dISO(-8), status: "submitted" },
    { id: "CLM-604", patientMrn: "P-1007", provider: "NHIS", invoiceId: "INV-5005", amount: 300, date: dISO(-1), status: "pending" },
    { id: "CLM-605", patientMrn: "P-1012", provider: "NHIS", invoiceId: "INV-5003", amount: 220, date: dISO(-12), status: "rejected" },
  ];

  const notifications: Notif[] = [
    { id: "N-01", at: hoursAgoISO(0.3), icon: "alert", text: "Triage RED: RTA patient Kojo Antwi (EM-401) in Resus Bay", read: false, roles: ["admin", "doctor", "nurse"] },
    { id: "N-02", at: hoursAgoISO(1), icon: "lab", text: "LFT results ready for Adwoa Nyarko (P-1002) — ALT elevated", read: false, roles: ["admin", "doctor"] },
    { id: "N-03", at: hoursAgoISO(1.4), icon: "rx", text: "New prescription RX-3006 from Dr. Asante — waiting at pharmacy", read: false, roles: ["admin", "pharmacist"] },
    { id: "N-04", at: hoursAgoISO(2), icon: "stock", text: "Low stock: Salbutamol Inhaler — 14 remaining (min 20)", read: false, roles: ["admin", "pharmacist"] },
    { id: "N-05", at: hoursAgoISO(2.5), icon: "stock", text: "Out of stock: Ceftriaxone 1g Injection — reorder raised", read: false, roles: ["admin", "pharmacist"] },
    { id: "N-06", at: hoursAgoISO(3), icon: "bill", text: "Payment received: GH₵ 200.00 from Nana Yaa Owusuwaa (Cash)", read: false, roles: ["admin", "billing"] },
    { id: "N-07", at: hoursAgoISO(4), icon: "claim", text: "Insurance claim CLM-605 rejected by NHIS — resubmission needed", read: false, roles: ["admin", "billing"] },
    { id: "N-08", at: hoursAgoISO(5), icon: "appt", text: "12 appointments scheduled today — 4 completed so far", read: true, roles: ["admin", "reception", "doctor"] },
    { id: "N-09", at: hoursAgoISO(6), icon: "bed", text: "Bed A-05 moved to cleaning after discharge", read: true, roles: ["admin", "nurse"] },
    { id: "N-10", at: hoursAgoISO(7), icon: "vitals", text: "Vitals recorded for Adwoa Nyarko by Nurse Mensimah", read: true, roles: ["admin", "doctor", "nurse"] },
  ];

  const audit: AuditEntry[] = [
    { id: "AU-01", at: hoursAgoISO(0.3), user: "Dr. Nana Osei", role: "doctor", action: "Started treatment on emergency case EM-401 (Kojo Antwi)" },
    { id: "AU-02", at: hoursAgoISO(0.9), user: "Kwesi Amoako", role: "lab", action: "Entered LFT results for LAB-2105 (P-1002)" },
    { id: "AU-03", at: hoursAgoISO(1.2), user: "Dr. Akosua Frimpong", role: "doctor", action: "Issued prescription RX-3006 for Akua Sarpong" },
    { id: "AU-04", at: hoursAgoISO(1.8), user: "Mariam Alhassan", role: "reception", action: "Checked in Yaw Mensimah (A026) for Dr. Mensah" },
    { id: "AU-05", at: hoursAgoISO(2.2), user: "Selorm Agbeko", role: "pharmacist", action: "Raised purchase order for Ceftriaxone 1g (out of stock)" },
    { id: "AU-06", at: hoursAgoISO(3), user: "Josephine Baah", role: "billing", action: "Recorded GH₵ 200.00 payment on INV-5005 (Cash)" },
    { id: "AU-07", at: hoursAgoISO(3.6), user: "Dr. Abena Darko", role: "doctor", action: "Completed consultation with Yaw Mensimah (A024)" },
    { id: "AU-08", at: hoursAgoISO(4.5), user: "Gifty Appiah", role: "nurse", action: "Recorded vitals for Adwoa Nyarko — BP 158/96" },
    { id: "AU-09", at: hoursAgoISO(5.1), user: "Daniel Ofori", role: "admin", action: "Updated role permissions for Front Desk staff" },
    { id: "AU-10", at: hoursAgoISO(6), user: "Mariam Alhassan", role: "reception", action: "Registered new patient Osei Bonsu (P-1014)" },
  ];

  return {
    v: 3,
    patients, staff, appointments, consultations, labOrders, rxOrders, medicines,
    inventory, invoices, beds, admissions, emergencies, claims, notifications, audit,
    vitalsLog: [],
    queues: {
      consult: { serving: "A024", waiting: ["A025", "A026", "A027", "A028"], seq: 28 },
      lab: { serving: "L012", waiting: ["L013", "L014"], seq: 14 },
      pharm: { serving: "PH07", waiting: ["PH08"], seq: 8 },
      bill: { serving: "B03", waiting: ["B04", "B05"], seq: 5 },
    },
    trends: {
      registrations: [14, 18, 16, 22, 19, 25, 23, 21, 27, 24, 30, 28, 26, 33],
      revenue: [3250, 4120, 3890, 5240, 4610, 6120, 5480, 4930, 6890, 5950, 7420, 6610, 7180, 8240],
      labels: Array.from({ length: 14 }, (_, i) => fmtShort(dISO(i - 13))),
    },
  };
}
