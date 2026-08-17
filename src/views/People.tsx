import { useState } from "react";
import { useStore } from "../store";
import { todayISO } from "../data";
import type { Role } from "../data";
import { Badge, Btn, Card, SectionHead, Avatar, StatusPill } from "../ui";
import { IStetho, IPhone, ICalendar, IChevR } from "../icons";

const ROLE_TONE: Record<Role, "dark" | "med" | "info" | "neutral" | "warn" | "ok"> = {
  admin: "dark", doctor: "med", nurse: "info", reception: "neutral", lab: "warn", pharmacist: "ok", billing: "warn",
};

export function DoctorsView() {
  const { db, go } = useStore();
  const [onlyOnDuty, setOnlyOnDuty] = useState(false);
  const today = todayISO();
  const doctors = db.staff.filter((s) => s.role === "doctor" && (!onlyOnDuty || s.status === "on-duty"));

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Medical Staff Directory</h1>
          <p className="text-xs text-ink-faint">{doctors.length} doctors across {new Set(doctors.map((d) => d.dept)).size} departments</p>
        </div>
        <button onClick={() => setOnlyOnDuty((v) => !v)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${onlyOnDuty ? "border-med-500 bg-med-50 text-med-700" : "border-line bg-white text-ink-soft"}`}>
          On duty only
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {doctors.map((d) => {
          const load = db.appointments.filter((a) => a.doctorId === d.id && a.date === today && a.status !== "cancelled").length;
          const done = db.appointments.filter((a) => a.doctorId === d.id && a.date === today && a.status === "completed").length;
          return (
            <Card key={d.id} className="group p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-med-600/5">
              <div className="flex items-start gap-3">
                <Avatar name={d.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-sm font-bold text-ink">{d.name}</p>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${d.status === "on-duty" ? "live-dot bg-mint" : d.status === "on-leave" ? "bg-amber-400" : "bg-line"}`} />
                  </div>
                  <p className="text-[11px] text-ink-faint">{d.title} · <span className="font-mono">{d.id}</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="med"><IStetho size={10} /> {d.specialty}</Badge>
                    <Badge tone="neutral">Room: {d.room}</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-paper/70 p-2 text-center">
                  <p className="font-mono text-lg font-bold text-med-700">{load}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Today's patients</p>
                </div>
                <div className="rounded-lg bg-paper/70 p-2 text-center">
                  <p className="font-mono text-lg font-bold text-ink">{done}<span className="text-xs text-ink-faint">/{load}</span></p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Seen so far</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                    <span key={day} className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${d.schedule.includes(day) ? "bg-med-100 text-med-700" : "bg-line-soft text-ink-faint/60"}`}>{day[0]}</span>
                  ))}
                </div>
                <Btn variant="ghost" size="xs" onClick={() => go("appointments")}>Schedule <IChevR size={12} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function StaffView() {
  const { db, user, mutate, toast } = useStore();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const isAdmin = user?.role === "admin";

  const staff = db.staff.filter((s) => roleFilter === "all" || s.role === roleFilter);

  const toggleActive = (id: string) => {
    const s = db.staff.find((x) => x.id === id)!;
    mutate(
      (d) => {
        const t = d.staff.find((x) => x.id === id)!;
        t.active = !t.active;
      },
      { audit: `${s.active ? "Deactivated" : "Reactivated"} account ${s.name} (${id})` }
    );
    toast(`${s.name}'s account ${s.active ? "deactivated" : "reactivated"}`, s.active ? "warn" : "ok");
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Staff Management</h1>
          <p className="text-xs text-ink-faint">{db.staff.length} employees · role-based access enforced across every module</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", "admin", "doctor", "nurse", "reception", "lab", "pharmacist", "billing"].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-all ${roleFilter === r ? "bg-pine-900 text-mint" : "bg-white border border-line text-ink-soft hover:border-med-300"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-2.5 pr-3 font-semibold">Employee</th>
              <th className="py-2.5 pr-3 font-semibold">Staff ID</th>
              <th className="py-2.5 pr-3 font-semibold">Role</th>
              <th className="py-2.5 pr-3 font-semibold">Department</th>
              <th className="py-2.5 pr-3 font-semibold">Contact</th>
              <th className="py-2.5 pr-3 font-semibold">Duty</th>
              <th className="py-2.5 pr-3 font-semibold">Status</th>
              {isAdmin && <th className="py-2.5 font-semibold">Account</th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={`border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40 ${!s.active ? "opacity-50" : ""}`}>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={s.name} size={30} />
                    <span><span className="block font-semibold text-ink">{s.name}</span><span className="text-[10px] text-ink-faint">{s.title}</span></span>
                  </span>
                </td>
                <td className="py-2.5 pr-3 font-mono text-ink-soft">{s.id}</td>
                <td className="py-2.5 pr-3"><Badge tone={ROLE_TONE[s.role]}>{s.role}</Badge></td>
                <td className="py-2.5 pr-3 text-ink-soft">{s.dept}</td>
                <td className="py-2.5 pr-3"><span className="flex items-center gap-1.5 font-mono text-ink-soft"><IPhone size={11} className="text-med-500" />{s.phone}</span></td>
                <td className="py-2.5 pr-3"><StatusPill s={s.status} /></td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-1.5">
                    <ICalendar size={11} className="text-ink-faint" />
                    <span className="font-mono text-[10px] text-ink-soft">{s.schedule.join(" ")}</span>
                  </span>
                </td>
                {isAdmin && (
                  <td className="py-2.5">
                    <Btn variant={s.active ? "outline" : "soft"} size="xs" onClick={() => toggleActive(s.id)}>
                      {s.active ? "Deactivate" : "Activate"}
                    </Btn>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <SectionHead title="Role Permissions Matrix" sub="What each role can see and do — enforced at the navigation and action level" />
        <div className="grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { r: "Doctors", t: "Consultations, diagnoses, prescriptions, lab requests, full patient charts" },
            { r: "Nurses", t: "Vitals, ward care, bed map, medication administration, doctor alerts" },
            { r: "Reception", t: "Registration, appointments, check-in, queue tokens, patient search" },
            { r: "Lab staff", t: "Sample collection, processing, result entry & verification, reports" },
            { r: "Pharmacists", t: "Dispensing e-prescriptions, drug inventory, expiry & stock alerts" },
            { r: "Billing", t: "Invoices, payments, receipts, insurance claims, outstanding balances" },
            { r: "Admins", t: "Everything above, plus staff accounts, audit trail, backups, settings" },
            { r: "Guaranteed", t: "A pharmacist cannot edit diagnoses; a receptionist cannot alter lab results" },
          ].map((x) => (
            <div key={x.r} className="rounded-lg border border-line-soft bg-paper/60 p-3 transition-colors hover:border-med-200">
              <p className="font-display text-xs font-bold text-med-700">{x.r}</p>
              <p className="mt-1 leading-snug text-ink-soft">{x.t}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
