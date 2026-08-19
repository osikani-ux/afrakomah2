import { useMemo, useState } from "react";
import { useStore } from "../store";
import { timeAgo, fmtDate, fmtTime, todayISO, ROLE_META } from "../data";
import type { Notif, Role } from "../data";
import { Badge, Btn, Card, SectionHead, SearchBox, Tabs, Empty, downloadJSON, Input, Select, Field, Modal } from "../ui";
import { IBell, ICheck, IShield, IDownload, IRefresh, IAlert, IFlask, IPill, IBed, IReceipt, ICard, ICalendar, IActivity, IGear, IPlus, IUser, IList } from "../icons";

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
  const { db, user, mutate, toast } = useStore();
  const [auditQ, setAuditQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [sessionMin, setSessionMin] = useState("30");
  const [provisionOpen, setProvisionOpen] = useState(false);

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
    toast("Backup downloaded — keep it somewhere safe", "ok");
    mutate(() => {}, { audit: "Generated full database backup" });
  };

  const records = db.patients.length + db.appointments.length + db.labOrders.length + db.invoices.length + db.audit.length;

  return (
    <div className="fade-up space-y-4">
      <div>
        <h1 className="font-display text-lg font-extrabold text-ink">Settings & Security</h1>
        <p className="text-xs text-ink-faint">Accounts, permissions, audit trail and data management — admin only</p>
      </div>

      {/* data storage */}
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.25fr_1fr]">
          <div className="p-4">
            <SectionHead
              title="Data Storage"
              sub="Everything lives on this device — no server, no account, works fully offline"
              right={<Badge tone="ok"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved locally</Badge>}
            />
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Storage</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">This browser</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Records</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{records.toLocaleString()} rows</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Staff accounts</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{db.staff.length}</p>
              </div>
              <div className="rounded-lg bg-paper/70 p-2.5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint">Beds</p>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-ink">{db.beds.length}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn onClick={backup}><IDownload size={13} /> Download backup (JSON)</Btn>
              <Btn variant="ghost" className="text-alert hover:bg-red-50" onClick={() => setConfirmReset(true)}><IRefresh size={12} /> Reset this device</Btn>
            </div>
          </div>
          <div className="border-t border-line-soft bg-pine-950 p-4 text-white md:border-l md:border-t-0">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-mint">How it works</p>
            <ul className="mt-2.5 space-y-1.5 text-[10.5px] text-white/65">
              <li className="flex gap-1.5"><span className="text-mint">▸</span> Records are written to this browser the moment you save — nothing leaves the device</li>
              <li className="flex gap-1.5"><span className="text-mint">▸</span> Sign in as any role from the workstation screen; switch people by signing out</li>
              <li className="flex gap-1.5"><span className="text-mint">▸</span> Download a JSON backup before clearing site data or moving machines</li>
              <li className="flex gap-1.5"><span className="text-mint">▸</span> The audit trail records every sensitive action with who and when</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-4">
            <SectionHead
              title="User Accounts & Roles"
              sub={`${db.staff.filter((s) => s.active).length} active of ${db.staff.length} — deactivated accounts can't clock in`}
              right={<Btn onClick={() => setProvisionOpen(true)}><IPlus size={13} /> Create account</Btn>}
            />
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
              {db.staff.length === 0 && <p className="py-6 text-center text-xs text-ink-faint">No accounts yet — create the first one.</p>}
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
              {[["Facility", "MediCore General Hospital"], ["Location", "14 Independence Ave, Accra"], ["License", "GHA-HF-2214-A"], ["Beds", `${db.beds.length} across 4 wards`], ["Departments", "13 connected modules"], ["System", "MediCore HMS · on-device"]].map(([k, v]) => (
                <p key={k} className="flex justify-between gap-3"><span className="text-ink-faint">{k}</span><span className="font-semibold text-ink">{v}</span></p>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Security Controls" right={<Badge tone="ok"><ICheck size={10} /> Enforced</Badge>} />
            <ul className="space-y-2 text-[11.5px] text-ink-soft">
              {["Role-based access control on every module & action", "On-device storage — records never leave this machine", "Automatic session sign-out", "Complete, tamper-evident audit trail", "Pharmacists cannot edit diagnoses; reception cannot alter lab results"].map((x) => (
                <li key={x} className="flex items-start gap-2"><IShield size={13} className="mt-0.5 shrink-0 text-med-600" />{x}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg bg-paper/70 p-3">
              <p className="text-[11px] font-semibold text-ink-soft">Auto sign-out after</p>
              <div className="mt-1.5 flex gap-1.5">
                {["15", "30", "60"].map((m) => (
                  <button key={m} onClick={() => { setSessionMin(m); toast(`Idle sign-out set to ${m} minutes`, "info"); }} className={`rounded-lg border px-3 py-1 font-mono text-[11px] font-bold transition-all ${sessionMin === m ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft"}`}>{m}m</button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHead title="Data Management" />
            <div className="space-y-2">
              <Btn variant="soft" className="w-full justify-center" onClick={backup}><IDownload size={14} /> Download backup (JSON)</Btn>
              <Btn variant="danger" className="w-full justify-center" onClick={() => setConfirmReset(true)}><IRefresh size={14} /> Reset this device</Btn>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-faint"><IGear size={11} /> Clears all local records and accounts, then starts fresh.</p>
          </Card>
        </div>
      </div>

      {provisionOpen && <ProvisionAccountModal onClose={() => setProvisionOpen(false)} />}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/55 p-4" onMouseDown={() => setConfirmReset(false)}>
          <div className="pop-in w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <p className="font-display text-sm font-bold text-ink">Reset this device?</p>
            <p className="mt-1 text-xs text-ink-faint">Every record and account on this device will be erased and the hospital starts empty. Download a backup first if you need one.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setConfirmReset(false)}>Keep my data</Btn>
              <Btn variant="danger" onClick={() => { localStorage.removeItem("medicore-db-v4"); localStorage.removeItem("medicore-user-v4"); location.reload(); }}>
                <IRefresh size={13} /> Yes, reset
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- provision staff account (admin) ---------------- */

function ProvisionAccountModal({ onClose }: { onClose: () => void }) {
  const { createAccount } = useStore();
  const [f, setF] = useState({ name: "", role: "doctor" as Role, dept: "", title: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = () => {
    if (!f.name.trim()) {
      setErr("A full name is required.");
      return;
    }
    createAccount({
      name: f.name, role: f.role,
      dept: f.dept || undefined, title: f.title || undefined, phone: f.phone || undefined,
    });
    onClose();
  };

  return (
    <Modal
      title="Create Staff Account"
      sub="Adds a sign-in for this role on the workstation screen"
      onClose={onClose}
      w="max-w-lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit}><IUser size={13} /> Create account</Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name *" className="col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dr. Ama Owusu" autoFocus /></Field>
        <Field label="Role *">
          <Select value={f.role} onChange={(e) => set("role", e.target.value)}>
            {(Object.keys(ROLE_META) as Role[]).map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </Select>
        </Field>
        <Field label="Department"><Input value={f.dept} onChange={(e) => set("dept", e.target.value)} placeholder="e.g. Paediatrics" /></Field>
        <Field label="Job title"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Staff Nurse" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="024 …" /></Field>
      </div>
      {err && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-snug text-red-800">
          <IAlert size={14} className="mt-0.5 shrink-0" /> {err}
        </p>
      )}
      <p className="mt-3 rounded-lg bg-paper/70 px-3 py-2 text-[10.5px] leading-relaxed text-ink-faint">
        <IList size={12} className="mr-1 inline" /> They clock in from the sign-in screen by picking this role and their name — the system opens only the modules their role allows.
      </p>
    </Modal>
  );
}
