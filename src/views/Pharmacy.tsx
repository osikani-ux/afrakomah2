import { useMemo, useState } from "react";
import { useStore, nid, charge } from "../store";
import { todayISO, dISO, fmtDate, timeAgo, ghs } from "../data";
import type { RxOrder } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, SectionHead, Select, StatusPill, Tabs, Empty, Avatar, HBars } from "../ui";
import { IPill, ICheck, IAlert, IBox, IRefresh, ITruck, IEye } from "../icons";

export function expiryState(expiry: string) {
  const t = todayISO();
  if (expiry < t) return "expired";
  if (expiry <= dISO(30)) return "expiring";
  return "ok";
}

/* ================= Pharmacy ================= */

export default function PharmacyView() {
  const { db, user, mutate, toast, nav } = useStore();
  const [tab, setTab] = useState(nav.tab === "inventory" ? "inventory" : "rx");
  const [dispenseFor, setDispenseFor] = useState<RxOrder | null>(null);
  const [restockFor, setRestockFor] = useState<string | null>(null);

  const canDispense = user?.role === "pharmacist" || user?.role === "admin";
  const t = todayISO();
  const expired = db.medicines.filter((m) => m.expiry < t);
  const expiring = db.medicines.filter((m) => m.expiry >= t && m.expiry <= dISO(30));
  const low = db.medicines.filter((m) => m.stock > 0 && m.stock <= m.reorderLevel);
  const out = db.medicines.filter((m) => m.stock === 0);

  const pending = db.rxOrders.filter((r) => r.status === "pending");

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Pharmacy</h1>
          <p className="text-xs text-ink-faint">E-prescriptions dispensed against live inventory — stock decrements automatically</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          <span className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-red-700">● Expired {expired.length}</span>
          <span className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">● Expiring ≤30d {expiring.length}</span>
          <span className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">● Low stock {low.length}</span>
          <span className="flex items-center gap-1 rounded-lg border border-line bg-pine-900 px-2 py-1 text-white">● Out of stock {out.length}</span>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { k: "rx", label: "Prescriptions", count: pending.length },
        { k: "inventory", label: "Drug Inventory", count: db.medicines.length },
        { k: "sold", label: "Top Sellers" },
      ]} />

      {tab === "rx" && (
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="py-2.5 pr-3 font-semibold">Rx</th>
                <th className="py-2.5 pr-3 font-semibold">Patient</th>
                <th className="py-2.5 pr-3 font-semibold">Prescriber</th>
                <th className="py-2.5 pr-3 font-semibold">Items</th>
                <th className="py-2.5 pr-3 font-semibold">Value</th>
                <th className="py-2.5 pr-3 font-semibold">Received</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {db.rxOrders.map((r) => {
                const p = db.patients.find((x) => x.mrn === r.patientMrn);
                const doc = db.staff.find((s) => s.id === r.doctorId);
                const value = r.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                return (
                  <tr key={r.id} className="border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40">
                    <td className="py-2.5 pr-3 font-mono font-bold text-med-700">{r.id}</td>
                    <td className="py-2.5 pr-3"><span className="flex items-center gap-2"><Avatar name={p?.name ?? "?"} size={26} /><span className="font-semibold text-ink">{p?.name}</span></span></td>
                    <td className="py-2.5 pr-3 text-ink-soft">{doc?.name}</td>
                    <td className="py-2.5 pr-3 text-ink-soft">{r.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-ink">{ghs(value)}</td>
                    <td className="py-2.5 pr-3 font-mono text-ink-faint">{timeAgo(r.date)}</td>
                    <td className="py-2.5 pr-3"><StatusPill s={r.status} /></td>
                    <td className="py-2.5">
                      {r.status === "pending" && canDispense && <Btn size="xs" onClick={() => setDispenseFor(r)}><IPill size={12} /> Dispense</Btn>}
                      {r.status === "dispensed" && <span className="font-mono text-[10px] text-ink-faint">by {r.dispensedBy}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "inventory" && (
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="py-2.5 pr-3 font-semibold">Medicine</th>
                <th className="py-2.5 pr-3 font-semibold">Category</th>
                <th className="py-2.5 pr-3 font-semibold">Batch</th>
                <th className="py-2.5 pr-3 font-semibold">Supplier</th>
                <th className="py-2.5 pr-3 font-semibold">Stock</th>
                <th className="py-2.5 pr-3 font-semibold">Buy / Sell</th>
                <th className="py-2.5 pr-3 font-semibold">Expiry</th>
                <th className="py-2.5 pr-3 font-semibold">Location</th>
                <th className="py-2.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {db.medicines.map((m) => {
                const es = expiryState(m.expiry);
                return (
                  <tr key={m.id} className={`border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40 ${es === "expired" ? "bg-red-50/40" : ""}`}>
                    <td className="py-2.5 pr-3 font-semibold text-ink">{m.name}</td>
                    <td className="py-2.5 pr-3"><Badge tone="neutral">{m.category}</Badge></td>
                    <td className="py-2.5 pr-3 font-mono text-ink-faint">{m.batch}</td>
                    <td className="py-2.5 pr-3 text-ink-soft">{m.supplier}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`font-mono font-bold ${m.stock === 0 ? "text-alert" : m.stock <= m.reorderLevel ? "text-amberish" : "text-ink"}`}>{m.stock}</span>
                      <span className="ml-1 text-[10px] text-ink-faint">{m.unit}</span>
                      {m.stock === 0 ? <Badge tone="danger" className="ml-1.5">OUT</Badge> : m.stock <= m.reorderLevel ? <Badge tone="warn" className="ml-1.5">LOW</Badge> : null}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-ink-soft">{ghs(m.buyPrice)} / {ghs(m.sellPrice)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={es === "expired" ? "danger" : es === "expiring" ? "warn" : "ok"}>
                        {es === "expired" ? <IAlert size={9} /> : null} {fmtDate(m.expiry)}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[10.5px] text-ink-faint">{m.location}</td>
                    <td className="py-2.5">
                      <Btn variant="outline" size="xs" onClick={() => setRestockFor(m.id)}><IRefresh size={12} /> Restock</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "sold" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <SectionHead title="Most Dispensed — 30 days" sub="Units dispensed per product" />
            <HBars items={[
              { label: "Paracetamol 500mg", value: 640, color: "#0e7a63" },
              { label: "Artemether-Lumefantrine", value: 410, color: "#1d6fb8" },
              { label: "Amoxicillin 500mg", value: 355, color: "#b45309" },
              { label: "Metformin 500mg", value: 290, color: "#0f766e" },
              { label: "Amlodipine 10mg", value: 210, color: "#be123c" },
            ]} />
          </Card>
          <Card className="p-4">
            <SectionHead title="Pharmacy Revenue" sub="Dispensing value, last 7 days (GH₵)" />
            <HBars items={[
              { label: "Mon", value: 1240 }, { label: "Tue", value: 980 }, { label: "Wed", value: 1510 },
              { label: "Thu", value: 1105 }, { label: "Fri", value: 1780 }, { label: "Sat", value: 890 }, { label: "Sun", value: 620 },
            ]} />
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-med-50 px-3 py-2 text-[11px] font-semibold text-med-800">
              <ITruck size={14} /> Purchase records: 3 POs open with Zuellig Pharma & Mediphar Ghana — next delivery Friday.
            </p>
          </Card>
        </div>
      )}

      {dispenseFor && <DispenseModal rx={dispenseFor} onClose={() => setDispenseFor(null)} />}
      {restockFor && <RestockModal medId={restockFor} onClose={() => setRestockFor(null)} />}
    </div>
  );
}

function DispenseModal({ rx, onClose }: { rx: RxOrder; onClose: () => void }) {
  const { db, user, mutate, toast } = useStore();
  const p = db.patients.find((x) => x.mrn === rx.patientMrn);
  const shortages = useMemo(
    () => rx.items.filter((i) => (db.medicines.find((m) => m.id === i.medId)?.stock ?? 0) < i.qty),
    [rx, db.medicines]
  );
  const total = rx.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  const confirm = () => {
    mutate(
      (d) => {
        const r = d.rxOrders.find((x) => x.id === rx.id)!;
        r.status = "dispensed";
        r.dispensedBy = user?.name ?? "Pharmacy";
        r.dispensedAt = new Date().toISOString();
        r.items.forEach((i) => {
          const med = d.medicines.find((m) => m.id === i.medId)!;
          med.stock = Math.max(0, med.stock - i.qty);
          charge(d, rx.patientMrn, { desc: `Pharmacy: ${i.name} ×${i.qty}`, amount: i.qty * i.unitPrice, kind: "pharmacy" });
        });
      },
      {
        audit: `Dispensed ${rx.id} for ${p?.name} — ${ghs(total)} billed`,
        notify: { text: `Prescription ${rx.id} ready for pickup — ${p?.name} notified by SMS`, icon: "rx", roles: ["admin", "reception"] },
      }
    );
    toast(`${rx.id} dispensed — ${ghs(total)} added to bill, patient SMS sent`, "ok");
    onClose();
  };

  return (
    <Modal title={`Dispense ${rx.id}`} sub={`${p?.name} (${rx.patientMrn}) · prescribed by ${db.staff.find((s) => s.id === rx.doctorId)?.name}`} onClose={onClose} w="max-w-lg"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={confirm} disabled={shortages.length > 0}><ICheck size={14} /> Confirm dispensing</Btn>
      </>}>
      <div className="space-y-2">
        {rx.items.map((i) => {
          const med = db.medicines.find((m) => m.id === i.medId);
          const ok = (med?.stock ?? 0) >= i.qty;
          return (
            <div key={i.medId} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${ok ? "border-line-soft bg-paper/50" : "border-red-200 bg-red-50"}`}>
              <div>
                <p className="text-xs font-semibold text-ink">{i.name}</p>
                <p className="text-[10.5px] text-ink-faint">{i.dose} · {i.freq} · {i.duration} · batch {med?.batch}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs font-bold text-ink">×{i.qty} = {ghs(i.qty * i.unitPrice)}</p>
                <p className={`font-mono text-[10px] ${ok ? "text-emerald-700" : "font-bold text-alert"}`}>{ok ? `${med?.stock} in stock ✓` : `only ${med?.stock} available`}</p>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-lg bg-pine-900 px-3 py-2.5 text-white">
          <span className="text-xs font-semibold">Dispensing total (auto-billed)</span>
          <span className="font-mono text-sm font-bold text-mint">{ghs(total)}</span>
        </div>
        {shortages.length > 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
            <IAlert size={13} /> Insufficient stock for {shortages.length} item(s) — restock before dispensing.
          </p>
        )}
      </div>
    </Modal>
  );
}

function RestockModal({ medId, onClose }: { medId: string; onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const med = db.medicines.find((m) => m.id === medId)!;
  const [qty, setQty] = useState("100");
  const save = () => {
    const q = parseInt(qty);
    if (!q || q <= 0) {
      toast("Enter a valid quantity", "danger");
      return;
    }
    mutate(
      (d) => {
        d.medicines.find((m) => m.id === medId)!.stock += q;
      },
      { audit: `Restocked ${med.name} +${q} ${med.unit} (received from ${med.supplier})`, notify: { text: `Stock received: ${med.name} +${q} ${med.unit}`, icon: "stock", roles: ["admin", "pharmacist"] } }
    );
    toast(`${med.name} restocked — new level ${med.stock + q} ${med.unit}`, "ok");
    onClose();
  };
  return (
    <Modal title={`Restock — ${med.name}`} sub={`Current: ${med.stock} ${med.unit} · reorder level ${med.reorderLevel} · supplier ${med.supplier}`} onClose={onClose} w="max-w-sm"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><ITruck size={14} /> Receive stock</Btn></>}>
      <Field label="Quantity received"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
    </Modal>
  );
}

/* ================= General Inventory (non-drug) ================= */

export function InventoryView() {
  const { db, mutate, toast } = useStore();
  const [restockFor, setRestockFor] = useState<string | null>(null);
  const [qty, setQty] = useState("50");

  const lowItems = db.inventory.filter((i) => i.stock <= i.reorderLevel);

  const save = () => {
    const it = db.inventory.find((x) => x.id === restockFor)!;
    const q = parseInt(qty);
    if (!q || q <= 0) {
      toast("Enter a valid quantity", "danger");
      return;
    }
    mutate(
      (d) => {
        const t = d.inventory.find((x) => x.id === restockFor)!;
        t.stock += q;
        t.lastRestocked = todayISO();
      },
      { audit: `Restocked ${it.name} +${q} ${it.unit}`, notify: { text: `Inventory received: ${it.name} +${q} ${it.unit}`, icon: "stock", roles: ["admin"] } }
    );
    toast(`${it.name} restocked to ${it.stock + q} ${it.unit}`, "ok");
    setRestockFor(null);
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">General Inventory</h1>
          <p className="text-xs text-ink-faint">Consumables, PPE, lab supplies and linen — low-stock alerts raised automatically</p>
        </div>
        <Badge tone="warn"><IAlert size={11} /> {lowItems.length} item(s) at or below reorder level</Badge>
      </div>

      {lowItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lowItems.map((i) => (
            <span key={i.id} className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">
              <IAlert size={12} /> Low Inventory Alert: {i.name} — {i.stock} remaining
            </span>
          ))}
        </div>
      )}

      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-2.5 pr-3 font-semibold">Item</th>
              <th className="py-2.5 pr-3 font-semibold">Category</th>
              <th className="py-2.5 pr-3 font-semibold">Stock level</th>
              <th className="py-2.5 pr-3 font-semibold">Reorder at</th>
              <th className="py-2.5 pr-3 font-semibold">Location</th>
              <th className="py-2.5 pr-3 font-semibold">Last restocked</th>
              <th className="py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {db.inventory.map((i) => {
              const isLow = i.stock <= i.reorderLevel;
              return (
                <tr key={i.id} className={`border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40 ${isLow ? "bg-amber-50/40" : ""}`}>
                  <td className="py-2.5 pr-3"><span className="flex items-center gap-2 font-semibold text-ink"><IBox size={14} className="text-med-500" />{i.name}</span></td>
                  <td className="py-2.5 pr-3"><Badge tone="neutral">{i.category}</Badge></td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-10 font-mono font-bold ${isLow ? "text-amberish" : "text-ink"}`}>{i.stock}</span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line-soft">
                        <div className={`h-full rounded-full ${isLow ? "bg-amber-500" : "bg-med-500"}`} style={{ width: `${Math.min(100, (i.stock / (i.reorderLevel * 2.5)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-ink-faint">{i.unit}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-ink-soft">{i.reorderLevel}</td>
                  <td className="py-2.5 pr-3 text-ink-soft">{i.location}</td>
                  <td className="py-2.5 pr-3 font-mono text-ink-faint">{fmtDate(i.lastRestocked)}</td>
                  <td className="py-2.5"><Btn variant="outline" size="xs" onClick={() => { setRestockFor(i.id); setQty("50"); }}><IEye size={12} /> Restock</Btn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {restockFor && (
        <Modal title={`Restock — ${db.inventory.find((x) => x.id === restockFor)?.name}`} onClose={() => setRestockFor(null)} w="max-w-sm"
          footer={<><Btn variant="ghost" onClick={() => setRestockFor(null)}>Cancel</Btn><Btn onClick={save}><ITruck size={14} /> Receive stock</Btn></>}>
          <Field label="Quantity received"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
