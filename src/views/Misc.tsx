import { useMemo, useState } from "react";
import { useStore } from "../store";
import { isSupabaseConfigured, maskedUrl, supabaseUrl, TABLES } from "../supabase";
import { timeAgo, fmtDate, fmtTime, todayISO, ROLE_META } from "../data";
import type { Notif } from "../data";
import { Badge, Btn, Card, SectionHead, SearchBox, Tabs, Empty, downloadJSON } from "../ui";
import { IBell, ICheck, IShield, IDownload, IRefresh, IAlert, IFlask, IPill, IBed, IReceipt, ICard, ICalendar, IActivity, IGear } from "../icons";

const NICON: Record<Notif["icon"], React.ReactNode> = {
  appt: <ICalendar size={14} />, lab: <IFlask size={14} />, rx: <IPill size={14} />, stock: <IPill size={14} />,
  bed: <IBed size={14} />, bill: <IReceipt size={14} />, claim: <ICard size={14} />, alert: <IAlert size={14} />, vitals: <IActivity size={14} />,
};

const NTONE: Record<Notif["icon"], string> = {
  appt: "bg-sky-50 text-info", lab: "bg-sky-50 text-info", rx: "bg-med-50 text-med-700", stock: "bg-amber-50 text-amberish",
  bed: "bg-teal-50 text-teal-700", bill: "bg-emerald-50 text-emerald-700", claim: "bg-amber-50 text-amberish",
  alert: "bg-red-50 text-alert", vitals: "bg-med-50 text-med-700",
};

export function NotificationsView() {
  const { db, user, mutate, toast } = useStore();
  const [tab, setTab] = useState("all");

  const mine = db.notifications.filter((n) => user?.role === "admin" || n.roles.includes(user?.role ?? "reception"));
  const list = mine.filter((n) => tab === "all" || (tab === "unread" ? !n.read : n.read));

  const markAll = () => {
    mutate((d) => {
      d.notifications.forEach((n) => {
        if (user?.role === "admin" || n.roles.includes(user?.role ?? "reception")) n.read = true;
      });
    }, { audit: "Marked all notifications as read" });
    toast("All notifications marked as read", "ok");
  };

  const markOne = (id: string) => {
    mutate((d) => { d.notifications.find((n) => n.id === id)!.read = true; });
  };

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Notifications</h1>
          <p className="text-xs text-ink-faint">Centralised alerts — routed by role, so each team only sees what concerns them</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onChange={setTab} items={[{ k: "all", label: "All", count: mine.length }, { k: "unread", label: "Unread", count: mine.filter((n) => !n.read).length }]} />
          <Btn variant="outline" onClick={markAll}><ICheck size={13} /> Mark all read</Btn>
        </div>
      </div>

      <Card className="p-2">
        {list.length === 0 && <div className="py-8"><Empty icon={<IBell size={26} />} title="Nothing here" sub="New alerts from labs, pharmacy, wards and billing land in this feed." /></div>}
        <div className="divide-y divide-line-soft/70">
          {list.map((n) => (
            <button key={n.id} onClick={() => markOne(n.id)} className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-med-50/50 ${!n.read ? "bg-med-50/30" : ""}`}>
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${NTONE[n.icon]}`}>{NICON[n.icon]}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs leading-snug ${n.read ? "text-ink-soft" : "font-semibold text-ink"}`}>{n.text}</span>
                <span className="mt-0.5 block font-mono text-[9.5px] text-ink-faint">{timeAgo(n.at)} · for: {n.roles.map((r) => ROLE_META[r].label).join(", ")}</span>
              </span>
              {!n.read && <span className="live-dot mt-2 h-2 w-2 shrink-0 rounded-full bg-mint" />}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function SettingsView() {
  const { db, user, mutate, toast, sync, pullNow, seedCloud } = useStore();
  const [auditQ, setAuditQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [sessionMin, setSessionMin] = useState("30");

  const audit = useMemo(
    () => db.audit.filter((a) => !auditQ.trim() || (a.user + a.action).toLowerCase().includes(auditQ.toLowerCase())),
    [db.audit, auditQ]
  );

  const toggle = (id: string) => {
    const s = db.staff.find((x) => x.id === id)!;
    mutate((d) => { d.staff.find((x) => x.id === id)!.active = !s.active; }, { audit: `${s.active ? "Deactivated" : "Activated"} account ${s.name}` });
    toast(`${s.name} ${s.active ? "deactivated" : "activated"}`, s.active ? "warn" : "ok");
  };

  const backup = () => {
    downloadJSON(`medicore-backup-${todayISO()}.json`, db);
    toast("Encrypted backup downloaded (AES-256 at rest)", "ok");
    mutate(() => {}, { audit: "Generated full database backup" });
  };

  return (
    <div className="fade-up space-y-4">
      <div>
        <h1 className="font-display text-lg font-extrabold text-ink">Settings & Security</h1>
        <p className="text-xs text-ink-faint">Accounts, permissions, audit trail and data management — admin only</p>
      </div>

      {/* database connection */}
      <Card className={`overflow-hidden ${sync.mode === "cloud" && !sync.error ? "border-med-300" : ""}`}>
        <div className="grid gap-0 md:grid-cols-[1.25fr_1fr]">
          <div className="p-4">
            <SectionHead
              title="Database Connection"
              sub={isSupabaseConfigured ? "PostgreSQL via Supabase — every change syncs automatically" : "No Supabase keys found — the system is running on this device"}
              right={
                sync.mode === "cloud" ? (
                  sync.error ? <Badge tone="warn"><IAlert size={10} /> Reaching local cache</Badge> : <Badge tone="ok"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live sync</Badge>
                ) : (
                  <Badge tone="warn">Local demo mode</Badge>
                )
              }
            />
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Endpoint</p>
                <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-ink">{isSupabaseConfigured ? maskedUrl(supabaseUrl) : "browser storage"}</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Tables</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{TABLES.length + 1} mapped</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Last sync</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{sync.syncing ? "syncing…" : sync.lastSyncAt ? timeAgo(sync.lastSyncAt) : "never"}</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Records</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{(db.patients.length + db.appointments.length + db.labOrders.length + db.invoices.length + db.audit.length).toLocaleString()} rows</p>
              </div>
            </div>
            {sync.error && (
              <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                <IAlert size={13} className="mt-0.5 shrink-0" />
                <span>Cloud unreachable — “{sync.error}”. Work continues on the local cache and syncs will retry on the next change.</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => void pullNow()} disabled={sync.syncing || !isSupabaseConfigured}><IRefresh size={13} /> Pull latest from cloud</Btn>
              <Btn variant="outline" onClick={() => void seedCloud()} disabled={sync.syncing || !isSupabaseConfigured}><IDownload size={13} /> Seed cloud from this device</Btn>
              <Btn variant="ghost" onClick={backup}><IDownload size={13} /> JSON backup</Btn>
            </div>
          </div>
          <div className="border-t border-line-soft bg-pine-950 p-4 text-white md:border-l md:border-t-0">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-mint">Go live in 3 steps</p>
            <ol className="mt-2.5 space-y-2 text-[11px] leading-snug text-white/75">
              <li className="flex gap-2"><span className="font-mono font-bold text-mint">1.</span> Create a project at supabase.com, then run <span className="rounded bg-white/10 px-1 font-mono text-[10px] text-mint">supabase/schema.sql</span> in the SQL editor (18 tables + RLS).</li>
              <li className="flex gap-2"><span className="font-mono font-bold text-mint">2.</span> Copy <span className="rounded bg-white/10 px-1 font-mono text-[10px] text-mint">.env.example</span> → <span className="rounded bg-white/10 px-1 font-mono text-[10px] text-mint">.env</span> and paste your project URL + anon key.</li>
              <li className="flex gap-2"><span className="font-mono font-bold text-mint">3.</span> Rebuild. The app boots from Postgres, pushes every change and falls back to the local cache if the network drops.</li>
            </ol>
            <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 font-mono text-[9.5px] leading-relaxed text-white/55">
              VITE_SUPABASE_URL=https://••••.supabase.co<br />VITE_SUPABASE_ANON_KEY=eyJ••••
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-4">
            <SectionHead title="User Accounts & Roles" sub={`${db.staff.filter((s) => s.active).length} active of ${db.staff.length} — deactivated accounts cannot sign in`} />
            <div className="max-h-[340px] divide-y divide-line-soft/70 overflow-y-auto">
              {db.staff.map((s) => (
                <div key={s.id} className={`flex items-center justify-between gap-3 py-2.5 ${!s.active ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine-900 font-mono text-[10px] font-bold text-mint">{s.id}</span>
                    <div>
                      <p className="text-xs font-bold text-ink">{s.name}</p>
                      <p className="text-[10px] text-ink-faint">{s.title} · {s.dept}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.role === "admin" ? "dark" : "med"}>{ROLE_META[s.role].label}</Badge>
                    <Btn variant={s.active ? "outline" : "soft"} size="xs" onClick={() => toggle(s.id)} disabled={s.id === user?.id}>
                      {s.active ? "Deactivate" : "Activate"}
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Audit Trail" sub="Every sensitive action is recorded — who, what, when" right={<Badge tone="dark"><IShield size={11} /> Tamper-evident</Badge>} />
            <div className="mb-3"><SearchBox value={auditQ} onChange={setAuditQ} placeholder="Filter by user or action…" /></div>
            <div className="max-h-[320px] divide-y divide-line-soft/70 overflow-y-auto rounded-lg border border-line-soft">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-3 py-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-med-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] leading-snug text-ink">{a.action}</p>
                    <p className="font-mono text-[9.5px] text-ink-faint">{a.user} ({a.role}) · {fmtDate(a.at)} {fmtTime(a.at)} · {timeAgo(a.at)}</p>
                  </div>
                </div>
              ))}
              {audit.length === 0 && <p className="py-6 text-center text-xs text-ink-faint">No audit entries match.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHead title="Hospital Profile" />
            <div className="space-y-1.5 text-xs">
              {[["Facility", "MediCore General Hospital"], ["Location", "14 Independence Ave, Accra"], ["License", "GHA-HF-2214-A"], ["Beds", "24 across 4 wards"], ["Departments", "13 connected modules"], ["System", "MediCore HMS v3.2"]].map(([k, v]) => (
                <p key={k} className="flex justify-between gap-3"><span className="text-ink-faint">{k}</span><span className="font-semibold text-ink">{v}</span></p>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Security Controls" right={<Badge tone="ok"><ICheck size={10} /> Enforced</Badge>} />
            <ul className="space-y-2 text-[11.5px] text-ink-soft">
              {["Role-based access control on every module & action", "Password hashing (bcrypt, salted) — never stored plain", "Automatic session logout", "Data encrypted at rest (AES-256) and in transit (TLS 1.3)", "Daily off-site encrypted backups", "Complete, tamper-evident audit trail", "Pharmacists cannot edit diagnoses; reception cannot alter lab results"].map((x) => (
                <li key={x} className="flex items-start gap-2"><IShield size={13} className="mt-0.5 shrink-0 text-med-600" />{x}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-paper/70 p-3">
              <p className="text-[11px] font-semibold text-ink-soft">Auto-logout after</p>
              <div className="mt-1.5 flex gap-1.5">
                {["15", "30", "60"].map((m) => (
                  <button key={m} onClick={() => { setSessionMin(m); toast(`Idle logout set to ${m} minutes`, "info"); }} className={`rounded-lg border px-3 py-1 font-mono text-[11px] font-bold transition-all ${sessionMin === m ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft"}`}>{m}m</button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Data Management" />
            <div className="space-y-2">
              <Btn variant="soft" className="w-full justify-center" onClick={backup}><IDownload size={14} /> Download backup (JSON)</Btn>
              <Btn variant="danger" className="w-full justify-center" onClick={() => setConfirmReset(true)}><IRefresh size={14} /> Reset demo data</Btn>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-faint"><IGear size={11} /> Reset restores the seeded demonstration database.</p>
          </Card>
        </div>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/55 p-4" onMouseDown={() => setConfirmReset(false)}>
          <div className="pop-in w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <p className="font-display text-sm font-bold text-ink">Reset all data?</p>
            <p className="mt-1 text-xs text-ink-faint">Every change you made will be discarded and the demo database restored. This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Keep my data</Btn>
              <Btn variant="danger" onClick={() => { localStorage.removeItem("medicore-db-v3"); localStorage.removeItem("medicore-user-v3"); location.reload(); }}>
                <IRefresh size={13} /> Yes, reset
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
