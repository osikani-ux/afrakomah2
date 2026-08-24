import { useEffect, useState } from "react";
import { useStore, nid, charge } from "../store";
import { wardOf, fmtTime, ghs, nowISO } from "../data";
import type { EmergencyCase, TriageLevel } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, Select, StatusPill, Textarea, Avatar } from "../ui";
import { IZap, IPlus, IClock, ICheck, IBed, IStetho, IActivity } from "../icons";

const TRIAGE: Record<TriageLevel, { label: string; chip: string; col: string; bar: string; desc: string }> = {
  critical: { label: "Critical — Red", chip: "bg-red-600 text-white", col: "border-red-300 bg-red-50/60", bar: "bg-red-600", desc: "Immediate — resus bay" },
  urgent: { label: "Urgent — Orange", chip: "bg-orange-500 text-white", col: "border-orange-300 bg-orange-50/60", bar: "bg-orange-500", desc: "Seen within 15 min" },
  moderate: { label: "Moderate — Yellow", chip: "bg-yellow-400 text-yellow-950", col: "border-yellow-300 bg-yellow-50/60", bar: "bg-yellow-400", desc: "Seen within 45 min" },
  stable: { label: "Stable — Green", chip: "bg-emerald-500 text-white", col: "border-emerald-300 bg-emerald-50/60", bar: "bg-emerald-500", desc: "Seen within 90 min" },
};

export default function EmergencyView() {
  const { db, user, mutate, toast } = useStore();
  const [, tick] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [actionFor, setActionFor] = useState<EmergencyCase | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const canWork = user?.role === "doctor" || user?.role === "nurse" || user?.role === "admin";
  const active = db.emergencies.filter((e) => e.status === "waiting" || e.status === "in-treatment");
  const waitMins = active.map((e) => Math.floor((Date.now() - new Date(e.arrival).getTime()) / 60000));
  const avgWait = waitMins.length ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0;

  const startTreatment = (c: EmergencyCase) => {
    const p = db.patients.find((x) => x.mrn === c.patientMrn);
    mutate(
      (d) => {
        const e = d.emergencies.find((x) => x.id === c.id)!;
        e.status = "in-treatment";
        if (!e.doctorId) e.doctorId = user?.id;
      },
      { audit: `Started treatment on ${c.id} (${p?.name})`, notify: { text: `Emergency ${c.id} in treatment — ${p?.name}`, icon: "alert", roles: ["admin", "doctor", "nurse"] } }
    );
    toast(`Treatment started for ${p?.name}`, "ok");
  };

  const quickAdmit = (c: EmergencyCase) => {
    const free = db.beds.find((b) => b.status === "available");
    if (!free) {
      toast("No free beds — transfer or discharge required first", "danger");
      return;
    }
    const p = db.patients.find((x) => x.mrn === c.patientMrn);
    const daily = wardOf(db.wards, free.ward).daily;
    mutate(
      (d) => {
        const e = d.emergencies.find((x) => x.id === c.id)!;
        e.status = "admitted";
        e.disposition = `Admitted to bed ${free.id}`;
        const b = d.beds.find((x) => x.id === free.id)!;
        b.status = "occupied";
        b.patientMrn = c.patientMrn;
        const pat = d.patients.find((x) => x.mrn === c.patientMrn)!;
        pat.status = "admitted";
        d.admissions.unshift({
          id: nid("ADM", d.admissions.map((a) => a.id)), patientMrn: c.patientMrn, bedId: free.id,
          doctorId: c.doctorId ?? user?.id ?? "D-07", date: nowISO(),
          diagnosis: `Emergency admission — ${c.symptoms.slice(0, 60)}`, status: "active", dailyCharge: daily, notes: [],
        });
        charge(d, c.patientMrn, { desc: "Emergency assessment & stabilisation", amount: 200, kind: "consultation" });
      },
      { audit: `Emergency admission: ${p?.name} → bed ${free.id}`, notify: { text: `Bed ${free.id} occupied — emergency admission ${p?.name}`, icon: "bed", roles: ["admin", "nurse", "billing"] } }
    );
    toast(`${p?.name} admitted to ${free.id} from Emergency`, "ok");
    setActionFor(null);
  };

  const dischargeCase = (c: EmergencyCase) => {
    const p = db.patients.find((x) => x.mrn === c.patientMrn);
    mutate(
      (d) => {
        const e = d.emergencies.find((x) => x.id === c.id)!;
        e.status = "discharged";
        e.disposition = "Discharged home with advice";
        const pat = d.patients.find((x) => x.mrn === c.patientMrn);
        if (pat && pat.status === "emergency") pat.status = "outpatient";
      },
      { audit: `Discharged emergency case ${c.id} (${p?.name})` }
    );
    toast(`${p?.name} discharged from Emergency`, "ok");
    setActionFor(null);
  };

  const assignDoctor = (c: EmergencyCase, doctorId: string) => {
    const p = db.patients.find((x) => x.mrn === c.patientMrn);
    const doc = db.staff.find((s) => s.id === doctorId);
    mutate(
      (d) => { d.emergencies.find((x) => x.id === c.id)!.doctorId = doctorId; },
      { audit: `Assigned ${doc?.name} to emergency case ${c.id} (${p?.name})`, notify: { text: `${doc?.name} assigned to ${p?.name} (${c.triage.toUpperCase()} triage)`, icon: "alert", roles: ["doctor", "admin"] } }
    );
    toast(`${doc?.name} assigned to ${p?.name}`, "ok");
    setActionFor(null);
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Emergency Department</h1>
          <p className="text-xs text-ink-faint">Triage board — arrival time, acuity and disposition at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral"><IClock size={11} /> Avg wait {avgWait} min</Badge>
          <Badge tone="danger"><IZap size={11} /> {active.filter((e) => e.triage === "critical").length} critical</Badge>
          {canWork && <Btn onClick={() => setShowNew(true)}><IPlus size={14} /> New arrival</Btn>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(TRIAGE) as TriageLevel[]).map((lvl) => {
          const cases = active.filter((e) => e.triage === lvl);
          return (
            <div key={lvl} className={`rounded-xl border-2 p-3 ${TRIAGE[lvl].col}`}>
              <div className="flex items-center justify-between">
                <span className={`rounded-md px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wider ${TRIAGE[lvl].chip}`}>{TRIAGE[lvl].label}</span>
                <span className="font-mono text-lg font-bold text-ink">{cases.length}</span>
              </div>
              <p className="mt-1 text-[10px] font-medium text-ink-faint">{TRIAGE[lvl].desc}</p>
              <div className="mt-2.5 space-y-2">
                {cases.map((c) => {
                  const p = db.patients.find((x) => x.mrn === c.patientMrn);
                  const mins = Math.floor((Date.now() - new Date(c.arrival).getTime()) / 60000);
                  const doc = c.doctorId ? db.staff.find((s) => s.id === c.doctorId) : null;
                  const overtime = (lvl === "critical" && mins > 0) || (lvl === "urgent" && mins > 15) || (lvl === "moderate" && mins > 45) || (lvl === "stable" && mins > 90);
                  return (
                    <div key={c.id} className={`rounded-lg border bg-white p-2.5 shadow-sm transition-all hover:shadow-md ${overtime ? "border-red-300" : "border-line-soft"}`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-bold text-ink"><Avatar name={p?.name ?? "?"} size={22} />{p?.name}</span>
                        <span className={`flex items-center gap-1 font-mono text-[10px] font-bold ${overtime ? "blink-soft text-alert" : "text-ink-faint"}`}><IClock size={10} />{mins}m</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-ink-soft">{c.symptoms}</p>
                      {c.vitals && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.vitals.bpSys && <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-700">BP {c.vitals.bpSys}/{c.vitals.bpDia}</span>}
                          {c.vitals.pulse && <span className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-soft">HR {c.vitals.pulse}</span>}
                          {c.vitals.spo2 && <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${c.vitals.spo2 < 94 ? "bg-red-50 text-red-700" : "bg-line-soft text-ink-soft"}`}>SpO₂ {c.vitals.spo2}%</span>}
                          {c.vitals.temp && <span className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-soft">{c.vitals.temp}°C</span>}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-[9.5px] text-ink-faint">{doc ? <span className="flex items-center gap-1"><IStetho size={10} className="text-med-500" />{doc.name.replace("Dr. ", "Dr ")}</span> : "Unassigned"}</span>
                        <StatusPill s={c.status} />
                      </div>
                      {canWork && (
                        <div className="mt-2 flex gap-1">
                          {c.status === "waiting" && <Btn variant="soft" size="xs" onClick={() => startTreatment(c)}><IActivity size={11} /> Treat</Btn>}
                          <Btn variant="ghost" size="xs" onClick={() => setActionFor(c)}>Actions</Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
                {cases.length === 0 && <p className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-[10.5px] text-ink-faint">No active cases</p>}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold">Resolved today</h3>
          <Badge tone="ok">{db.emergencies.filter((e) => e.status === "discharged" || e.status === "admitted").length} dispositions</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {db.emergencies.filter((e) => e.status === "discharged" || e.status === "admitted").map((e) => {
            const p = db.patients.find((x) => x.mrn === e.patientMrn);
            return (
              <span key={e.id} className="flex items-center gap-2 rounded-lg border border-line-soft bg-paper/60 px-2.5 py-1.5 text-[11px] text-ink-soft">
                <ICheck size={11} className="text-med-600" /> {p?.name} — {e.disposition ?? e.status}
              </span>
            );
          })}
        </div>
      </Card>

      {showNew && <NewCaseModal onClose={() => setShowNew(false)} />}

      {actionFor && (
        <Modal title={`Case ${actionFor.id}`} sub={`Arrived ${fmtTime(actionFor.arrival)} · ${TRIAGE[actionFor.triage].label}`} onClose={() => setActionFor(null)} w="max-w-md"
          footer={<>
            <Btn variant="ghost" onClick={() => setActionFor(null)}>Close</Btn>
            <Btn variant="soft" onClick={() => quickAdmit(actionFor)}><IBed size={13} /> Admit to first free bed</Btn>
            <Btn onClick={() => dischargeCase(actionFor)}><ICheck size={13} /> Discharge</Btn>
          </>}>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Assign doctor</p>
              <div className="flex flex-wrap gap-1.5">
                {db.staff.filter((s) => s.role === "doctor" && s.status === "on-duty").map((d) => (
                  <button key={d.id} onClick={() => assignDoctor(actionFor, d.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${actionFor.doctorId === d.id ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft hover:border-med-400"}`}>
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-paper/70 p-3 text-xs">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">Presenting symptoms</p>
              <p className="mt-1 leading-snug text-ink">{actionFor.symptoms}</p>
              <p className="mt-2 text-[10px] text-ink-faint">Free beds right now: <span className="font-mono font-bold text-med-700">{db.beds.filter((b) => b.status === "available").length}</span> · admission auto-bills {ghs(200)} emergency assessment.</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NewCaseModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const [patientMrn, setPatientMrn] = useState(db.patients[0]?.mrn ?? "");
  const [triage, setTriage] = useState<TriageLevel>("moderate");
  const [symptoms, setSymptoms] = useState("");
  const [vitals, setVitals] = useState({ bpSys: "", bpDia: "", pulse: "", spo2: "", temp: "" });
  const set = (k: string, val: string) => setVitals((x) => ({ ...x, [k]: val }));

  const save = () => {
    if (!symptoms.trim()) {
      toast("Describe the presenting symptoms", "danger");
      return;
    }
    const p = db.patients.find((x) => x.mrn === patientMrn);
    mutate(
      (d) => {
        const id = nid("EM", d.emergencies.map((e) => e.id));
        d.emergencies.unshift({
          id, patientMrn, arrival: nowISO(), triage, symptoms: symptoms.trim(),
          vitals: {
            bpSys: vitals.bpSys ? parseInt(vitals.bpSys) : undefined, bpDia: vitals.bpDia ? parseInt(vitals.bpDia) : undefined,
            pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined, spo2: vitals.spo2 ? parseInt(vitals.spo2) : undefined,
            temp: vitals.temp ? parseFloat(vitals.temp) : undefined,
          },
          status: "waiting",
        });
        const pat = d.patients.find((x) => x.mrn === patientMrn);
        if (pat && pat.status !== "admitted") pat.status = "emergency";
      },
      { audit: `Triage ${triage.toUpperCase()}: ${p?.name} arrived in Emergency`, notify: { text: `Triage ${triage.toUpperCase()}: ${p?.name} in Emergency — ${symptoms.slice(0, 50)}`, icon: "alert", roles: ["admin", "doctor", "nurse"] } }
    );
    toast(`${p?.name} triaged ${triage.toUpperCase()} — waiting-time clock started`, triage === "critical" ? "danger" : "ok");
    onClose();
  };

  return (
    <Modal title="Emergency Arrival" sub="Triage assessment — colour determines target time to treatment" onClose={onClose} w="max-w-lg"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant={triage === "critical" ? "danger" : "primary"} onClick={save}><IZap size={14} /> Register arrival</Btn></>}>
      <div className="space-y-3">
        <Field label="Patient">
          <Select value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)}>
            {db.patients.map((p) => <option key={p.mrn} value={p.mrn}>{p.name} — {p.mrn}</option>)}
          </Select>
        </Field>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Triage level</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(Object.keys(TRIAGE) as TriageLevel[]).map((l) => (
              <button key={l} onClick={() => setTriage(l)} className={`rounded-lg border-2 px-2 py-2 text-[10.5px] font-bold capitalize transition-all ${triage === l ? TRIAGE[l].chip + " border-transparent" : "border-line bg-white text-ink-soft hover:border-med-300"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Field label="Presenting symptoms *"><Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. Chest pain radiating to left arm, diaphoretic…" /></Field>
        <div className="grid grid-cols-5 gap-2">
          <Field label="BP sys"><Input value={vitals.bpSys} onChange={(e) => set("bpSys", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
          <Field label="BP dia"><Input value={vitals.bpDia} onChange={(e) => set("bpDia", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
          <Field label="Pulse"><Input value={vitals.pulse} onChange={(e) => set("pulse", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
          <Field label="SpO₂"><Input value={vitals.spo2} onChange={(e) => set("spo2", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
          <Field label="Temp"><Input value={vitals.temp} onChange={(e) => set("temp", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        </div>
      </div>
    </Modal>
  );
}
