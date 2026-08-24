import { useMemo, useState } from "react";
import { useStore, nid, charge, invTotal } from "../store";
import {
  todayISO, nowISO, fmtDate, fmtTime, timeAgo, ghs, ageFrom,
  LAB_CATALOG, COMMON_DIAGNOSES, SYMPTOMS, FREQS,
} from "../data";
import type { Patient, Vitals } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, SearchBox, Select, StatusPill, Tabs, Textarea, Avatar, SectionHead, Empty } from "../ui";
import {
  IPlus, IChevR, IChevL, IUser, IStetho, IFlask, IPill, IReceipt, IBed, ICalendar,
  IAlert, IPhone, IDrop, IHeart, IFile, ICheck, IX, IActivity, ICard, IClipboard,
} from "../icons";

export default function Patients() {
  const { nav } = useStore();
  if (nav.patient) return <PatientDetail mrn={nav.patient} />;
  return <PatientList />;
}

/* ================= list ================= */

function PatientList() {
  const { db, user, go } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [showReg, setShowReg] = useState(false);

  const canRegister = user?.role === "reception" || user?.role === "admin" || user?.role === "doctor";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "");
    return db.patients.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!s) return true;
      const hay = [p.name, p.mrn, p.phone, p.nationalId, p.insurance?.memberNo ?? "", p.insurance?.provider ?? ""]
        .join("|").toLowerCase().replace(/\s+/g, "");
      return hay.includes(s);
    });
  }, [db.patients, q, status]);

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Patients</h1>
          <p className="text-xs text-ink-faint">{db.patients.length} records · one unique MRN per patient, duplicates blocked at registration</p>
        </div>
        {canRegister && (
          <Btn size="md" onClick={() => setShowReg(true)}><IPlus size={15} /> Register patient</Btn>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <SearchBox value={q} onChange={setQ} placeholder="Smart search — name, MRN, phone, National ID or Insurance No…" />
          </div>
          <div className="flex gap-1.5">
            {["all", "outpatient", "admitted", "emergency", "discharged"].map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-all ${status === s ? "bg-pine-900 text-mint" : "bg-line-soft text-ink-soft hover:bg-line"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="py-2.5 pr-3 font-semibold">MRN</th>
                <th className="py-2.5 pr-3 font-semibold">Patient</th>
                <th className="py-2.5 pr-3 font-semibold">Age / Sex</th>
                <th className="py-2.5 pr-3 font-semibold">Phone</th>
                <th className="py-2.5 pr-3 font-semibold">Blood</th>
                <th className="py-2.5 pr-3 font-semibold">Insurance</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.mrn} onClick={() => go("patients", { patient: p.mrn })} className="cursor-pointer border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/60">
                  <td className="py-2.5 pr-3 font-mono font-semibold text-med-700">{p.mrn}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.name} size={28} />
                      <span>
                        <span className="block font-semibold text-ink">{p.name}</span>
                        {p.allergies.length > 0 && p.allergies[0] !== "None known" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-alert"><IAlert size={10} /> {p.allergies.join(", ")}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-ink-soft">{ageFrom(p.dob)}y · {p.gender[0]}</td>
                  <td className="py-2.5 pr-3 font-mono text-ink-soft">{p.phone}</td>
                  <td className="py-2.5 pr-3"><Badge tone="danger"><IDrop size={9} /> {p.bloodGroup}</Badge></td>
                  <td className="py-2.5 pr-3">{p.insurance ? <Badge tone="info"><ICard size={10} /> {p.insurance.provider}</Badge> : <span className="text-ink-faint">—</span>}</td>
                  <td className="py-2.5 pr-3"><StatusPill s={p.status} /></td>
                  <td className="py-2.5 font-mono text-ink-faint">{fmtDate(p.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-6"><Empty icon={<IUser size={26} />} title="No patients match" sub="Try a different name, MRN, phone number or insurance ID." /></div>
          )}
        </div>
      </Card>

      {showReg && <RegisterModal onClose={() => setShowReg(false)} />}
    </div>
  );
}

/* ================= register (duplicate-safe) ================= */

function RegisterModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, toast, go } = useStore();
  const [f, setF] = useState({
    name: "", dob: "1990-01-01", gender: "Male", phone: "", address: "", bloodGroup: "O+",
    nationalId: "", allergies: "", insProvider: "", insMemberNo: "", insType: "NHIS — Informal Sector",
    insExpiry: todayISO(), kinName: "", kinPhone: "", kinRelation: "",
  });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const dup = useMemo(() => {
    const ph = f.phone.replace(/\s+/g, "");
    return db.patients.find(
      (p) =>
        (ph.length >= 7 && p.phone.replace(/\s+/g, "") === ph) ||
        (f.nationalId.trim() && p.nationalId.toLowerCase() === f.nationalId.trim().toLowerCase()) ||
        (f.name.trim().length > 3 && p.name.trim().toLowerCase() === f.name.trim().toLowerCase())
    );
  }, [db.patients, f.phone, f.nationalId, f.name]);

  const save = () => {
    if (!f.name.trim() || !f.phone.trim()) {
      toast("Full name and phone number are required", "danger");
      return;
    }
    if (dup) {
      toast("Duplicate blocked — this patient already has a record", "danger");
      return;
    }
    const mrn = nid("P", db.patients.map((p) => p.mrn));
    const patient: Patient = {
      mrn,
      nationalId: f.nationalId.trim() || "GH" + mrn.slice(2) + "26",
      name: f.name.trim(),
      dob: f.dob,
      gender: f.gender as Patient["gender"],
      phone: f.phone.trim(),
      address: f.address.trim() || "—",
      bloodGroup: f.bloodGroup,
      allergies: f.allergies ? f.allergies.split(",").map((a) => a.trim()).filter(Boolean) : ["None known"],
      insurance: f.insMemberNo.trim()
        ? { provider: f.insProvider.trim() || "NHIS", memberNo: f.insMemberNo.trim(), type: f.insType, expiry: f.insExpiry }
        : null,
      nextOfKin: { name: f.kinName.trim() || "—", phone: f.kinPhone.trim() || "—", relation: f.kinRelation.trim() || "—" },
      history: [],
      medications: [],
      registeredAt: nowISO(),
      status: "outpatient",
    };
    mutate(
      (d) => {
        d.patients.unshift(patient);
      },
      {
        audit: `Registered new patient ${patient.name} (${mrn})`,
        notify: { text: `New patient registered: ${patient.name} (${mrn})`, icon: "alert", roles: ["admin", "reception", "doctor"] },
      }
    );
    toast(`Patient registered — MRN ${mrn}. SMS confirmation sent to ${patient.phone}`, "ok");
    onClose();
    go("patients", { patient: mrn });
  };

  return (
    <Modal title="Register New Patient" sub="A unique MRN is issued automatically. Duplicate records are blocked." onClose={onClose} w="max-w-2xl"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!!dup}><ICheck size={14} /> Register & issue MRN</Btn>
      </>}>
      {dup && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-red-800">
            <IAlert size={14} /> Possible duplicate — matches existing record <span className="font-mono">{dup.mrn}</span> ({dup.name})
          </p>
          <Btn variant="danger" size="xs" onClick={() => { onClose(); go("patients", { patient: dup.mrn }); }}>Open record</Btn>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kwame Asante" /></Field>
        <Field label="Phone *"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="024 000 0000" /></Field>
        <Field label="Date of birth"><Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={(e) => set("gender", e.target.value)}><option>Male</option><option>Female</option></Select>
        </Field>
        <Field label="National ID (GHA card)"><Input value={f.nationalId} onChange={(e) => set("nationalId", e.target.value)} placeholder="GHXXXXXXXXX" /></Field>
        <Field label="Blood group">
          <Select value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
            {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Area, City" /></Field>
        <Field label="Allergies (comma separated)"><Input value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Penicillin, Sulfa…" /></Field>
        <Field label="Emergency contact"><Input value={f.kinName} onChange={(e) => set("kinName", e.target.value)} placeholder="Name" /></Field>
      </div>
      <p className="mb-2 mt-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-med-600">Insurance (optional)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Provider"><Input value={f.insProvider} onChange={(e) => set("insProvider", e.target.value)} placeholder="NHIS" /></Field>
        <Field label="Membership No."><Input value={f.insMemberNo} onChange={(e) => set("insMemberNo", e.target.value)} placeholder="NH-0000-000" /></Field>
        <Field label="Expiry"><Input type="date" value={f.insExpiry} onChange={(e) => set("insExpiry", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/* ================= detail ================= */

type TimelineEvent = { at: string; kind: "reg" | "consult" | "lab" | "rx" | "bill" | "bed" | "appt"; title: string; sub: string; mrn: string };

function PatientDetail({ mrn }: { mrn: string }) {
  const { db, user, go } = useStore();
  const p = db.patients.find((x) => x.mrn === mrn);
  const [tab, setTab] = useState("timeline");
  const [showConsult, setShowConsult] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const [showBill, setShowBill] = useState(false);

  if (!p) {
    return (
      <div className="fade-up">
        <Empty icon={<IUser size={26} />} title="Patient not found" sub="The record may have been removed." />
        <div className="mt-4 text-center"><Btn variant="outline" onClick={() => go("patients")}><IChevL size={13} /> Back to patients</Btn></div>
      </div>
    );
  }

  const role = user?.role ?? "reception";
  const canConsult = role === "doctor" || role === "admin";
  const canVitals = role === "nurse" || role === "doctor" || role === "admin";
  const canBill = role === "billing" || role === "admin";

  const events: TimelineEvent[] = [
    { at: p.registeredAt, kind: "reg" as const, title: "Patient registered", sub: `MRN ${p.mrn} issued at Front Desk`, mrn },
    ...db.consultations.filter((c) => c.patientMrn === mrn).map((c) => ({
      at: c.date, kind: "consult" as const, title: `Consultation — ${c.diagnosis}`,
      sub: `${db.staff.find((s) => s.id === c.doctorId)?.name} · ${c.complaint}`, mrn,
    })),
    ...db.labOrders.filter((l) => l.patientMrn === mrn).map((l) => ({
      at: l.verifiedAt ?? l.orderedAt, kind: "lab" as const,
      title: `Lab: ${LAB_CATALOG[l.test]?.name ?? l.test} — ${l.status}`,
      sub: l.status === "verified" ? `Verified by ${l.verifiedBy}` : `Ordered by ${db.staff.find((s) => s.id === l.doctorId)?.name}`, mrn,
    })),
    ...db.rxOrders.filter((r) => r.patientMrn === mrn).map((r) => ({
      at: r.dispensedAt ?? r.date, kind: "rx" as const, title: `Prescription ${r.id} — ${r.status}`,
      sub: r.items.map((i) => `${i.name} ×${i.qty}`).join(" · "), mrn,
    })),
    ...db.invoices.filter((i) => i.patientMrn === mrn).map((i) => ({
      at: i.date + "T12:00:00", kind: "bill" as const, title: `Invoice ${i.id} — ${ghs(invTotal(i.items))}`,
      sub: `${i.items.length} line items · ${i.status} · paid ${ghs(i.paid)}`, mrn,
    })),
    ...db.admissions.filter((a) => a.patientMrn === mrn).map((a) => ({
      at: a.date, kind: "bed" as const, title: a.status === "active" ? `Admitted — bed ${a.bedId}` : `Discharged from bed ${a.bedId}`,
      sub: a.diagnosis, mrn,
    })),
    ...db.appointments.filter((a) => a.patientMrn === mrn).map((a) => ({
      at: a.date + "T" + a.time + ":00", kind: "appt" as const, title: `Appointment ${a.status} — ${a.reason}`,
      sub: `${db.staff.find((s) => s.id === a.doctorId)?.name} · ${fmtDate(a.date)} ${a.time}`, mrn,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const KIND_META: Record<TimelineEvent["kind"], { icon: React.ReactNode; cls: string; label: string }> = {
    reg: { icon: <IUser size={12} />, cls: "bg-pine-900 text-mint border-pine-800", label: "Registration" },
    consult: { icon: <IStetho size={12} />, cls: "bg-med-600 text-white border-med-700", label: "Consultation" },
    lab: { icon: <IFlask size={12} />, cls: "bg-sky-600 text-white border-sky-700", label: "Laboratory" },
    rx: { icon: <IPill size={12} />, cls: "bg-teal-700 text-white border-teal-800", label: "Pharmacy" },
    bill: { icon: <IReceipt size={12} />, cls: "bg-amber-600 text-white border-amber-700", label: "Billing" },
    bed: { icon: <IBed size={12} />, cls: "bg-rose-600 text-white border-rose-700", label: "Admission" },
    appt: { icon: <ICalendar size={12} />, cls: "bg-line text-ink-soft border-line", label: "Appointment" },
  };

  const allVitals = [
    ...db.consultations.filter((c) => c.patientMrn === mrn).map((c) => c.vitals),
    ...db.vitalsLog.filter((v) => v.patientMrn === mrn).map((v) => v.v),
  ].sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));

  const insExpired = p.insurance && p.insurance.expiry < todayISO();

  return (
    <div className="fade-up space-y-4">
      <button onClick={() => go("patients")} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft transition-colors hover:text-med-700">
        <IChevL size={14} /> All patients
      </button>

      {/* header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={p.name} size={54} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-extrabold text-ink">{p.name}</h1>
                <span className="rounded-md bg-pine-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-mint">{p.mrn}</span>
                <StatusPill s={p.status} />
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {ageFrom(p.dob)} years · {p.gender} · DOB {fmtDate(p.dob)} · <Badge tone="danger" className="align-middle"><IDrop size={9} /> {p.bloodGroup}</Badge>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {p.allergies.map((a) => a !== "None known" && (
                  <Badge key={a} tone="danger"><IAlert size={10} /> Allergy: {a}</Badge>
                ))}
                {p.insurance && (
                  <Badge tone={insExpired ? "danger" : "info"}>
                    <ICard size={10} /> {p.insurance.provider} · {p.insurance.memberNo}{insExpired ? " · EXPIRED" : ""}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canConsult && <Btn onClick={() => setShowConsult(true)}><IClipboard size={14} /> New consultation</Btn>}
            {canVitals && <Btn variant="soft" onClick={() => setShowVitals(true)}><IActivity size={14} /> Record vitals</Btn>}
            {canBill && <Btn variant="outline" onClick={() => setShowBill(true)}><IReceipt size={14} /> Add charge</Btn>}
            {(role === "doctor" || role === "admin" || role === "nurse") && p.status !== "admitted" && (
              <Btn variant="dark" onClick={() => go("wards")}><IBed size={14} /> Admit to ward</Btn>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-2 rounded-xl bg-paper/70 p-3 text-[11.5px] sm:grid-cols-3">
          <span className="flex items-center gap-2 text-ink-soft"><IPhone size={13} className="text-med-600" /> {p.phone} · {p.address}</span>
          <span className="flex items-center gap-2 text-ink-soft"><IHeart size={13} className="text-alert" /> Next of kin: {p.nextOfKin.name} ({p.nextOfKin.relation}) — {p.nextOfKin.phone}</span>
          <span className="flex items-center gap-2 text-ink-soft"><IFile size={13} className="text-info" /> National ID: <span className="font-mono">{p.nationalId}</span> · Registered {fmtDate(p.registeredAt)}</span>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { k: "timeline", label: "Smart Timeline", count: events.length },
          { k: "overview", label: "Overview" },
          { k: "labs", label: "Lab Results", count: db.labOrders.filter((l) => l.patientMrn === mrn).length },
          { k: "rx", label: "Prescriptions", count: db.rxOrders.filter((r) => r.patientMrn === mrn).length },
          { k: "bills", label: "Invoices", count: db.invoices.filter((i) => i.patientMrn === mrn).length },
          { k: "vitals", label: "Vitals", count: allVitals.length },
        ]}
      />

      {tab === "timeline" && (
        <Card className="p-5">
          <SectionHead title="Complete Patient Timeline" sub="Every encounter in chronological order — registration → consultation → lab → prescription → payment → follow-up" />
          <div className="relative ml-2 space-y-0 border-l-2 border-line pl-5">
            {events.map((e, i) => {
              const m = KIND_META[e.kind];
              return (
                <div key={i} className="group relative pb-5">
                  <span className={`absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border-2 ${m.cls} transition-transform group-hover:scale-110`}>{m.icon}</span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Badge tone="neutral" className="uppercase tracking-wider">{m.label}</Badge>
                    <span className="font-mono text-[10.5px] text-ink-faint">{fmtDate(e.at)} · {fmtTime(e.at)}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{e.title}</p>
                  <p className="mt-0.5 max-w-2xl text-xs leading-snug text-ink-faint">{e.sub}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <SectionHead title="Medical History" />
            {p.history.length ? (
              <ul className="space-y-1.5">{p.history.map((h) => <li key={h} className="flex items-center gap-2 text-xs text-ink-soft"><IChevR size={12} className="text-med-500" /> {h}</li>)}</ul>
            ) : <p className="text-xs text-ink-faint">No previous conditions recorded.</p>}
          </Card>
          <Card className="p-4">
            <SectionHead title="Current Medications" />
            {p.medications.length ? (
              <div className="flex flex-wrap gap-1.5">{p.medications.map((m) => <Badge key={m} tone="med"><IPill size={10} /> {m}</Badge>)}</div>
            ) : <p className="text-xs text-ink-faint">No regular medications.</p>}
          </Card>
          <Card className="p-4">
            <SectionHead title="Insurance Profile" />
            {p.insurance ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <span className="text-ink-faint">Provider</span><span className="font-semibold text-ink">{p.insurance.provider}</span>
                <span className="text-ink-faint">Membership No.</span><span className="font-mono font-semibold text-ink">{p.insurance.memberNo}</span>
                <span className="text-ink-faint">Member type</span><span className="font-semibold text-ink">{p.insurance.type}</span>
                <span className="text-ink-faint">Expiry</span>
                <span className={`font-semibold ${insExpired ? "text-alert" : "text-ink"}`}>{fmtDate(p.insurance.expiry)} {insExpired && "— expired"}</span>
              </div>
            ) : <p className="text-xs text-ink-faint">No insurance on file — patient is fee-paying.</p>}
          </Card>
          <Card className="p-4">
            <SectionHead title="Emergency Contact" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="text-ink-faint">Name</span><span className="font-semibold text-ink">{p.nextOfKin.name}</span>
              <span className="text-ink-faint">Relation</span><span className="font-semibold text-ink">{p.nextOfKin.relation}</span>
              <span className="text-ink-faint">Phone</span><span className="font-mono font-semibold text-ink">{p.nextOfKin.phone}</span>
            </div>
          </Card>
        </div>
      )}

      {tab === "labs" && (
        <Card className="p-4">
          <SectionHead title="Laboratory Results" right={<Btn variant="ghost" onClick={() => go("lab")}>Open Lab module <IChevR size={13} /></Btn>} />
          <div className="space-y-2">
            {db.labOrders.filter((l) => l.patientMrn === mrn).map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft bg-paper/50 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-info"><IFlask size={15} /></span>
                  <div>
                    <p className="text-xs font-semibold text-ink">{LAB_CATALOG[l.test]?.name ?? l.test} <span className="ml-1 font-mono text-[10px] text-ink-faint">{l.id}</span></p>
                    <p className="text-[10.5px] text-ink-faint">Ordered {fmtDate(l.orderedAt)} · {l.priority} · {ghs(l.price)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.results && l.status === "verified" && (
                    <span className="font-mono text-[10.5px] text-ink-soft">
                      {l.results.filter((r) => r.flag !== "-").slice(0, 2).map((r) => `${r.marker} ${r.value}`).join(" · ") || "All within range"}
                    </span>
                  )}
                  <StatusPill s={l.status} />
                </div>
              </div>
            ))}
            {db.labOrders.filter((l) => l.patientMrn === mrn).length === 0 && <Empty icon={<IFlask size={24} />} title="No lab orders" sub="Orders placed during consultations appear here." />}
          </div>
        </Card>
      )}

      {tab === "rx" && (
        <Card className="p-4">
          <SectionHead title="Prescriptions" right={<Btn variant="ghost" onClick={() => go("pharmacy")}>Open Pharmacy <IChevR size={13} /></Btn>} />
          <div className="space-y-3">
            {db.rxOrders.filter((r) => r.patientMrn === mrn).map((r) => (
              <div key={r.id} className="rounded-lg border border-line-soft p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink">{r.id} <span className="ml-1 font-mono text-[10px] font-normal text-ink-faint">{db.staff.find((s) => s.id === r.doctorId)?.name} · {fmtDate(r.date)}</span></p>
                  <StatusPill s={r.status} />
                </div>
                <div className="mt-2 space-y-1">
                  {r.items.map((i) => (
                    <p key={i.medId} className="text-xs text-ink-soft">
                      <span className="font-semibold text-ink">{i.name}</span> — {i.dose} · {i.freq} · {i.duration} <span className="font-mono text-[10px] text-ink-faint">(×{i.qty})</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {db.rxOrders.filter((r) => r.patientMrn === mrn).length === 0 && <Empty icon={<IPill size={24} />} title="No prescriptions" />}
          </div>
        </Card>
      )}

      {tab === "bills" && (
        <Card className="p-4">
          <SectionHead title="Invoices & Payments" right={<Btn variant="ghost" onClick={() => go("billing")}>Open Billing <IChevR size={13} /></Btn>} />
          <div className="space-y-2">
            {db.invoices.filter((i) => i.patientMrn === mrn).map((inv) => (
              <div key={inv.id} className="rounded-lg border border-line-soft p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-bold text-ink">{inv.id} <span className="ml-1 font-normal text-ink-faint">{fmtDate(inv.date)}</span></p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink">{ghs(invTotal(inv.items))}</span>
                    <StatusPill s={inv.status} />
                  </div>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {inv.items.map((it, i) => (
                    <p key={i} className="flex justify-between text-[11px] text-ink-soft"><span>{it.desc}</span><span className="font-mono">{ghs(it.amount)}</span></p>
                  ))}
                </div>
              </div>
            ))}
            {db.invoices.filter((i) => i.patientMrn === mrn).length === 0 && <Empty icon={<IReceipt size={24} />} title="No invoices yet" sub="Consultations, labs and dispensed drugs are billed automatically." />}
          </div>
        </Card>
      )}

      {tab === "vitals" && (
        <Card className="p-4">
          <SectionHead title="Vital Signs History" sub="Recorded by nurses and during consultations" right={canVitals && <Btn variant="soft" onClick={() => setShowVitals(true)}><IPlus size={13} /> Record</Btn>} />
          {allVitals.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="py-2 pr-3 font-semibold">Taken</th>
                    <th className="py-2 pr-3 font-semibold">Temp</th>
                    <th className="py-2 pr-3 font-semibold">BP</th>
                    <th className="py-2 pr-3 font-semibold">Pulse</th>
                    <th className="py-2 pr-3 font-semibold">Resp</th>
                    <th className="py-2 pr-3 font-semibold">SpO₂</th>
                    <th className="py-2 pr-3 font-semibold">Wt/Ht</th>
                    <th className="py-2 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody>
                  {allVitals.map((v, i) => (
                    <tr key={i} className="border-b border-line-soft/70 last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-ink-soft">{fmtDate(v.takenAt)} {fmtTime(v.takenAt)}</td>
                      <td className={`py-2.5 pr-3 font-mono font-semibold ${v.temp >= 37.5 ? "text-alert" : "text-ink"}`}>{v.temp}°C</td>
                      <td className={`py-2.5 pr-3 font-mono font-semibold ${v.bpSys >= 140 ? "text-alert" : "text-ink"}`}>{v.bpSys}/{v.bpDia}</td>
                      <td className="py-2.5 pr-3 font-mono text-ink">{v.pulse} bpm</td>
                      <td className="py-2.5 pr-3 font-mono text-ink">{v.resp}/min</td>
                      <td className={`py-2.5 pr-3 font-mono font-semibold ${v.spo2 < 94 ? "text-alert" : "text-ink"}`}>{v.spo2}%</td>
                      <td className="py-2.5 pr-3 font-mono text-ink-faint">{v.weight ? `${v.weight}kg` : "—"}{v.height ? ` / ${v.height}cm` : ""}</td>
                      <td className="py-2.5 text-ink-faint">{v.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={<IActivity size={24} />} title="No vitals recorded" />}
        </Card>
      )}

      {showConsult && <ConsultModal patient={p} onClose={() => setShowConsult(false)} />}
      {showVitals && <VitalsModal patient={p} onClose={() => setShowVitals(false)} />}
      {showBill && <ChargeModal patient={p} onClose={() => setShowBill(false)} />}
    </div>
  );
}

/* ================= consultation (EMR) ================= */

function ConsultModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { db, user, mutate, toast } = useStore();
  const doctors = db.staff.filter((s) => s.role === "doctor" && s.active);
  const [f, setF] = useState({
    doctorId: user?.role === "doctor" ? user.id : doctors[0]?.id ?? "",
    complaint: "", examination: "", diagnosis: "", treatment: "", notes: "", followUp: "",
    temp: "37.0", bpSys: "120", bpDia: "80", pulse: "78", resp: "16", spo2: "98", weight: "", height: "",
  });
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [labs, setLabs] = useState<Record<string, boolean>>({});
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [rxRows, setRxRows] = useState<{ medId: string; qty: string; dose: string; freq: string; duration: string }[]>([]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const addRxRow = () => setRxRows((r) => [...r, { medId: db.medicines.find((m) => m.stock > 0)?.id ?? "", qty: "30", dose: "1 tab", freq: FREQS[1], duration: "7 days" }]);

  const save = () => {
    if (!f.complaint.trim() || !f.diagnosis) {
      toast("Chief complaint and diagnosis are required", "danger");
      return;
    }
    const selLabs = Object.entries(labs).filter(([, v]) => v).map(([k]) => k);
    const validRx = rxRows.filter((r) => r.medId && parseInt(r.qty) > 0);

    mutate(
      (d) => {
        const conId = nid("CON", d.consultations.map((c) => c.id));
        const vitals: Vitals = {
          temp: parseFloat(f.temp) || 37, bpSys: parseInt(f.bpSys) || 120, bpDia: parseInt(f.bpDia) || 80,
          pulse: parseInt(f.pulse) || 78, resp: parseInt(f.resp) || 16, spo2: parseInt(f.spo2) || 98,
          weight: f.weight ? parseFloat(f.weight) : undefined, height: f.height ? parseFloat(f.height) : undefined,
          takenAt: nowISO(), by: user?.name ?? "—",
        };
        const labIds: string[] = [];
        selLabs.forEach((t) => {
          const id = nid("LAB", d.labOrders.map((l) => l.id).concat(labIds));
          labIds.push(id);
          d.labOrders.unshift({
            id, patientMrn: patient.mrn, doctorId: f.doctorId, test: t, priority,
            orderedAt: nowISO(), status: "ordered", price: LAB_CATALOG[t].price,
          });
          charge(d, patient.mrn, { desc: `Lab: ${LAB_CATALOG[t].name}`, amount: LAB_CATALOG[t].price, kind: "lab" });
        });

        let rxId: string | undefined;
        if (validRx.length) {
          rxId = nid("RX", d.rxOrders.map((r) => r.id));
          d.rxOrders.unshift({
            id: rxId, patientMrn: patient.mrn, doctorId: f.doctorId, date: nowISO(), status: "pending",
            items: validRx.map((r) => {
              const med = d.medicines.find((m) => m.id === r.medId)!;
              return { medId: med.id, name: med.name, qty: parseInt(r.qty), dose: r.dose, freq: r.freq, duration: r.duration, unitPrice: med.sellPrice };
            }),
          });
        }

        const doctor = d.staff.find((s) => s.id === f.doctorId);
        const fee = doctor && ["Cardiology", "Surgery", "Internal Medicine", "Obstetrics & Gynaecology"].includes(doctor.dept) ? 150 : 100;
        charge(d, patient.mrn, { desc: `Consultation — ${doctor?.name ?? ""}`, amount: fee, kind: "consultation" });

        d.consultations.unshift({
          id: conId, patientMrn: patient.mrn, doctorId: f.doctorId, date: nowISO(),
          complaint: f.complaint.trim(), symptoms, vitals, examination: f.examination.trim(),
          diagnosis: f.diagnosis, treatment: f.treatment.trim(), notes: f.notes.trim(),
          followUp: f.followUp || undefined, rxId, labIds,
        });

        const today = todayISO();
        const appt = d.appointments.find(
          (a) => a.patientMrn === patient.mrn && a.doctorId === f.doctorId && a.date === today &&
            (a.status === "checked-in" || a.status === "in-consultation")
        );
        if (appt) appt.status = "completed";
      },
      {
        audit: `Completed consultation for ${patient.name} (${patient.mrn}) — Dx: ${f.diagnosis}`,
        notify: selLabs.length
          ? { text: `${selLabs.length} new lab order(s) for ${patient.name} (${patient.mrn})`, icon: "lab", roles: ["lab", "admin"] }
          : { text: `Consultation completed for ${patient.name} by ${db.staff.find((s) => s.id === f.doctorId)?.name}`, icon: "alert", roles: ["reception", "billing", "admin"] },
      }
    );
    if (validRx.length) toast("Prescription sent instantly to Pharmacy", "info");
    if (selLabs.length) toast(`${selLabs.length} lab order(s) routed to Laboratory`, "info");
    toast(`Consultation saved — charges added to ${patient.name}'s bill automatically`, "ok");
    onClose();
  };

  return (
    <Modal title={`Consultation — ${patient.name}`} sub={`${patient.mrn} · ${ageFrom(patient.dob)}y · ${patient.gender} · allergies: ${patient.allergies.filter((a) => a !== "None known").join(", ") || "none"}`} onClose={onClose} w="max-w-3xl"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn size="md" onClick={save}><ICheck size={14} /> Save consultation</Btn>
      </>}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Attending doctor">
            <Select value={f.doctorId} onChange={(e) => set("doctorId", e.target.value)}>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
            </Select>
          </Field>
          <Field label="Follow-up date">
            <Input type="date" value={f.followUp} onChange={(e) => set("followUp", e.target.value)} />
          </Field>
        </div>

        <Field label="Chief complaint *"><Input value={f.complaint} onChange={(e) => set("complaint", e.target.value)} placeholder="e.g. Fever and chills for 3 days" /></Field>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => (
              <button key={s} onClick={() => setSymptoms((x) => x.includes(s) ? x.filter((y) => y !== s) : [...x, s])}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${symptoms.includes(s) ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft hover:border-med-300"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Vital signs</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Field label="Temp °C"><Input value={f.temp} onChange={(e) => set("temp", e.target.value)} /></Field>
            <Field label="BP sys"><Input value={f.bpSys} onChange={(e) => set("bpSys", e.target.value)} /></Field>
            <Field label="BP dia"><Input value={f.bpDia} onChange={(e) => set("bpDia", e.target.value)} /></Field>
            <Field label="Pulse"><Input value={f.pulse} onChange={(e) => set("pulse", e.target.value)} /></Field>
            <Field label="Resp /min"><Input value={f.resp} onChange={(e) => set("resp", e.target.value)} /></Field>
            <Field label="SpO₂ %"><Input value={f.spo2} onChange={(e) => set("spo2", e.target.value)} /></Field>
            <Field label="Weight kg"><Input value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
            <Field label="Height cm"><Input value={f.height} onChange={(e) => set("height", e.target.value)} /></Field>
          </div>
        </div>

        <Field label="Physical examination"><Textarea value={f.examination} onChange={(e) => set("examination", e.target.value)} placeholder="Findings on examination…" /></Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Diagnosis *">
            <Select value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)}>
              <option value="">Select diagnosis…</option>
              {COMMON_DIAGNOSES.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Treatment plan"><Input value={f.treatment} onChange={(e) => set("treatment", e.target.value)} placeholder="e.g. Full course AL, rest, fluids" /></Field>
        </div>

        {/* lab orders */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold text-sky-900"><IFlask size={14} /> Order laboratory tests <span className="font-normal text-sky-700">(auto-billed, routed to Lab)</span></p>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="w-auto py-1 text-xs">
              <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Object.entries(LAB_CATALOG).map(([k, v]) => (
              <label key={k} className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${labs[k] ? "border-sky-500 bg-white text-sky-900 shadow-sm" : "border-sky-200 bg-white/60 text-ink-soft hover:border-sky-400"}`}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={!!labs[k]} onChange={(e) => setLabs((x) => ({ ...x, [k]: e.target.checked }))} className="accent-sky-600" />
                  {v.name}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">{ghs(v.price)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* prescription */}
        <div className="rounded-xl border border-med-200 bg-med-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold text-med-800"><IPill size={14} /> Electronic prescription <span className="font-normal text-med-600">(pharmacy receives instantly)</span></p>
            <Btn variant="soft" size="xs" onClick={addRxRow}><IPlus size={12} /> Add drug</Btn>
          </div>
          {rxRows.map((r, i) => {
            const med = db.medicines.find((m) => m.id === r.medId);
            return (
              <div key={i} className="mb-1.5 grid grid-cols-[1fr_64px_84px_1fr_1fr_28px] items-center gap-1.5 rounded-lg border border-med-200 bg-white p-1.5">
                <Select value={r.medId} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, medId: e.target.value } : y))} className="py-1 text-xs">
                  {db.medicines.filter((m) => m.stock > 0).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.stock} in stock</option>)}
                </Select>
                <Input value={r.qty} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, qty: e.target.value } : y))} className="py-1 text-xs" />
                <Input value={r.dose} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, dose: e.target.value } : y))} className="py-1 text-xs" />
                <Select value={r.freq} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, freq: e.target.value } : y))} className="py-1 text-xs">
                  {FREQS.map((fq) => <option key={fq}>{fq}</option>)}
                </Select>
                <Input value={r.duration} onChange={(e) => setRxRows((x) => x.map((y, j) => j === i ? { ...y, duration: e.target.value } : y))} className="py-1 text-xs" />
                <button onClick={() => setRxRows((x) => x.filter((_, j) => j !== i))} className="text-ink-faint hover:text-alert"><IX size={13} /></button>
                {med && <span className="col-span-6 -mt-0.5 px-1 font-mono text-[9.5px] text-ink-faint">Unit price {ghs(med.sellPrice)} · total {ghs(med.sellPrice * (parseInt(r.qty) || 0))} — billed on dispensing</span>}
              </div>
            );
          })}
          {rxRows.length === 0 && <p className="py-1 text-center text-[11px] text-ink-faint">No drugs added — click “Add drug” to prescribe.</p>}
        </div>

        <Field label="Doctor's notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Advice, warnings, safety-netting…" /></Field>
      </div>
    </Modal>
  );
}

/* ================= vitals ================= */

function VitalsModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { user, mutate, toast } = useStore();
  const [f, setF] = useState({ temp: "37.0", bpSys: "120", bpDia: "80", pulse: "78", resp: "16", spo2: "98", weight: "", height: "" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    const v: Vitals = {
      temp: parseFloat(f.temp) || 0, bpSys: parseInt(f.bpSys) || 0, bpDia: parseInt(f.bpDia) || 0,
      pulse: parseInt(f.pulse) || 0, resp: parseInt(f.resp) || 0, spo2: parseInt(f.spo2) || 0,
      weight: f.weight ? parseFloat(f.weight) : undefined, height: f.height ? parseFloat(f.height) : undefined,
      takenAt: nowISO(), by: user?.name ?? "—",
    };
    mutate(
      (d) => d.vitalsLog.unshift({ patientMrn: patient.mrn, v }),
      {
        audit: `Recorded vitals for ${patient.name} — BP ${v.bpSys}/${v.bpDia}, T ${v.temp}°C`,
        notify: { text: `New vitals for ${patient.name} (${patient.mrn}) — BP ${v.bpSys}/${v.bpDia}, SpO₂ ${v.spo2}%`, icon: "vitals", roles: ["doctor", "admin"] },
      }
    );
    toast(`Vitals saved for ${patient.name} — doctor notified`, "ok");
    onClose();
  };
  return (
    <Modal title={`Record Vitals — ${patient.name}`} sub="Saved to the patient chart and visible to the care team instantly" onClose={onClose} w="max-w-lg"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><ICheck size={14} /> Save vitals</Btn></>}>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Temp °C"><Input value={f.temp} onChange={(e) => set("temp", e.target.value)} /></Field>
        <Field label="BP systolic"><Input value={f.bpSys} onChange={(e) => set("bpSys", e.target.value)} /></Field>
        <Field label="BP diastolic"><Input value={f.bpDia} onChange={(e) => set("bpDia", e.target.value)} /></Field>
        <Field label="Pulse bpm"><Input value={f.pulse} onChange={(e) => set("pulse", e.target.value)} /></Field>
        <Field label="Resp /min"><Input value={f.resp} onChange={(e) => set("resp", e.target.value)} /></Field>
        <Field label="SpO₂ %"><Input value={f.spo2} onChange={(e) => set("spo2", e.target.value)} /></Field>
        <Field label="Weight kg"><Input value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
        <Field label="Height cm"><Input value={f.height} onChange={(e) => set("height", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/* ================= quick charge ================= */

function ChargeModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { mutate, toast } = useStore();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"other" | "procedure" | "bed">("other");
  const save = () => {
    const amt = parseFloat(amount);
    if (!desc.trim() || !amt || amt <= 0) {
      toast("Enter a description and a valid amount", "danger");
      return;
    }
    mutate(
      (d) => charge(d, patient.mrn, { desc: desc.trim(), amount: amt, kind }),
      { audit: `Added ${ghs(amt)} charge to ${patient.name}'s bill — ${desc}` }
    );
    toast(`Charge added — ${patient.name}'s open invoice updated`, "ok");
    onClose();
  };
  return (
    <Modal title={`Add Charge — ${patient.name}`} sub="Appends to today's open invoice (auto-created if none)" onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IReceipt size={14} /> Add to bill</Btn></>}>
      <div className="space-y-3">
        <Field label="Description"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Wound dressing" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (GH₵)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Category">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="other">Other service</option><option value="procedure">Procedure</option><option value="bed">Bed charge</option>
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
