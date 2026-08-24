import { useEffect, useState } from "react";
import { useStore, nid, charge } from "../store";
import { wardOf, nextBedNo, todayISO, nowISO, fmtDate, fmtTime, ghs } from "../data";
import type { Bed, Vitals } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, Select, StatusPill, SectionHead, Textarea, Avatar } from "../ui";
import { IBed, ICheck, IPlus, IActivity, IAlert, IChevR, IUser, IX } from "../icons";

const BED_STYLE: Record<Bed["status"], string> = {
  available: "border-emerald-300 bg-emerald-50/70 hover:border-emerald-500 hover:shadow-md",
  occupied: "border-med-600 bg-med-600 text-white hover:shadow-md",
  cleaning: "border-amber-300 bg-amber-50 hover:border-amber-500",
  reserved: "border-sky-300 bg-sky-50 hover:border-sky-500",
};

const BED_DOT: Record<Bed["status"], string> = {
  available: "bg-emerald-500", occupied: "bg-mint", cleaning: "bg-amber-500", reserved: "bg-sky-500",
};

export default function WardsView() {
  const { db, user, mutate, toast } = useStore();
  const [ward, setWard] = useState(db.wards[0]?.id ?? "A");
  const [bedModal, setBedModal] = useState<Bed | null>(null);
  const [admModal, setAdmModal] = useState<Bed | null>(null);
  const [addBedOpen, setAddBedOpen] = useState(false);
  const [addWardOpen, setAddWardOpen] = useState(false);
  const [armedRemove, setArmedRemove] = useState<string | null>(null);
  const [nursingFor, setNursingFor] = useState<string>(db.admissions.find((a) => a.status === "active")?.patientMrn ?? "");

  const role = user?.role;
  const canManage = role === "nurse" || role === "doctor" || role === "admin";
  const canRestructure = role === "admin" || role === "nurse";
  const wardCfg = wardOf(db.wards, ward);
  const beds = db.beds.filter((b) => b.ward === ward);
  const counts = (s: Bed["status"]) => db.beds.filter((b) => b.status === s).length;

  /* auto-disarm the remove confirmation after a moment */
  useEffect(() => {
    if (!armedRemove) return;
    const t = window.setTimeout(() => setArmedRemove(null), 2600);
    return () => window.clearTimeout(t);
  }, [armedRemove]);

  const markCleaned = (b: Bed) => {
    mutate(
      (d) => {
        d.beds.find((x) => x.id === b.id)!.status = "available";
      },
      { audit: `Bed ${b.id} cleaned and released`, notify: { text: `Bed ${b.id} (${wardOf(db.wards, b.ward).name}) is now available`, icon: "bed", roles: ["admin", "nurse", "reception"] } }
    );
    toast(`Bed ${b.id} is now available`, "ok");
  };

  const toggleReserve = (b: Bed) => {
    const to = b.status === "reserved" ? "available" : "reserved";
    mutate((d) => { d.beds.find((x) => x.id === b.id)!.status = to; }, { audit: `Bed ${b.id} ${to === "reserved" ? "reserved" : "released"}` });
    toast(`Bed ${b.id} ${to === "reserved" ? "reserved for incoming admission" : "released"}`, "info");
  };

  const removeBed = (b: Bed) => {
    const wn = wardOf(db.wards, b.ward).name;
    mutate(
      (d) => {
        d.beds = d.beds.filter((x) => x.id !== b.id);
      },
      {
        audit: `Removed bed ${b.id} from ${wn} — capacity now ${db.beds.length - 1}`,
        notify: { text: `Bed ${b.id} retired from ${wn}`, icon: "bed", roles: ["admin", "nurse", "reception"] },
      }
    );
    toast(`Bed ${b.id} removed from ${wn}`, "warn");
    setArmedRemove(null);
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Wards & Bed Management</h1>
          <p className="text-xs text-ink-faint">Real-time capacity across {db.beds.length} beds — occupied, reserved, cleaning and available</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-ink-soft"><i className={`h-2 w-2 rounded-full ${BED_DOT.available}`} /> Available {counts("available")}</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-ink-soft"><i className={`h-2 w-2 rounded-full bg-med-600`} /> Occupied {counts("occupied")}</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-ink-soft"><i className={`h-2 w-2 rounded-full ${BED_DOT.cleaning}`} /> Cleaning {counts("cleaning")}</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-ink-soft"><i className={`h-2 w-2 rounded-full ${BED_DOT.reserved}`} /> Reserved {counts("reserved")}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-1.5">
        {db.wards.map((w) => {
          const total = db.beds.filter((b) => b.ward === w.id).length;
          const free = db.beds.filter((b) => b.ward === w.id && b.status === "available").length;
          return (
            <button key={w.id} onClick={() => setWard(w.id)} className={`rounded-xl border px-4 py-2.5 text-left transition-all active:scale-[0.98] ${ward === w.id ? "border-pine-800 bg-pine-900 text-white shadow-md shadow-pine-900/20" : "border-line bg-white text-ink-soft hover:-translate-y-0.5 hover:border-med-300 hover:shadow-sm"}`}>
              <p className="text-[11px] font-bold">{w.name}</p>
              <p className={`font-mono text-[10px] ${ward === w.id ? "text-mint" : "text-ink-faint"}`}>{free}/{total} free · {ghs(w.daily)}/night</p>
            </button>
          );
        })}
        {canRestructure && (
          <button onClick={() => setAddWardOpen(true)} className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-2.5 text-[11px] font-bold text-ink-faint transition-all hover:border-med-400 hover:text-med-700 active:scale-[0.98]">
            <IPlus size={13} /> New ward
          </button>
        )}
      </div>

      {/* bed map */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {wardCfg.name} · <span className="font-mono text-med-700">{beds.length} beds</span> · charge {ghs(wardCfg.daily)}/night
          </p>
          {canRestructure && (
            <Btn variant="soft" size="xs" onClick={() => setAddBedOpen(true)}><IPlus size={12} /> Add bed to {wardCfg.id}</Btn>
          )}
        </div>
        {beds.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-line px-4 py-10 text-center">
            <IBed size={22} className="mx-auto text-ink-faint" />
            <p className="mt-2 font-display text-sm font-bold text-ink-soft">No beds in this ward yet</p>
            <p className="mt-1 text-xs text-ink-faint">Add the first bed to start admitting patients here.</p>
            {canRestructure && <Btn className="mt-3" onClick={() => setAddBedOpen(true)}><IPlus size={13} /> Add bed {nextBedNo(ward, db.beds)}</Btn>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {beds.map((b) => {
            const p = b.patientMrn ? db.patients.find((x) => x.mrn === b.patientMrn) : null;
            return (
              <div key={b.id} className={`relative rounded-xl border-2 p-3 transition-all ${BED_STYLE[b.status]}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm font-bold ${b.status === "occupied" ? "text-white" : "text-ink"}`}>{b.id}</span>
                  <span className={`h-2 w-2 rounded-full ${BED_DOT[b.status]} ${b.status === "occupied" ? "live-dot" : ""}`} />
                </div>
                <p className={`mt-1 min-h-[30px] text-[10.5px] leading-tight ${b.status === "occupied" ? "text-white/85" : "text-ink-soft"}`}>
                  {b.status === "available" && "Available"}
                  {b.status === "cleaning" && "Being cleaned"}
                  {b.status === "reserved" && "Reserved"}
                  {b.status === "occupied" && (<span className="font-semibold">{p?.name}<span className="block font-mono text-[9px] opacity-70">{b.patientMrn}</span></span>)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.status === "available" && canManage && <Btn variant="soft" size="xs" onClick={() => setAdmModal(b)}><IPlus size={11} /> Admit</Btn>}
                  {b.status === "occupied" && <Btn variant={b.status === "occupied" ? "dark" : "soft"} size="xs" onClick={() => setBedModal(b)}><IUser size={11} /> View</Btn>}
                  {b.status === "cleaning" && canManage && <Btn variant="soft" size="xs" onClick={() => markCleaned(b)}><ICheck size={11} /> Cleaned</Btn>}
                  {(b.status === "available" || b.status === "reserved") && canManage && (
                    <Btn variant="ghost" size="xs" onClick={() => toggleReserve(b)}>{b.status === "reserved" ? "Release" : "Reserve"}</Btn>
                  )}
                  {b.status !== "occupied" && canRestructure && (
                    <button
                      onClick={() => (armedRemove === b.id ? removeBed(b) : setArmedRemove(b.id))}
                      title="Remove this bed"
                      className={`ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                        armedRemove === b.id ? "blink-soft bg-alert text-white" : "text-ink-faint/70 hover:bg-red-50 hover:text-alert"
                      }`}
                    >
                      <IX size={10} /> {armedRemove === b.id ? "Sure?" : ""}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* admissions */}
        <Card className="p-4">
          <SectionHead title="Active Admissions" sub={`${db.admissions.filter((a) => a.status === "active").length} patients currently in wards`} />
          <div className="space-y-2">
            {db.admissions.filter((a) => a.status === "active").map((a) => {
              const p = db.patients.find((x) => x.mrn === a.patientMrn);
              const doc = db.staff.find((s) => s.id === a.doctorId);
              const nights = Math.max(1, Math.round((Date.now() - new Date(a.date).getTime()) / 86400000));
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft bg-paper/50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p?.name ?? "?"} size={30} />
                    <div>
                      <p className="text-xs font-bold text-ink">{p?.name} <span className="ml-1 font-mono text-[9.5px] font-normal text-ink-faint">{a.patientMrn} · bed {a.bedId}</span></p>
                      <p className="text-[10.5px] text-ink-faint">{a.diagnosis} · {doc?.name} · day {nights} ({ghs(a.dailyCharge * nights)})</p>
                    </div>
                  </div>
                  <Btn variant="ghost" size="xs" onClick={() => setNursingFor(a.patientMrn)}>Nursing <IChevR size={11} /></Btn>
                </div>
              );
            })}
          </div>
        </Card>

        {/* nursing station */}
        <NursingPanel patientMrn={nursingFor} setPatientMrn={setNursingFor} />
      </div>

      {bedModal && <OccupiedModal bed={bedModal} onClose={() => setBedModal(null)} />}
      {admModal && <AdmitModal bed={admModal} onClose={() => setAdmModal(null)} />}
      {addBedOpen && <AddBedModal wardId={ward} onClose={() => setAddBedOpen(false)} />}
      {addWardOpen && <AddWardModal onClose={() => { setAddWardOpen(false); }} onCreated={(id) => setWard(id)} />}
    </div>
  );
}

/* ---------------- add a bed (nurse / admin) ---------------- */

function AddBedModal({ wardId, onClose }: { wardId: string; onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const [bedId, setBedId] = useState(nextBedNo(wardId, db.beds));
  const [count, setCount] = useState("1");
  const [err, setErr] = useState<string | null>(null);
  const wn = wardOf(db.wards, wardId).name;

  const save = () => {
    const n = Math.min(20, Math.max(1, parseInt(count) || 1));
    const ids: string[] = [];
    let base = bedId.trim().toUpperCase();
    if (!base || !/^[A-Z0-9]+-\d+$/.test(base)) {
      setErr("Use the ward code + number format, e.g. A-07.");
      return;
    }
    const [prefix, numStr] = base.split("-");
    let num = parseInt(numStr, 10);
    for (let i = 0; i < n; i++) {
      ids.push(`${prefix}-${String(num + i).padStart(2, "0")}`);
    }
    const clash = ids.find((id) => db.beds.some((b) => b.id === id));
    if (clash) {
      setErr(`Bed ${clash} already exists — pick the next free number (${nextBedNo(wardId, db.beds)}).`);
      return;
    }
    mutate(
      (d) => {
        ids.forEach((id) => d.beds.push({ id, ward: wardId, status: "available" }));
      },
      {
        audit: `Added ${ids.length} bed(s) to ${wn}: ${ids.join(", ")} — capacity now ${db.beds.length + ids.length}`,
        notify: { text: `${ids.length} new bed(s) available in ${wn} (${ids[0]}${ids.length > 1 ? ` +${ids.length - 1}` : ""})`, icon: "bed", roles: ["admin", "nurse", "reception"] },
      }
    );
    toast(`${ids.length} bed(s) added to ${wn}`, "ok");
    onClose();
  };

  return (
    <Modal title={`Add beds — ${wn}`} sub="New beds open as Available and appear on the map immediately" onClose={onClose} w="max-w-sm"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IBed size={14} /> Add bed(s)</Btn></>}>
      <div className="space-y-3">
        <Field label="First bed number" hint={err ?? undefined}>
          <Input value={bedId} onChange={(e) => { setBedId(e.target.value); setErr(null); }} className="font-mono uppercase" />
        </Field>
        <Field label="How many beds">
          <div className="flex items-center gap-1.5">
            {[1, 2, 4, 6].map((c) => (
              <button key={c} onClick={() => setCount(String(c))}
                className={`rounded-lg border px-3.5 py-1.5 font-mono text-xs font-bold transition-all active:scale-95 ${count === String(c) ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft hover:border-med-300"}`}>
                {c}
              </button>
            ))}
            <Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} className="w-20 font-mono" />
          </div>
        </Field>
        <p className="rounded-lg bg-paper/70 px-3 py-2 text-[10.5px] text-ink-faint">
          {wn} will hold <span className="font-mono font-bold text-med-700">{db.beds.filter((b) => b.ward === wardId).length + Math.min(20, Math.max(1, parseInt(count) || 1))}</span> beds
          · nightly charge {ghs(wardOf(db.wards, wardId).daily)} applies on admission.
        </p>
      </div>
    </Modal>
  );
}

/* ---------------- add a whole ward (nurse / admin) ---------------- */

function AddWardModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { db, mutate, toast } = useStore();
  const nextLetter = "ABCDEFGHIJ".split("").find((l) => !db.wards.some((w) => w.id === l)) ?? "W";
  const [f, setF] = useState({ id: nextLetter, name: "", daily: "180", beds: "6" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    const id = f.id.trim().toUpperCase();
    if (!id || !/^[A-Z0-9]{1,3}$/.test(id)) {
      setErr("Ward code must be 1–3 letters or digits, e.g. E.");
      return;
    }
    if (db.wards.some((w) => w.id === id)) {
      setErr(`Ward ${id} already exists.`);
      return;
    }
    if (!f.name.trim()) {
      setErr("Give the ward a name, e.g. ICU.");
      return;
    }
    const daily = Math.max(0, parseFloat(f.daily) || 0);
    const n = Math.min(30, Math.max(0, parseInt(f.beds) || 0));
    mutate(
      (d) => {
        d.wards.push({ id, name: f.name.trim(), daily });
        for (let i = 1; i <= n; i++) {
          d.beds.push({ id: `${id}-${String(i).padStart(2, "0")}`, ward: id, status: "available" });
        }
      },
      {
        audit: `Opened new ward “${f.name.trim()}” (${id}) with ${n} beds at ${ghs(daily)}/night`,
        notify: { text: `New ward open: ${f.name.trim()} — ${n} beds available`, icon: "bed", roles: ["admin", "nurse", "reception", "doctor"] },
      }
    );
    toast(`Ward “${f.name.trim()}” opened with ${n} beds`, "ok");
    onCreated(id);
    onClose();
  };

  return (
    <Modal title="Open a New Ward" sub="Creates the ward and its starting bed line in one step" onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IPlus size={14} /> Open ward</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ward code *" hint={err ?? undefined}>
          <Input value={f.id} onChange={(e) => { set("id", e.target.value); setErr(null); }} className="font-mono uppercase" maxLength={3} />
        </Field>
        <Field label="Ward name *"><Input value={f.name} onChange={(e) => { set("name", e.target.value); setErr(null); }} placeholder="e.g. Intensive Care" /></Field>
        <Field label="Nightly charge (GH₵)"><Input type="number" min={0} step="0.01" value={f.daily} onChange={(e) => set("daily", e.target.value)} className="font-mono" /></Field>
        <Field label="Starting beds"><Input type="number" min={0} max={30} value={f.beds} onChange={(e) => set("beds", e.target.value)} className="font-mono" /></Field>
      </div>
      <p className="mt-3 rounded-lg bg-paper/70 px-3 py-2 text-[10.5px] leading-relaxed text-ink-faint">
        Beds will be numbered <span className="font-mono font-bold text-med-700">{f.id.trim().toUpperCase() || "?"}-01 … {f.id.trim().toUpperCase() || "?"}-{String(Math.min(30, Math.max(0, parseInt(f.beds) || 0))).padStart(2, "0")}</span>.
        You can add or retire individual beds any time from the bed map.
      </p>
    </Modal>
  );
}

function OccupiedModal({ bed, onClose }: { bed: Bed; onClose: () => void }) {
  const { db, user, mutate, toast } = useStore();
  const adm = db.admissions.find((a) => a.bedId === bed.id && a.status === "active");
  const p = db.patients.find((x) => x.mrn === bed.patientMrn);
  const [note, setNote] = useState("");
  const canManage = user?.role === "nurse" || user?.role === "doctor" || user?.role === "admin";

  const discharge = () => {
    if (!adm) return;
    const nights = Math.max(1, Math.round((Date.now() - new Date(adm.date).getTime()) / 86400000));
    const bedCharge = nights * adm.dailyCharge;
    mutate(
      (d) => {
        const a = d.admissions.find((x) => x.id === adm.id)!;
        a.status = "discharged";
        a.dischargeDate = nowISO();
        const b = d.beds.find((x) => x.id === bed.id)!;
        b.status = "cleaning";
        b.patientMrn = undefined;
        const pat = d.patients.find((x) => x.mrn === adm.patientMrn)!;
        pat.status = "discharged";
        charge(d, adm.patientMrn, { desc: `Bed charges — ${bed.id} ×${nights} night(s)`, amount: bedCharge, kind: "bed" });
      },
      {
        audit: `Discharged ${p?.name} from bed ${bed.id} — ${ghs(bedCharge)} bed charges billed`,
        notify: { text: `Bed ${bed.id} released (cleaning) after discharge of ${p?.name}`, icon: "bed", roles: ["admin", "nurse", "reception"] },
      }
    );
    toast(`${p?.name} discharged — ${ghs(bedCharge)} added to bill, bed sent to cleaning`, "ok");
    onClose();
  };

  const addNote = () => {
    if (!note.trim() || !adm) return;
    mutate(
      (d) => {
        d.admissions.find((x) => x.id === adm.id)!.notes.unshift({ at: nowISO(), by: user?.name ?? "—", text: note.trim() });
      },
      { audit: `Nursing note added for ${p?.name} (bed ${bed.id})` }
    );
    toast("Nursing note saved", "ok");
    setNote("");
  };

  return (
    <Modal title={`Bed ${bed.id} — ${p?.name}`} sub={`${wardOf(db.wards, bed.ward).name} · admitted ${adm ? fmtDate(adm.date) : "—"}`} onClose={onClose} w="max-w-lg"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        {canManage && adm && <Btn variant="danger" onClick={discharge}>Discharge patient</Btn>}
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase text-ink-faint">Diagnosis</p><p className="mt-0.5 font-semibold text-ink">{adm?.diagnosis}</p></div>
          <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase text-ink-faint">Attending doctor</p><p className="mt-0.5 font-semibold text-ink">{db.staff.find((s) => s.id === adm?.doctorId)?.name}</p></div>
          <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase text-ink-faint">Daily charge</p><p className="mt-0.5 font-mono font-semibold text-ink">{ghs(adm?.dailyCharge ?? 0)}</p></div>
          <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase text-ink-faint">Blood group / allergies</p><p className="mt-0.5 font-semibold text-ink">{p?.bloodGroup} · {p?.allergies.filter((a) => a !== "None known").join(", ") || "none"}</p></div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Ward notes</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {(adm?.notes ?? []).map((n, i) => (
              <div key={i} className="rounded-lg border border-line-soft bg-paper/50 px-3 py-2">
                <p className="text-[11.5px] leading-snug text-ink">{n.text}</p>
                <p className="mt-0.5 font-mono text-[9.5px] text-ink-faint">{n.by} · {fmtDate(n.at)} {fmtTime(n.at)}</p>
              </div>
            ))}
            {(adm?.notes ?? []).length === 0 && <p className="text-xs text-ink-faint">No notes yet.</p>}
          </div>
          {canManage && (
            <div className="mt-2 flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add nursing note…" className="py-1.5 text-xs" />
              <Btn variant="soft" onClick={addNote}>Add</Btn>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AdmitModal({ bed, onClose }: { bed: Bed; onClose: () => void }) {
  const { db, user, mutate, toast } = useStore();
  const candidates = db.patients.filter((p) => p.status !== "admitted");
  const [patientMrn, setPatientMrn] = useState(candidates[0]?.mrn ?? "");
  const [diagnosis, setDiagnosis] = useState("");
  const doctors = db.staff.filter((s) => s.role === "doctor");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");

  const save = () => {
    if (!diagnosis.trim()) {
      toast("Enter an admission diagnosis", "danger");
      return;
    }
    const p = db.patients.find((x) => x.mrn === patientMrn);
    const daily = wardOf(db.wards, bed.ward).daily;
    mutate(
      (d) => {
        const b = d.beds.find((x) => x.id === bed.id)!;
        b.status = "occupied";
        b.patientMrn = patientMrn;
        const pat = d.patients.find((x) => x.mrn === patientMrn)!;
        pat.status = "admitted";
        d.admissions.unshift({
          id: nid("ADM", d.admissions.map((a) => a.id)), patientMrn, bedId: bed.id, doctorId,
          date: nowISO(), diagnosis: diagnosis.trim(), status: "active", dailyCharge: daily, notes: [],
        });
        charge(d, patientMrn, { desc: `Ward admission deposit — ${bed.id}`, amount: 400, kind: "bed" });
      },
      {
        audit: `Admitted ${p?.name} to bed ${bed.id} (${wardOf(db.wards, bed.ward).name})`,
        notify: { text: `Bed ${bed.id} now occupied — ${p?.name} admitted`, icon: "bed", roles: ["admin", "nurse", "billing"] },
      }
    );
    toast(`${p?.name} admitted to ${bed.id} — admission deposit billed`, "ok");
    onClose();
  };

  return (
    <Modal title={`Admit to Bed ${bed.id}`} sub={`${wardOf(db.wards, bed.ward).name} · ${ghs(wardOf(db.wards, bed.ward).daily)} per night · deposit GH₵ 400.00 auto-billed`} onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IBed size={14} /> Confirm admission</Btn></>}>
      <div className="space-y-3">
        <Field label="Patient">
          <Select value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)}>
            {candidates.map((p) => <option key={p.mrn} value={p.mrn}>{p.name} — {p.mrn} ({p.status})</option>)}
          </Select>
        </Field>
        <Field label="Admission diagnosis"><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Severe malaria" /></Field>
        <Field label="Attending doctor">
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function NursingPanel({ patientMrn, setPatientMrn }: { patientMrn: string; setPatientMrn: (v: string) => void }) {
  const { db, user, mutate, toast } = useStore();
  const active = db.admissions.filter((a) => a.status === "active");
  const adm = active.find((a) => a.patientMrn === patientMrn) ?? active[0];
  const p = adm ? db.patients.find((x) => x.mrn === adm.patientMrn) : null;
  const rx = p ? db.rxOrders.filter((r) => r.patientMrn === p.mrn && r.status === "dispensed").flatMap((r) => r.items) : [];
  const [given, setGiven] = useState<Record<string, boolean>>({});
  const [v, setV] = useState({ temp: "37.0", bpSys: "120", bpDia: "80", pulse: "78", resp: "16", spo2: "98" });
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));

  const saveVitals = () => {
    if (!adm) return;
    const vitals: Vitals = {
      temp: parseFloat(v.temp) || 0, bpSys: parseInt(v.bpSys) || 0, bpDia: parseInt(v.bpDia) || 0,
      pulse: parseInt(v.pulse) || 0, resp: parseInt(v.resp) || 0, spo2: parseInt(v.spo2) || 0,
      takenAt: nowISO(), by: user?.name ?? "—",
    };
    mutate(
      (d) => d.vitalsLog.unshift({ patientMrn: adm.patientMrn, v: vitals }),
      {
        audit: `Ward vitals for ${p?.name} — BP ${vitals.bpSys}/${vitals.bpDia}, T ${vitals.temp}°C, SpO₂ ${vitals.spo2}%`,
        notify: { text: `Ward vitals recorded for ${p?.name} (bed ${adm.bedId})`, icon: "vitals", roles: ["doctor", "admin"] },
      }
    );
    const abnormal = vitals.temp >= 38 || vitals.bpSys >= 140 || vitals.spo2 < 94;
    toast(abnormal ? `Vitals saved — abnormal readings flagged to the doctor` : "Vitals saved to patient chart", abnormal ? "warn" : "ok");
  };

  const markGiven = (name: string) => {
    setGiven((g) => ({ ...g, [name]: true }));
    mutate((d) => void d, { audit: `Medication administered: ${name} to ${p?.name} (${user?.name})` });
    toast(`${name} administration recorded`, "ok");
  };

  if (!adm) return <Card className="p-4"><p className="text-xs text-ink-faint">No active admissions.</p></Card>;

  return (
    <Card className="p-4">
      <SectionHead title="Nursing Station" sub="Vitals, medication administration and monitoring" right={
        <Select value={adm.patientMrn} onChange={(e) => setPatientMrn(e.target.value)} className="w-auto py-1 text-xs">
          {active.map((a) => <option key={a.id} value={a.patientMrn}>{db.patients.find((x) => x.mrn === a.patientMrn)?.name} · {a.bedId}</option>)}
        </Select>
      } />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Temp °C"><Input value={v.temp} onChange={(e) => set("temp", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        <Field label="BP sys"><Input value={v.bpSys} onChange={(e) => set("bpSys", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        <Field label="BP dia"><Input value={v.bpDia} onChange={(e) => set("bpDia", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        <Field label="Pulse"><Input value={v.pulse} onChange={(e) => set("pulse", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        <Field label="Resp"><Input value={v.resp} onChange={(e) => set("resp", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
        <Field label="SpO₂"><Input value={v.spo2} onChange={(e) => set("spo2", e.target.value)} className="py-1.5 font-mono text-xs" /></Field>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10.5px] text-ink-faint"><IActivity size={12} className="inline" /> Saved to {p?.name}'s chart instantly</p>
        <Btn onClick={saveVitals}><ICheck size={13} /> Record vitals</Btn>
      </div>

      <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Medication administration — {p?.name}</p>
      {rx.length ? (
        <div className="space-y-1.5">
          {rx.slice(0, 5).map((i) => (
            <div key={i.name} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all ${given[i.name] ? "border-emerald-200 bg-emerald-50" : "border-line-soft bg-paper/50"}`}>
              <span className="font-semibold text-ink">{i.name} <span className="font-normal text-ink-faint">· {i.dose} {i.freq}</span></span>
              {given[i.name] ? (
                <Badge tone="ok"><ICheck size={10} /> Given</Badge>
              ) : (
                <Btn variant="soft" size="xs" onClick={() => markGiven(i.name)}>Mark given</Btn>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900"><IAlert size={13} /> No dispensed medication on file — check with pharmacy.</p>
      )}
    </Card>
  );
}
