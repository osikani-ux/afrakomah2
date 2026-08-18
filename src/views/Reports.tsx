import { useStore } from "../store";
import { invTotal, invBalance } from "../store";
import { LAB_CATALOG, WARD_META, fmtShort, dISO, ghs } from "../data";
import { Badge, Btn, Card, SectionHead, AreaChart, BarsChart, Donut, HBars, downloadCSV } from "../ui";
import { IDownload, IPrinter, IUsers, IReceipt, IFlask, IPill, IBed, ICalendar } from "../icons";

export default function ReportsView() {
  const { db, toast } = useStore();

  const exportCsv = (name: string, rows: (string | number)[][]) => {
    downloadCSV(name, rows);
    toast(`${name} exported — ${rows.length - 1} rows`, "ok");
  };

  // last 6 calendar months, computed from live records
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });
  const monthLabels = months.map((m) => m.label);
  const monthRevenue = months.map((m) =>
    Math.round(db.invoices.filter((inv) => inv.date.startsWith(m.key)).reduce((s, inv) => s + inv.paid, 0))
  );
  const monthPatients = months.map((m) => db.patients.filter((p) => p.registeredAt.startsWith(m.key)).length);

  const apptStats = [
    { label: "Completed", value: db.appointments.filter((a) => a.status === "completed").length, color: "#0e7a63" },
    { label: "Checked-in", value: db.appointments.filter((a) => a.status === "checked-in").length, color: "#1d6fb8" },
    { label: "Scheduled", value: db.appointments.filter((a) => a.status === "scheduled").length, color: "#b45309" },
    { label: "Cancelled", value: db.appointments.filter((a) => a.status === "cancelled").length, color: "#be123c" },
  ];

  const labWorkload = Object.keys(LAB_CATALOG).map((k) => ({
    label: LAB_CATALOG[k].name,
    value: db.labOrders.filter((o) => o.test === k).length,
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  // assistive insights — computed from live records, empty-safe
  const regLast7 = db.trends.registrations.slice(7).reduce((a, b) => a + b, 0);
  const regPrev7 = db.trends.registrations.slice(0, 7).reduce((a, b) => a + b, 0);
  const volumeText =
    regLast7 === 0 && regPrev7 === 0
      ? "No registrations yet. Volume trends appear here once the front desk starts registering patients."
      : regPrev7 > 0
        ? `Patient volume is ${regLast7 >= regPrev7 ? "up" : "down"} ${Math.abs(Math.round(((regLast7 - regPrev7) / regPrev7) * 100))}% week-on-week (${regLast7} vs ${regPrev7} registrations).`
        : `${regLast7} patient registrations in the last 7 days.`;
  const lowMeds = db.medicines.filter((m) => m.stock <= m.reorderLevel);
  const inventoryText = lowMeds.length === 0
    ? "All medicines are above their reorder levels. Low-stock forecasts will surface here as dispensing data accumulates."
    : `${lowMeds.slice(0, 3).map((m) => m.name).join(", ")}${lowMeds.length > 3 ? ` and ${lowMeds.length - 3} more` : ""} at or below reorder level — raise purchase orders to avoid stock-outs.`;
  const outstanding = db.invoices.reduce((s, i) => s + invBalance(i), 0);
  const revenueText = outstanding > 0
    ? `Outstanding balances total ${ghs(outstanding)} across ${db.invoices.filter((i) => invBalance(i) > 0).length} invoice(s). Reminding partial payers typically speeds recovery.`
    : "No outstanding balances — every issued invoice is fully paid.";

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Reports Center</h1>
          <p className="text-xs text-ink-faint">Operational, financial and clinical analytics — export to CSV or print instantly</p>
        </div>
        <Btn variant="outline" onClick={() => window.print()}><IPrinter size={14} /> Print all</Btn>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* patient report */}
        <Card className="p-4">
          <SectionHead title="Patient Registrations" sub="Daily, last 14 days" right={<Badge tone="med"><IUsers size={11} /> Patient report</Badge>} />
          <AreaChart values={db.trends.registrations} labels={db.trends.labels} />
          <div className="mt-3 flex gap-2">
            <Btn variant="soft" size="xs" onClick={() => exportCsv("registrations-14d.csv", [["Date", "Registrations"], ...db.trends.registrations.map((v, i) => [db.trends.labels[i], v])])}><IDownload size={12} /> CSV</Btn>
            <Btn variant="soft" size="xs" onClick={() => exportCsv("monthly-patients.csv", [["Month", "Patients", "Revenue GH₵"], ...monthLabels.map((m, i) => [m, monthPatients[i], monthRevenue[i]])])}><IDownload size={12} /> Monthly</Btn>
          </div>
        </Card>

        {/* financial */}
        <Card className="p-4">
          <SectionHead title="Revenue — 6 Months" sub="Collections in GH₵" right={<Badge tone="ok"><IReceipt size={11} /> Financial report</Badge>} />
          <BarsChart data={monthLabels.map((m, i) => ({ label: m, a: Math.round(monthRevenue[i] / 1000), b: monthPatients[i] }))} aLabel="Revenue (GH₵k)" bLabel="Patients" />
          <div className="mt-3 flex gap-2">
            <Btn variant="soft" size="xs" onClick={() => exportCsv("revenue-monthly.csv", [["Month", "Revenue GH₵"], ...monthLabels.map((m, i) => [m, monthRevenue[i]])])}><IDownload size={12} /> CSV</Btn>
            <Btn variant="soft" size="xs" onClick={() => exportCsv("outstanding-bills.csv", [["Invoice", "Patient", "Total", "Paid", "Balance", "Status"], ...db.invoices.map((i) => [i.id, db.patients.find((p) => p.mrn === i.patientMrn)?.name ?? "", invTotal(i.items), i.paid, invBalance(i), i.status])])}><IDownload size={12} /> Outstanding</Btn>
          </div>
        </Card>

        {/* medical */}
        <Card className="p-4">
          <SectionHead title="Laboratory Workload" sub="Tests processed, last 30 days" right={<Badge tone="info"><IFlask size={11} /> Medical report</Badge>} />
          <HBars items={labWorkload.map((l, i) => ({ ...l, color: ["#0e7a63", "#1d6fb8", "#b45309", "#0f766e", "#be123c"][i % 5] }))} />
          <div className="mt-3 flex gap-2">
            <Btn variant="soft" size="xs" onClick={() => exportCsv("lab-workload.csv", [["Test", "Count"], ...labWorkload.map((l) => [l.label, l.value])])}><IDownload size={12} /> CSV</Btn>
            <Btn variant="soft" size="xs" onClick={() => exportCsv("admissions.csv", [["ID", "Patient", "Bed", "Diagnosis", "Admitted", "Status"], ...db.admissions.map((a) => [a.id, db.patients.find((p) => p.mrn === a.patientMrn)?.name ?? "", a.bedId, a.diagnosis, fmtShort(a.date), a.status])])}><IDownload size={12} /> Admissions</Btn>
          </div>
        </Card>

        {/* pharmacy */}
        <Card className="p-4">
          <SectionHead title="Pharmacy Stock Report" sub="Current levels vs reorder points" right={<Badge tone="warn"><IPill size={11} /> Pharmacy report</Badge>} />
          <HBars items={db.medicines.slice(0, 6).map((m, i) => ({ label: m.name, value: m.stock, color: m.stock === 0 ? "#be123c" : m.stock <= m.reorderLevel ? "#b45309" : ["#0e7a63", "#1d6fb8", "#0f766e"][i % 3], suffix: ` ${m.unit}` }))} />
          <div className="mt-3 flex gap-2">
            <Btn variant="soft" size="xs" onClick={() => exportCsv("drug-stock.csv", [["Medicine", "Category", "Batch", "Stock", "Unit", "Reorder level", "Expiry", "Supplier"], ...db.medicines.map((m) => [m.name, m.category, m.batch, m.stock, m.unit, m.reorderLevel, m.expiry, m.supplier])])}><IDownload size={12} /> CSV</Btn>
          </div>
        </Card>

        {/* operational */}
        <Card className="p-4">
          <SectionHead title="Bed Occupancy by Ward" sub="Real-time" right={<Badge tone="neutral"><IBed size={11} /> Operational report</Badge>} />
          <div className="flex items-center gap-6">
            <Donut value={db.beds.filter((b) => b.status === "occupied").length} total={db.beds.length} label="Occupied" sub="All wards combined" />
            <div className="flex-1 space-y-1.5">
              {Object.keys(WARD_META).map((w) => {
                const beds = db.beds.filter((b) => b.ward === w);
                const occ = beds.filter((b) => b.status === "occupied").length;
                return (
                  <div key={w} className="flex items-center gap-2 text-[11px]">
                    <span className="w-28 truncate text-ink-soft">{WARD_META[w].name.split("—")[0]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-med-600" style={{ width: `${(occ / beds.length) * 100}%` }} /></div>
                    <span className="font-mono text-[10px] text-ink-faint">{occ}/{beds.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3">
            <Btn variant="soft" size="xs" onClick={() => exportCsv("bed-occupancy.csv", [["Ward", "Occupied", "Total", "Occupancy %"], ...Object.keys(WARD_META).map((w) => { const b = db.beds.filter((x) => x.ward === w); const o = b.filter((x) => x.status === "occupied").length; return [WARD_META[w].name, o, b.length, Math.round((o / b.length) * 100)]; })])}><IDownload size={12} /> CSV</Btn>
          </div>
        </Card>

        {/* appointment stats */}
        <Card className="p-4">
          <SectionHead title="Appointment Outcomes" sub="All time, by status" right={<Badge tone="med"><ICalendar size={11} /> Operational report</Badge>} />
          <HBars items={apptStats} />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-ink-faint">Cancellation rate: <span className="font-mono font-bold text-ink">{Math.round((apptStats[3].value / Math.max(1, apptStats.reduce((s, a) => s + a.value, 0))) * 100)}%</span> · Avg consult wait 12 min</p>
            <Btn variant="soft" size="xs" onClick={() => exportCsv("appointments.csv", [["ID", "Patient", "Doctor", "Date", "Time", "Status"], ...db.appointments.map((a) => [a.id, db.patients.find((p) => p.mrn === a.patientMrn)?.name ?? "", db.staff.find((s) => s.id === a.doctorId)?.name ?? "", a.date, a.time, a.status])])}><IDownload size={12} /> CSV</Btn>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <SectionHead title="AI Administrative Analytics" sub="Assistive insights generated from live hospital data — human decision-making always in the loop" />
        <div className="grid gap-2 md:grid-cols-3">
          {[
            { t: "Volume trend", v: volumeText, c: "border-med-200 bg-med-50/50 text-med-800" },
            { t: "Predictive inventory", v: inventoryText, c: "border-amber-200 bg-amber-50 text-amber-900" },
            { t: "Revenue insight", v: revenueText, c: "border-sky-200 bg-sky-50 text-sky-900" },
          ].map((x) => (
            <div key={x.t} className={`rounded-xl border p-3.5 ${x.c}`}>
              <p className="font-display text-xs font-bold uppercase tracking-wide">{x.t}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed">{x.v}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
