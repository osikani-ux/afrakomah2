import { useStore } from "../store";
import { todayISO, timeAgo, fmtTime, QUEUE_DEPTS, ghs } from "../data";
import { Badge, Card, SectionHead, StatusPill, AreaChart, BarsChart, Donut, HBars, Sparkline, EcgStrip, Btn } from "../ui";
import { IUsers, ICalendar, IBed, IZap, IReceipt, IFlask, IPill, IAlert, IChevR, IArrowR } from "../icons";

const ADM_V_DIS = [
  { label: "Mon", a: 2, b: 1 }, { label: "Tue", a: 1, b: 2 }, { label: "Wed", a: 3, b: 2 },
  { label: "Thu", a: 2, b: 3 }, { label: "Fri", a: 4, b: 2 }, { label: "Sat", a: 3, b: 4 }, { label: "Sun", a: 5, b: 3 },
];

const DIAGNOSES = [
  { label: "Malaria (uncomplicated)", value: 46, color: "#0e7a63" },
  { label: "Upper resp. infection", value: 38, color: "#1d6fb8" },
  { label: "Hypertension", value: 31, color: "#b45309" },
  { label: "Type 2 diabetes", value: 22, color: "#0f766e" },
  { label: "Urinary tract infection", value: 17, color: "#be123c" },
];

export default function Dashboard() {
  const { db, user, go } = useStore();
  const today = todayISO();

  const apptsToday = db.appointments.filter((a) => a.date === today);
  const activeEm = db.emergencies.filter((e) => e.status === "waiting" || e.status === "in-treatment");
  const activeAdm = db.admissions.filter((a) => a.status === "active");
  const bedsFree = db.beds.filter((b) => b.status === "available").length;
  const pendingLabs = db.labOrders.filter((l) => l.status !== "verified").length;
  const lowStock = db.medicines.filter((m) => m.stock > 0 && m.stock <= m.reorderLevel).length;
  const outStock = db.medicines.filter((m) => m.stock === 0).length;
  const openBills = db.invoices.filter((i) => i.status !== "paid");
  const outstanding = openBills.reduce((s, i) => s + Math.max(0, i.items.reduce((x, y) => x + y.amount, 0) - i.paid), 0);
  const todayPatients = new Set([...apptsToday.map((a) => a.patientMrn), ...activeEm.map((e) => e.patientMrn)]).size;
  const revenueToday = db.trends.revenue[db.trends.revenue.length - 1];

  const deptLoad = Object.entries(
    apptsToday.reduce<Record<string, number>>((acc, a) => ((acc[a.dept] = (acc[a.dept] ?? 0) + 1), acc), {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const wardOcc = db.wards.map((w) => {
    const beds = db.beds.filter((b) => b.ward === w.id);
    return { w: w.id, occ: beds.filter((b) => b.status === "occupied").length, total: beds.length };
  });

  const kpis = [
    { icon: <IUsers size={16} />, label: "Today's Patients", value: String(todayPatients), sub: `${activeEm.length} via emergency`, tone: "text-med-700 bg-med-50", spark: db.trends.registrations },
    { icon: <ICalendar size={16} />, label: "Appointments Today", value: String(apptsToday.length), sub: `${apptsToday.filter((a) => a.status === "completed").length} completed · ${apptsToday.filter((a) => a.status === "checked-in").length} in queue`, tone: "text-sky-700 bg-sky-50" },
    { icon: <IBed size={16} />, label: "Currently Admitted", value: String(activeAdm.length), sub: `${db.beds.length - bedsFree} of ${db.beds.length} beds in use`, tone: "text-teal-700 bg-teal-50" },
    { icon: <IBed size={16} />, label: "Available Beds", value: String(bedsFree), sub: `${db.beds.filter((b) => b.status === "cleaning").length} cleaning · ${db.beds.filter((b) => b.status === "reserved").length} reserved`, tone: "text-emerald-700 bg-emerald-50" },
    { icon: <IZap size={16} />, label: "Emergency Cases", value: String(activeEm.length), sub: `${activeEm.filter((e) => e.triage === "critical").length} critical — red`, tone: "text-red-700 bg-red-50" },
    { icon: <IReceipt size={16} />, label: "Today's Revenue", value: ghs(revenueToday), sub: "+14.8% vs 7-day average", tone: "text-med-700 bg-med-50", spark: db.trends.revenue, wide: true },
    { icon: <IReceipt size={16} />, label: "Pending Bills", value: String(openBills.length), sub: `${ghs(outstanding)} outstanding`, tone: "text-amber-800 bg-amber-50" },
    { icon: <IFlask size={16} />, label: "Pending Lab Tests", value: String(pendingLabs), sub: `${db.labOrders.filter((l) => l.status === "ordered").length} awaiting collection`, tone: "text-info bg-sky-50" },
    { icon: <IPill size={16} />, label: "Low Stock Medicines", value: String(lowStock), sub: `${db.medicines.filter((m) => m.expiry <= todayISO()).length} expired batch`, tone: "text-amber-800 bg-amber-50" },
    { icon: <IPill size={16} />, label: "Out of Stock", value: String(outStock), sub: "Reorder raised automatically", tone: "text-red-700 bg-red-50" },
  ];

  return (
    <div className="fade-up space-y-5">
      {/* command header */}
      <div className="relative overflow-hidden rounded-2xl bg-pine-900 px-5 py-4 text-white">
        <div className="bg-pine-grid absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-70">
          <EcgStrip className="h-12 w-full" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-mint" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">Live · Hospital Command Center</span>
            </div>
            <h1 className="mt-1 font-display text-xl font-extrabold tracking-tight">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-xs text-white/60">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · MediCore General Hospital, Accra
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="dark" onClick={() => go("emergency")}><IZap size={14} /> Emergency board</Btn>
            <Btn variant="dark" onClick={() => go("wards")}><IBed size={14} /> Bed map</Btn>
          </div>
        </div>
      </div>

      {/* KPI bento */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <div
            key={i}
            className={`group rounded-xl border border-line bg-white p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-med-300 hover:shadow-lg hover:shadow-med-600/5 ${k.wide ? "col-span-2 md:col-span-2" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${k.tone}`}>{k.icon}</span>
              {k.spark && <Sparkline values={k.spark} w={70} h={22} />}
            </div>
            <p className="mt-2.5 font-mono text-[21px] font-semibold leading-none text-ink">{k.value}</p>
            <p className="mt-1.5 text-[11px] font-semibold text-ink-soft">{k.label}</p>
            <p className="text-[10.5px] text-ink-faint">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* main column */}
        <div className="space-y-5 xl:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <SectionHead title="Patient Registrations" sub="Last 14 days" right={<Badge tone="med">+18% this month</Badge>} />
              <AreaChart values={db.trends.registrations} labels={db.trends.labels} />
            </Card>
            <Card className="p-4">
              <SectionHead title="Revenue Trend" sub="Daily collections, GH₵" right={<Badge tone="ok">GH₵ {(db.trends.revenue.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}k total</Badge>} />
              <AreaChart values={db.trends.revenue} labels={db.trends.labels} color="#1d6fb8" money />
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <SectionHead title="Admissions vs Discharges" sub="This week" />
              <BarsChart data={ADM_V_DIS} aLabel="Admissions" bLabel="Discharges" />
            </Card>
            <Card className="p-4">
              <SectionHead title="Bed Occupancy" sub="All wards, real-time" />
              <div className="flex items-center gap-5">
                <Donut value={db.beds.length - bedsFree} total={db.beds.length} label="Occupied" sub={`${bedsFree} beds free right now`} />
                <div className="flex-1 space-y-1.5">
                  {wardOcc.map((w) => (
                    <div key={w.w} className="flex items-center gap-2">
                      <span className="w-14 font-mono text-[10px] font-semibold text-ink-soft">{w.w}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                        <div className="h-full rounded-full bg-med-600 transition-all duration-700" style={{ width: `${(w.occ / w.total) * 100}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-ink-faint">{w.occ}/{w.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <SectionHead
              title="Today's Appointments"
              sub={`${apptsToday.length} booked across ${deptLoad.length} departments`}
              right={<Btn variant="ghost" onClick={() => go("appointments")}>Open schedule <IChevR size={13} /></Btn>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line-soft text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="py-2 pr-3 font-semibold">Time</th>
                    <th className="py-2 pr-3 font-semibold">Patient</th>
                    <th className="py-2 pr-3 font-semibold">Doctor</th>
                    <th className="py-2 pr-3 font-semibold">Reason</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {apptsToday.slice(0, 7).map((a) => {
                    const p = db.patients.find((x) => x.mrn === a.patientMrn);
                    const d = db.staff.find((x) => x.id === a.doctorId);
                    return (
                      <tr key={a.id} className="cursor-pointer border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/50" onClick={() => go("patients", { patient: a.patientMrn })}>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-med-700">{a.time}</td>
                        <td className="py-2.5 pr-3 font-semibold text-ink">{p?.name}<span className="ml-1.5 font-mono text-[10px] font-normal text-ink-faint">{a.patientMrn}</span></td>
                        <td className="py-2.5 pr-3 text-ink-soft">{d?.name}</td>
                        <td className="max-w-[220px] truncate py-2.5 pr-3 text-ink-faint">{a.reason}</td>
                        <td className="py-2.5"><StatusPill s={a.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* side column */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <h3 className="font-display text-[13px] font-bold">Live Activity</h3>
              <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-med-600">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" /> streaming
              </span>
            </div>
            <div className="relative h-[252px] overflow-hidden">
              <div className="ticker space-y-0">
                {[...db.audit.slice(0, 9), ...db.audit.slice(0, 9)].map((a, i) => (
                  <div key={i} className="flex gap-2.5 border-b border-line-soft/60 px-4 py-2.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-med-400" />
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] leading-snug text-ink">{a.action}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-ink-faint">{a.user} · {timeAgo(a.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Needs Attention" sub="Auto-raised alerts" right={<Badge tone="danger">{2 + (activeEm.filter((e) => e.triage === "critical").length ? 1 : 0)} active</Badge>} />
            <div className="space-y-2">
              {activeEm.filter((e) => e.triage === "critical").map((e) => (
                <button key={e.id} onClick={() => go("emergency")} className="flex w-full items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left transition-all hover:border-red-300 hover:shadow-sm">
                  <IZap size={14} className="text-alert" />
                  <span className="flex-1 text-[11.5px] font-semibold text-red-800">Triage RED — {db.patients.find((p) => p.mrn === e.patientMrn)?.name} in Resus Bay</span>
                  <IArrowR size={13} className="text-red-400" />
                </button>
              ))}
              <button onClick={() => go("pharmacy", { tab: "inventory" })} className="flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition-all hover:border-amber-300 hover:shadow-sm">
                <IPill size={14} className="text-amberish" />
                <span className="flex-1 text-[11.5px] font-semibold text-amber-900">Ceftriaxone 1g out of stock — {lowStock} more items low</span>
                <IArrowR size={13} className="text-amber-500" />
              </button>
              <button onClick={() => go("lab")} className="flex w-full items-center gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left transition-all hover:border-sky-300 hover:shadow-sm">
                <IFlask size={14} className="text-info" />
                <span className="flex-1 text-[11.5px] font-semibold text-sky-900">{pendingLabs} lab orders in pipeline — 1 awaiting verification</span>
                <IArrowR size={13} className="text-sky-400" />
              </button>
              <button onClick={() => go("billing")} className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-line-soft/50 px-3 py-2 text-left transition-all hover:border-med-300 hover:shadow-sm">
                <IAlert size={14} className="text-ink-soft" />
                <span className="flex-1 text-[11.5px] font-semibold text-ink-soft">{ghs(outstanding)} in unpaid bills across {openBills.length} invoices</span>
                <IArrowR size={13} className="text-ink-faint" />
              </button>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Queues Right Now" sub="Serving across departments" right={<Btn variant="ghost" onClick={() => go("queue")}>Display board <IChevR size={13} /></Btn>} />
            <div className="space-y-2">
              {QUEUE_DEPTS.map((q) => {
                const st = db.queues[q.key];
                return (
                  <div key={q.key} className="flex items-center justify-between rounded-lg border border-line-soft bg-paper/60 px-3 py-2">
                    <span className="text-[11.5px] font-semibold text-ink-soft">{q.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-med-700">{st?.serving ?? "—"}</span>
                      <Badge tone="neutral">{st?.waiting.length ?? 0} waiting</Badge>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* bottom strip: department load + diagnoses */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-4">
          <SectionHead title="Department Load — Today" sub="Appointments by department" />
          <HBars items={deptLoad} />
        </Card>
        <Card className="p-4">
          <SectionHead title="Most Common Diagnoses" sub="Outpatient, last 30 days" />
          <HBars items={DIAGNOSES} />
        </Card>
      </div>

      <p className="pb-2 text-center font-mono text-[10px] text-ink-faint">
        Last sync {fmtTime(new Date().toISOString())} · All figures update live as staff work · MediCore HMS v3.2
      </p>
    </div>
  );
}
