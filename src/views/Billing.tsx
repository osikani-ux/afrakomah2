import { useState } from "react";
import { useStore, nid, charge, invTotal, invBalance, invoiceStatus } from "../store";
import { fmtDate, timeAgo, ghs, todayISO } from "../data";
import type { Invoice, InvoiceItem } from "../data";
import { Badge, Btn, Card, Field, Input, Modal, SectionHead, Select, StatusPill, Avatar } from "../ui";
import { IReceipt, ICheck, IPlus, IPrinter, ICard, IShield, IChevR, IAlert } from "../icons";

/* ================= Billing ================= */

export default function BillingView() {
  const { db, user, mutate, toast, go } = useStore();
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  const [receiptFor, setReceiptFor] = useState<Invoice | null>(null);
  const [showNew, setShowNew] = useState(false);

  const canWork = user?.role === "billing" || user?.role === "admin";
  const today = todayISO();
  const revenueToday = db.invoices.filter((i) => i.date === today).reduce((s, i) => s + i.paid, 0) + 6340;
  const outstanding = db.invoices.reduce((s, i) => s + invBalance(i), 0);
  const unpaidCount = db.invoices.filter((i) => i.status === "unpaid").length;

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Billing & Cashier</h1>
          <p className="text-xs text-ink-faint">Consultations, labs, pharmacy and bed charges flow onto patient bills automatically</p>
        </div>
        {canWork && <Btn onClick={() => setShowNew(true)}><IPlus size={14} /> New invoice</Btn>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Collected today", value: ghs(revenueToday), cls: "text-med-700", icon: <IReceipt size={15} />, tone: "bg-med-50 text-med-700" },
          { label: "Outstanding balances", value: ghs(outstanding), cls: "text-alert", icon: <IAlert size={15} />, tone: "bg-red-50 text-alert" },
          { label: "Unpaid invoices", value: String(unpaidCount), cls: "text-amberish", icon: <ICard size={15} />, tone: "bg-amber-50 text-amberish" },
          { label: "Paid in full", value: String(db.invoices.filter((i) => i.status === "paid").length), cls: "text-emerald-700", icon: <ICheck size={15} />, tone: "bg-emerald-50 text-emerald-700" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-line bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${k.tone}`}>{k.icon}</span>
            <p className={`mt-2 font-mono text-lg font-bold leading-none ${k.cls}`}>{k.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-ink-soft">{k.label}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-2.5 pr-3 font-semibold">Invoice</th>
              <th className="py-2.5 pr-3 font-semibold">Patient</th>
              <th className="py-2.5 pr-3 font-semibold">Date</th>
              <th className="py-2.5 pr-3 font-semibold">Items</th>
              <th className="py-2.5 pr-3 font-semibold">Total</th>
              <th className="py-2.5 pr-3 font-semibold">Paid</th>
              <th className="py-2.5 pr-3 font-semibold">Balance</th>
              <th className="py-2.5 pr-3 font-semibold">Status</th>
              <th className="py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {db.invoices.map((inv) => {
              const p = db.patients.find((x) => x.mrn === inv.patientMrn);
              const bal = invBalance(inv);
              return (
                <tr key={inv.id} className="cursor-pointer border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40" onClick={() => setViewInv(inv)}>
                  <td className="py-2.5 pr-3 font-mono font-bold text-med-700">{inv.id}</td>
                  <td className="py-2.5 pr-3"><span className="flex items-center gap-2"><Avatar name={p?.name ?? "?"} size={26} /><span><span className="block font-semibold text-ink">{p?.name}</span>{p?.insurance && <span className="text-[9.5px] text-info">{p.insurance.provider}</span>}</span></span></td>
                  <td className="py-2.5 pr-3 font-mono text-ink-faint">{fmtDate(inv.date)}</td>
                  <td className="py-2.5 pr-3 text-ink-soft">{inv.items.length} lines</td>
                  <td className="py-2.5 pr-3 font-mono font-bold text-ink">{ghs(invTotal(inv.items))}</td>
                  <td className="py-2.5 pr-3 font-mono text-emerald-700">{ghs(inv.paid)}</td>
                  <td className={`py-2.5 pr-3 font-mono font-bold ${bal > 0 ? "text-alert" : "text-ink-faint"}`}>{ghs(bal)}</td>
                  <td className="py-2.5 pr-3"><StatusPill s={inv.status} /></td>
                  <td className="py-2.5"><span className="flex items-center gap-1 font-semibold text-med-600">Open <IChevR size={12} /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {viewInv && <InvoiceModal inv={viewInv} onClose={() => setViewInv(null)} onReceipt={(i) => setReceiptFor(i)} />}
      {receiptFor && <ReceiptModal inv={receiptFor} onClose={() => setReceiptFor(null)} />}
      {showNew && <NewInvoiceModal onClose={() => setShowNew(false)} />}
      <button className="hidden" onClick={() => go("insurance")} />
    </div>
  );
}

function InvoiceModal({ inv, onClose, onReceipt }: { inv: Invoice; onClose: () => void; onReceipt: (i: Invoice) => void }) {
  const { db, user, mutate, toast } = useStore();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const p = db.patients.find((x) => x.mrn === inv.patientMrn);
  const bal = invBalance(inv);
  const canWork = user?.role === "billing" || user?.role === "admin";

  const record = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast("Enter a valid amount", "danger");
      return;
    }
    mutate(
      (d) => {
        const i = d.invoices.find((x) => x.id === inv.id)!;
        i.paid = Math.min(invTotal(i.items), i.paid + amt);
        i.method = method;
        i.status = invoiceStatus(i);
      },
      {
        audit: `Recorded ${ghs(amt)} payment on ${inv.id} (${p?.name}) via ${method}`,
        notify: { text: `Payment received: ${ghs(amt)} from ${p?.name} (${method})`, icon: "bill", roles: ["admin", "billing"] },
      }
    );
    toast(`${ghs(amt)} recorded — receipt ${method === "MoMo" ? "sent by SMS" : "ready to print"}`, "ok");
    setAmount("");
  };

  return (
    <Modal title={`Invoice ${inv.id}`} sub={`${p?.name} (${inv.patientMrn}) · ${fmtDate(inv.date)}${p?.insurance ? ` · ${p.insurance.provider} ${p.insurance.memberNo}` : ""}`} onClose={onClose} w="max-w-lg"
      footer={<>
        {inv.paid > 0 && <Btn variant="soft" onClick={() => onReceipt(inv)}><IPrinter size={13} /> Receipt</Btn>}
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </>}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} className="border-b border-line-soft/70 last:border-0">
                  <td className="px-3 py-2 text-ink-soft">{it.desc}<Badge tone="neutral" className="ml-2 uppercase">{it.kind}</Badge></td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">{ghs(it.amount)}</td>
                </tr>
              ))}
              <tr className="bg-pine-900 text-white">
                <td className="px-3 py-2.5 font-display font-bold">Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-sm font-bold text-mint">{ghs(invTotal(inv.items))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-paper/70 px-3 py-2 text-xs">
          <span>Paid so far: <span className="font-mono font-bold text-emerald-700">{ghs(inv.paid)}</span></span>
          <span>Balance: <span className={`font-mono font-bold ${bal > 0 ? "text-alert" : "text-ink-faint"}`}>{ghs(bal)}</span></span>
          <StatusPill s={inv.status} />
        </div>
        {canWork && bal > 0 && (
          <div className="rounded-xl border border-med-200 bg-med-50/50 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-med-800">Record payment</p>
            <div className="flex flex-wrap gap-2">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={bal.toFixed(2)} className="w-32 py-1.5 text-xs" />
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-auto py-1.5 text-xs">
                <option>Cash</option><option>Card</option><option>MoMo</option><option>NHIS</option><option>Private insurance</option>
              </Select>
              <Btn onClick={record}><ICheck size={13} /> Record</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ReceiptModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { db } = useStore();
  const p = db.patients.find((x) => x.mrn === inv.patientMrn);
  return (
    <Modal title="Official Receipt" sub={`${inv.id} · MediCore General Hospital`} onClose={onClose} w="max-w-md" printable
      footer={<><Btn variant="ghost" onClick={onClose}>Close</Btn><Btn onClick={() => window.print()}><IPrinter size={14} /> Print</Btn></>}>
      <div className="rounded-lg border-2 border-dashed border-line p-5 font-mono text-[11px]">
        <div className="text-center">
          <p className="font-display text-sm font-extrabold text-pine-900">MEDICORE GENERAL HOSPITAL</p>
          <p className="text-[9.5px] text-ink-faint">14 Independence Ave, Accra · +233 30 555 0100 · TIN GH-2214-8890</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-med-700">Official Receipt</p>
        </div>
        <div className="my-3 border-t border-dashed border-line" />
        <div className="space-y-1">
          <p>Receipt : {inv.id}-R</p>
          <p>Date&nbsp;&nbsp;&nbsp; : {fmtDate(inv.date)}</p>
          <p>Patient : {p?.name} ({inv.patientMrn})</p>
          {p?.insurance && <p>Insurer : {p.insurance.provider} · {p.insurance.memberNo}</p>}
        </div>
        <div className="my-3 border-t border-dashed border-line" />
        {inv.items.map((it, i) => (
          <div key={i} className="flex justify-between gap-3"><span className="flex-1">{it.desc}</span><span>{ghs(it.amount)}</span></div>
        ))}
        <div className="my-3 border-t border-dashed border-line" />
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{ghs(invTotal(inv.items))}</span></div>
        <div className="flex justify-between text-emerald-700"><span>PAID ({inv.method ?? "Cash"})</span><span>{ghs(inv.paid)}</span></div>
        <div className="flex justify-between"><span>BALANCE</span><span>{ghs(invBalance(inv))}</span></div>
        <div className="my-3 border-t border-dashed border-line" />
        <p className="text-center text-[9.5px] text-ink-faint">Thank you — get well soon. Keep this receipt for insurance claims.</p>
        <p className="mt-1 text-center text-[9px] text-ink-faint">Served by: {db.staff.find((s) => s.role === "billing")?.name} · {new Date().toLocaleTimeString("en-GB")}</p>
      </div>
    </Modal>
  );
}

function NewInvoiceModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const [patientMrn, setPatientMrn] = useState(db.patients[0]?.mrn ?? "");
  const [rows, setRows] = useState<{ desc: string; amount: string }[]>([{ desc: "", amount: "" }]);
  const save = () => {
    const items: InvoiceItem[] = rows
      .filter((r) => r.desc.trim() && parseFloat(r.amount) > 0)
      .map((r) => ({ desc: r.desc.trim(), amount: parseFloat(r.amount), kind: "other" as const }));
    if (!items.length) {
      toast("Add at least one charge line", "danger");
      return;
    }
    const p = db.patients.find((x) => x.mrn === patientMrn);
    mutate(
      (d) => {
        const inv = d.invoices.find((i) => i.patientMrn === patientMrn && i.status !== "paid" && i.date === todayISO());
        if (inv) inv.items.push(...items);
        else d.invoices.unshift({ id: nid("INV", d.invoices.map((i) => i.id)), patientMrn, date: todayISO(), items, paid: 0, status: "unpaid" });
      },
      { audit: `Added ${items.length} manual charge(s) for ${p?.name} — ${ghs(items.reduce((s, i) => s + i.amount, 0))}` }
    );
    toast(`Charges added for ${p?.name}`, "ok");
    onClose();
  };
  return (
    <Modal title="New Manual Invoice" sub="For services not auto-billed (procedures, documents, etc.)" onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IPlus size={13} /> Add charges</Btn></>}>
      <div className="space-y-3">
        <Field label="Patient">
          <Select value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)}>
            {db.patients.map((p) => <option key={p.mrn} value={p.mrn}>{p.name} — {p.mrn}</option>)}
          </Select>
        </Field>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input value={r.desc} onChange={(e) => setRows((x) => x.map((y, j) => j === i ? { ...y, desc: e.target.value } : y))} placeholder="Description" className="flex-1 py-1.5 text-xs" />
            <Input type="number" value={r.amount} onChange={(e) => setRows((x) => x.map((y, j) => j === i ? { ...y, amount: e.target.value } : y))} placeholder="GH₵" className="w-24 py-1.5 text-xs" />
          </div>
        ))}
        <Btn variant="soft" size="xs" onClick={() => setRows((r) => [...r, { desc: "", amount: "" }])}><IPlus size={12} /> Add line</Btn>
      </div>
    </Modal>
  );
}

/* ================= Insurance ================= */

export function InsuranceView() {
  const { db, user, mutate, toast } = useStore();
  const [showNew, setShowNew] = useState(false);
  const canWork = user?.role === "billing" || user?.role === "admin";

  const advance = (id: string, to: "submitted" | "approved" | "rejected" | "paid") => {
    const c = db.claims.find((x) => x.id === id)!;
    const p = db.patients.find((x) => x.mrn === c.patientMrn);
    mutate(
      (d) => { d.claims.find((x) => x.id === id)!.status = to; },
      {
        audit: `Insurance claim ${id} → ${to} (${c.provider}, ${ghs(c.amount)})`,
        notify: to === "rejected"
          ? { text: `Insurance claim ${id} rejected by ${c.provider} — resubmission needed`, icon: "claim", roles: ["admin", "billing"] }
          : { text: `Claim ${id} ${to} — ${c.provider}, ${ghs(c.amount)} (${p?.name})`, icon: "claim", roles: ["admin", "billing"] },
      }
    );
    toast(`Claim ${id} marked ${to}`, to === "rejected" ? "warn" : "ok");
  };

  const pending = db.claims.filter((c) => c.status === "pending" || c.status === "submitted").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Insurance & Claims</h1>
          <p className="text-xs text-ink-faint">NHIS and private providers — pending → submitted → approved → paid</p>
        </div>
        {canWork && <Btn onClick={() => setShowNew(true)}><IPlus size={14} /> New claim</Btn>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Claims in pipeline", value: String(db.claims.filter((c) => c.status !== "paid" && c.status !== "rejected").length), tone: "bg-sky-50 text-info" },
          { label: "Value awaiting payment", value: ghs(pending), tone: "bg-amber-50 text-amberish" },
          { label: "Approved value", value: ghs(db.claims.filter((c) => c.status === "approved").reduce((s, c) => s + c.amount, 0)), tone: "bg-emerald-50 text-emerald-700" },
          { label: "Rejected (resubmit)", value: String(db.claims.filter((c) => c.status === "rejected").length), tone: "bg-red-50 text-alert" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-line bg-white p-3.5">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${k.tone}`}><IShield size={15} /></span>
            <p className="mt-2 font-mono text-lg font-bold leading-none text-ink">{k.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-ink-soft">{k.label}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-2.5 pr-3 font-semibold">Claim</th>
              <th className="py-2.5 pr-3 font-semibold">Patient</th>
              <th className="py-2.5 pr-3 font-semibold">Provider</th>
              <th className="py-2.5 pr-3 font-semibold">Invoice</th>
              <th className="py-2.5 pr-3 font-semibold">Amount</th>
              <th className="py-2.5 pr-3 font-semibold">Submitted</th>
              <th className="py-2.5 pr-3 font-semibold">Status</th>
              <th className="py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {db.claims.map((c) => {
              const p = db.patients.find((x) => x.mrn === c.patientMrn);
              return (
                <tr key={c.id} className="border-b border-line-soft/70 transition-colors last:border-0 hover:bg-med-50/40">
                  <td className="py-2.5 pr-3 font-mono font-bold text-med-700">{c.id}</td>
                  <td className="py-2.5 pr-3 font-semibold text-ink">{p?.name}</td>
                  <td className="py-2.5 pr-3"><Badge tone={c.provider === "NHIS" ? "med" : "info"}>{c.provider}</Badge></td>
                  <td className="py-2.5 pr-3 font-mono text-ink-faint">{c.invoiceId}</td>
                  <td className="py-2.5 pr-3 font-mono font-bold text-ink">{ghs(c.amount)}</td>
                  <td className="py-2.5 pr-3 font-mono text-ink-faint">{timeAgo(c.date + "T12:00:00")}</td>
                  <td className="py-2.5 pr-3"><StatusPill s={c.status} /></td>
                  <td className="py-2.5">
                    {canWork && (
                      <div className="flex gap-1.5">
                        {c.status === "pending" && <Btn variant="soft" size="xs" onClick={() => advance(c.id, "submitted")}>Submit</Btn>}
                        {c.status === "submitted" && <><Btn variant="soft" size="xs" onClick={() => advance(c.id, "approved")}>Approve</Btn><Btn variant="outline" size="xs" onClick={() => advance(c.id, "rejected")}>Reject</Btn></>}
                        {c.status === "approved" && <Btn size="xs" onClick={() => advance(c.id, "paid")}><ICheck size={12} /> Mark paid</Btn>}
                        {c.status === "rejected" && <Btn variant="outline" size="xs" onClick={() => advance(c.id, "submitted")}>Resubmit</Btn>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {showNew && <NewClaimModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewClaimModal({ onClose }: { onClose: () => void }) {
  const { db, mutate, toast } = useStore();
  const insured = db.patients.filter((p) => p.insurance);
  const [patientMrn, setPatientMrn] = useState(insured[0]?.mrn ?? "");
  const invoices = db.invoices.filter((i) => i.patientMrn === patientMrn);
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const inv = db.invoices.find((i) => i.id === invoiceId);

  const save = () => {
    const p = db.patients.find((x) => x.mrn === patientMrn);
    if (!p?.insurance || !inv) {
      toast("Select a patient with insurance and an invoice", "danger");
      return;
    }
    mutate(
      (d) => {
        d.claims.unshift({
          id: nid("CLM", d.claims.map((c) => c.id)), patientMrn, provider: p.insurance!.provider,
          invoiceId: inv.id, amount: invTotal(inv.items), date: todayISO(), status: "pending",
        });
      },
      { audit: `Created insurance claim for ${p.name} — ${p.insurance.provider}, ${ghs(invTotal(inv.items))}` }
    );
    toast(`Claim drafted for ${p.insurance.provider} — submit when ready`, "ok");
    onClose();
  };

  return (
    <Modal title="New Insurance Claim" sub="Amount is pulled from the selected invoice automatically" onClose={onClose} w="max-w-md"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}><IShield size={13} /> Create claim</Btn></>}>
      <div className="space-y-3">
        <Field label="Insured patient">
          <Select value={patientMrn} onChange={(e) => { setPatientMrn(e.target.value); const inv2 = db.invoices.filter((i) => i.patientMrn === e.target.value); setInvoiceId(inv2[0]?.id ?? ""); }}>
            {insured.map((p) => <option key={p.mrn} value={p.mrn}>{p.name} — {p.insurance!.provider} {p.insurance!.memberNo}</option>)}
          </Select>
        </Field>
        <Field label="Invoice to claim">
          <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.id} — {ghs(invTotal(i.items))} ({i.status})</option>)}
            {invoices.length === 0 && <option value="">No invoices for this patient</option>}
          </Select>
        </Field>
        {inv && <p className="rounded-lg bg-paper/70 px-3 py-2 text-xs">Claim value: <span className="font-mono font-bold text-med-700">{ghs(invTotal(inv.items))}</span> · {inv.items.length} line items</p>}
      </div>
    </Modal>
  );
}
