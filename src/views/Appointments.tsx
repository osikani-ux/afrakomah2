import { useMemo, useState } from "react";
import { useStore, nid } from "../store";
import { dISO, fmtDate, todayISO } from "../data";
import type { Appointment } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, Select, StatusPill, Textarea, Avatar } from "../ui";
import { IPlus, ICheck, IChevL, IChevR, ICalendar, IX, IClock, IUser } from "../icons";

const SLOTS = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 16; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 16 || true) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out.filter((s) => s <= "16:30");
})();

const CHIP: Record<string, string> = {
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  "checked-in": "border-med-300 bg-med-50 text-med-800",
  "in-consultation": "border-amber-300 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-line bg-line-soft text-ink-faint line-through",
};

export default function Appointments() {
  const { db, user, mutate, toast, go } = useStore();
  const [date, setDate] = useState(todayISO());
  const [booking, setBooking] = useState<{ doctorId: string; time: string } | null>(null);
  const [sel, setSel] = useState<Appointment | null>(null);

  const doctors = db.staff.filter((s) => s.role === "doctor");
  const dayAppts = db.appointments.filter((a) => a.date === date);
  const canBook = user?.role === "reception" || user?.role === "admin" || user?.role === "doctor";

  const shift = (n: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + n);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const isToday = date === todayISO();
  const counts = useMemo(
    () => ({
      booked: dayAppts.filter((a) => a.status !== "cancelled").length,
      checkedIn: dayAppts.filter((a) => a.status === "checked-in").length,
      done: dayAppts.filter((a) => a.status === "completed").length,
    }),
    [dayAppts]
  );

  const setStatus = (a: Appointment, status: Appointment["status"]) => {
    const patient = db.patients.find((p) => p.mrn === a.patientMrn);
    if (status === "checked-in") {
      mutate(
        (d) => {
          const q = d.queues.consult;
          q.seq += 1;
          const no = `A${String(q.seq).padStart(2, "0")}`;
          q.waiting.push(no);
          const ap = d.appointments.find((x) => x.id === a.id)!;
          ap.status = "checked-in";
          ap.queueNo = no;
        },
        { audit: `Checked in ${patient?.name} for ${db.staff.find((s) => s.id === a.doctorId)?.name} — token issued`, notify: { text: `${patient?.name} checked in — joined consultation queue`, icon: "appt", roles: ["admin", "reception", "nurse"] } }
      );
      toast(`${patient?.name} checked in — token issued, added to consultation queue`, "ok");
    } else {
      mutate(
        (d) => {
          d.appointments.find((x) => x.id === a.id)!.status = status;
        },
        { audit: `Appointment ${a.id} marked ${status} (${patient?.name})` }
      );
      toast(`Appointment ${status.replace(/-/g, " ")}`, status === "cancelled" ? "warn" : "ok");
    }
    setSel(null);
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Appointments</h1>
          <p className="text-xs text-ink-faint">Doctor calendar with live availability — double-booking is blocked automatically</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" onClick={() => shift(-1)}><IChevL size={14} /></Btn>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Btn variant="outline" onClick={() => shift(1)}><IChevR size={14} /></Btn>
          {!isToday && <Btn variant="soft" onClick={() => setDate(todayISO())}>Today</Btn>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="dark"><ICalendar size={11} /> {fmtDate(date)}</Badge>
        <Badge tone="info">{counts.booked} booked</Badge>
        <Badge tone="med">{counts.checkedIn} checked in</Badge>
        <Badge tone="ok">{counts.done} completed</Badge>
        <span className="ml-auto flex items-center gap-3 text-[10.5px] font-medium text-ink-faint">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-sky-300 bg-sky-100" /> scheduled</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-med-300 bg-med-100" /> checked-in</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-100" /> in consultation</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-emerald-300 bg-emerald-100" /> completed</span>
        </span>
      </div>

      {/* doctor calendar */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <div className="grid min-w-[1080px]" style={{ gridTemplateColumns: `64px repeat(${doctors.length}, 1fr)` }}>
          <div className="border-b border-line bg-paper/80 px-2 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-faint">Time</div>
          {doctors.map((d) => {
            const load = dayAppts.filter((a) => a.doctorId === d.id && a.status !== "cancelled").length;
            return (
              <div key={d.id} className="border-b border-l border-line bg-paper/80 px-2 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={d.name} size={26} />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-ink">{d.name.replace("Dr. ", "")}</p>
                    <p className="truncate text-[9.5px] text-ink-faint">{d.specialty} · {load} booked</p>
                  </div>
                  <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${d.status === "on-duty" ? "live-dot bg-mint" : "bg-line"}`} title={d.status} />
                </div>
              </div>
            );
          })}

          {SLOTS.map((t) => (
            <div key={t} className="contents">
              <div className="flex items-center border-b border-line-soft px-2 py-1 font-mono text-[10px] text-ink-faint">{t}</div>
              {doctors.map((d) => {
                const ap = dayAppts.find((a) => a.doctorId === d.id && a.time === t && a.status !== "cancelled");
                const patient = ap ? db.patients.find((p) => p.mrn === ap.patientMrn) : null;
                return (
                  <div key={d.id + t} className="group border-b border-l border-line-soft p-0.5">
                    {ap ? (
                      <button onClick={() => setSel(ap)} className={`w-full rounded-md border px-1.5 py-1 text-left transition-all hover:shadow-sm ${CHIP[ap.status]}`}>
                        <span className="block truncate text-[10px] font-bold leading-tight">{patient?.name}</span>
                        <span className="block truncate font-mono text-[8.5px] opacity-75">
                          {ap.queueNo ? `${ap.queueNo} · ` : ""}{ap.status.replace(/-/g, " ")}
                        </span>
                      </button>
                    ) : canBook ? (
                      <button
                        onClick={() => setBooking({ doctorId: d.id, time: t })}
                        className="flex h-full min-h-[30px] w-full items-center justify-center rounded-md border border-dashed border-transparent text-med-500 opacity-0 transition-all hover:border-med-300 hover:bg-med-50 group-hover:opacity-100"
                        title={`Book ${t} with ${d.name}`}
                      >
                        <IPlus size={12} />
                      </button>
                    ) : (
                      <div className="h-full min-h-[30px]" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-faint"><IClock size={12} /> Slots already filled are locked — the system refuses overlapping bookings for the same doctor.</p>

      {booking && <BookingModal doctorId={booking.doctorId} time={booking.time} date={date} onClose={() => setBooking(null)} />}

      {sel && (
        <Modal title={`Appointment ${sel.id}`} sub={`${fmtDate(sel.date)} at ${sel.time} · ${sel.type} consultation`} onClose={() => setSel(null)} w="max-w-md"
          footer={
            <>
              {sel.status === "scheduled" && <Btn onClick={() => setStatus(sel, "checked-in")}><ICheck size={14} /> Check in & issue token</Btn>}
              {sel.status === "checked-in" && <Btn onClick={() => setStatus(sel, "in-consultation")}><ICheck size={14} /> Start consultation</Btn>}
              {sel.status === "in-consultation" && <Btn onClick={() => setStatus(sel, "completed")}><ICheck size={14} /> Mark completed</Btn>}
              {(sel.status === "scheduled" || sel.status === "checked-in") && <Btn variant="danger" onClick={() => setStatus(sel, "cancelled")}><IX size={14} /> Cancel</Btn>}
            </>
          }>
          {(() => {
            const p = db.patients.find((x) => x.mrn === sel.patientMrn);
            const d = db.staff.find((x) => x.id === sel.doctorId);
            return (
              <div className="space-y-3">
                <button onClick={() => { setSel(null); go("patients", { patient: sel.patientMrn }); }} className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper/60 p-3 text-left transition-all hover:border-med-300">
                  <Avatar name={p?.name ?? "?"} size={38} />
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">{p?.name} <span className="font-mono text-[10px] font-normal text-ink-faint">{sel.patientMrn}</span></p>
                    <p className="text-[11px] text-ink-faint">{p?.phone} · {d?.name} — {d?.specialty}</p>
                  </div>
                  <IUser size={16} className="ml-auto text-med-500" />
                </button>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase tracking-wide text-ink-faint">Reason</p><p className="mt-0.5 font-semibold text-ink">{sel.reason}</p></div>
                  <div className="rounded-lg bg-paper/70 p-2.5"><p className="text-[10px] uppercase tracking-wide text-ink-faint">Status</p><div className="mt-1"><StatusPill s={sel.status} />{sel.queueNo && <span className="ml-2 font-mono text-[11px] font-bold text-med-700">{sel.queueNo}</span>}</div></div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function BookingModal({ doctorId, time, date, onClose }: { doctorId: string; time: string; date: string; onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const doctor = db.staff.find((s) => s.id === doctorId)!;
  const [patientMrn, setPatientMrn] = useState(db.patients[0]?.mrn ?? "");
  const [type, setType] = useState<Appointment["type"]>("General");
  const [reason, setReason] = useState("");

  const clash = db.appointments.some((a) => a.doctorId === doctorId && a.date === date && a.time === time && a.status !== "cancelled");

  const save = () => {
    if (!reason.trim()) {
      toast("Please enter a reason for the visit", "danger");
      return;
    }
    if (clash) {
      toast("Slot was just taken — pick another time", "danger");
      return;
    }
    const p = db.patients.find((x) => x.mrn === patientMrn);
    mutate(
      (d) => {
        d.appointments.push({
          id: nid("APT", d.appointments.map((a) => a.id)),
          patientMrn, doctorId, dept: doctor.dept, date, time, type,
          reason: reason.trim(), status: "scheduled",
        });
      },
      {
        audit: `Booked ${p?.name} with ${doctor.name} on ${fmtDate(date)} ${time}`,
        notify: { text: `New appointment: ${p?.name} → ${doctor.name}, ${fmtDate(date)} ${time}`, icon: "appt", roles: ["admin", "reception", "doctor"] },
      }
    );
    toast(`Booked ${time} — SMS reminder sent to ${p?.phone}`, "ok");
    onClose();
  };

  return (
    <Modal title="Book Appointment" sub={`${doctor.name} · ${fmtDate(date)} at ${time} — slot reserved while you type`} onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={clash}><ICheck size={14} /> Confirm booking</Btn></>}>
      <div className="space-y-3">
        <Field label="Patient">
          <Select value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)}>
            {db.patients.map((p) => <option key={p.mrn} value={p.mrn}>{p.name} — {p.mrn}</option>)}
          </Select>
        </Field>
        <Field label="Appointment type">
          <Select value={type} onChange={(e) => setType(e.target.value as Appointment["type"])}>
            <option>General</option><option>Follow-up</option><option>Specialist</option><option>Procedure</option>
          </Select>
        </Field>
        <Field label="Reason for visit">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason, e.g. persistent cough, 2 weeks" />
        </Field>
        {clash && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">This slot is no longer available — double-booking prevented.</p>}
      </div>
    </Modal>
  );
}
