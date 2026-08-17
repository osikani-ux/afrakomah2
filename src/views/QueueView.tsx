import { useState } from "react";
import { useStore } from "../store";
import { QUEUE_DEPTS, timeAgo } from "../data";
import { Badge, Btn, Card, SectionHead, EcgStrip } from "../ui";
import { IArrowR, IBell, IPlus, IRefresh, IStetho, IFlask, IPill, IReceipt } from "../icons";

const ICONS: Record<string, React.ReactNode> = {
  stetho: <IStetho size={15} />, flask: <IFlask size={15} />, pill: <IPill size={15} />, receipt: <IReceipt size={15} />,
};

export default function QueueView() {
  const { db, mutate, toast, user } = useStore();
  const [dept, setDept] = useState<string>("consult");
  const meta = QUEUE_DEPTS.find((q) => q.key === dept)!;
  const st = db.queues[dept];

  const callNext = () => {
    if (!st || st.waiting.length === 0) {
      toast("Queue is empty — no one to call", "warn");
      return;
    }
    const next = st.waiting[0];
    mutate(
      (d) => {
        const q = d.queues[dept];
        q.serving = q.waiting.shift()!;
      },
      {
        audit: `Called ${next} at ${meta.label} counter`,
        notify: { text: `Queue ${meta.label}: now serving ${next} — proceed to ${meta.room}`, icon: "alert", roles: ["admin", "reception", "nurse"] },
      }
    );
    toast(`Now serving ${next} at ${meta.label}`, "ok");
  };

  const recall = () => {
    if (!st?.serving) return;
    toast(`Recalling ${st.serving} — announcement repeated`, "info");
    mutate(() => {}, { audit: `Recalled ${st.serving} at ${meta.label}` });
  };

  const addWalkIn = () => {
    const no = `${meta.prefix}${String((st?.seq ?? 0) + 1).padStart(2, "0")}`;
    mutate(
      (d) => {
        const q = d.queues[dept];
        q.seq += 1;
        q.waiting.push(no);
      },
      { audit: `Added walk-in ${no} to ${meta.label} queue` }
    );
    toast(`Walk-in ${no} added to ${meta.label} queue`, "ok");
  };

  const queueAudit = db.audit.filter((a) => a.action.toLowerCase().includes("queue") || a.action.toLowerCase().includes("called")).slice(0, 6);

  return (
    <div className="fade-up space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Queue Management</h1>
          <p className="text-xs text-ink-faint">Token-based serving for consultation, laboratory, pharmacy and billing counters</p>
        </div>
        <div className="flex gap-1.5">
          {QUEUE_DEPTS.map((q) => (
            <button
              key={q.key}
              onClick={() => setDept(q.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                dept === q.key ? "border-pine-800 bg-pine-900 text-mint shadow-sm" : "border-line bg-white text-ink-soft hover:border-med-300"
              }`}
            >
              {ICONS[q.icon]} {q.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* display board */}
      <div className="relative overflow-hidden rounded-2xl bg-pine-950 text-white">
        <div className="bg-pine-grid absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 opacity-40">
          <EcgStrip className="h-10 w-full" />
        </div>
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">{meta.label}</p>
            <div className="mt-2 flex items-end gap-4">
              <p className="font-mono text-[84px] font-semibold leading-none tracking-tight text-white">
                {st?.serving ?? "——"}
              </p>
              <span className="blink-soft mb-3 inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Now serving
              </span>
            </div>
            <p className="mt-2 text-sm text-white/60">
              Please proceed to <span className="font-semibold text-white">{meta.room}</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Btn variant="dark" size="md" onClick={callNext}><IArrowR size={15} /> Call next</Btn>
              <Btn variant="dark" size="md" onClick={recall} disabled={!st?.serving}><IRefresh size={14} /> Recall</Btn>
              <button onClick={addWalkIn} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-all hover:border-mint/50 hover:text-mint">
                <IPlus size={14} /> Walk-in token
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Waiting next</p>
            <div className="mt-3 space-y-2">
              {(st?.waiting ?? []).slice(0, 5).map((w, i) => (
                <div key={w} className={`flex items-center justify-between rounded-lg px-3 py-2 ${i === 0 ? "border border-mint/40 bg-mint/10" : "bg-white/5"}`}>
                  <span className={`font-mono text-lg font-semibold ${i === 0 ? "text-mint" : "text-white/70"}`}>{w}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{i === 0 ? "up next" : `position ${i + 1}`}</span>
                </div>
              ))}
              {(st?.waiting ?? []).length === 0 && <p className="py-6 text-center text-xs text-white/40">Queue clear — no one waiting</p>}
              {(st?.waiting.length ?? 0) > 5 && (
                <p className="pt-1 text-center font-mono text-[10px] text-white/40">+{(st?.waiting.length ?? 0) - 5} more waiting</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* all departments snapshot */}
        <Card className="p-4 lg:col-span-2">
          <SectionHead title="All Counters" sub="Live status across the hospital" />
          <div className="grid gap-3 sm:grid-cols-2">
            {QUEUE_DEPTS.map((q) => {
              const s = db.queues[q.key];
              return (
                <button
                  key={q.key}
                  onClick={() => setDept(q.key)}
                  className={`rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    dept === q.key ? "border-med-400 bg-med-50/60" : "border-line bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{ICONS[q.icon]} {q.label}</span>
                    <Badge tone={s?.waiting.length ? "warn" : "ok"}>{s?.waiting.length ?? 0} waiting</Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-med-700">{s?.serving ?? "—"}</span>
                    <span className="text-[10.5px] text-ink-faint">serving · {q.room}</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {(s?.waiting ?? []).slice(0, 6).map((w) => (
                      <span key={w} className="rounded-md bg-line-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-soft">{w}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <SectionHead title="Counter Activity" sub="Recent queue events" />
          <div className="space-y-2.5">
            {queueAudit.map((a) => (
              <div key={a.id} className="flex gap-2.5 rounded-lg border border-line-soft bg-paper/50 px-3 py-2">
                <IBell size={13} className="mt-0.5 shrink-0 text-med-500" />
                <div className="min-w-0">
                  <p className="text-[11.5px] leading-snug text-ink">{a.action}</p>
                  <p className="font-mono text-[9.5px] text-ink-faint">{a.user} · {timeAgo(a.at)}</p>
                </div>
              </div>
            ))}
            {queueAudit.length === 0 && <p className="py-4 text-center text-xs text-ink-faint">No queue events yet today</p>}
          </div>
          <p className="mt-3 rounded-lg bg-pine-900 px-3 py-2 text-center font-mono text-[10px] text-mint">
            Signed in: {user?.name} · tokens reset daily at 07:00
          </p>
        </Card>
      </div>
    </div>
  );
}
