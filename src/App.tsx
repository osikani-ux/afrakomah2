import React, { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore } from "./store";
import type { Nav } from "./store";
import { ROLE_META, timeAgo } from "./data";
import type { Role, ViewId } from "./data";
import { Avatar, Badge, Btn, EcgStrip } from "./ui";
import {
  IPulse, IGrid, IUsers, ICalendar, IList, IStetho, IBed, IFlask, IPill, IBox, IZap,
  IReceipt, IShield, IChart, IBell, IGear, ISearch, ILogout, IChevR, ICard, ICheck, IAlert, IActivity, IRefresh, IMenu,
} from "./icons";
import Dashboard from "./views/Dashboard";
import Patients from "./views/Patients";
import Appointments from "./views/Appointments";
import QueueView from "./views/QueueView";
import { DoctorsView, StaffView } from "./views/People";
import WardsView from "./views/Wards";
import LabView from "./views/Lab";
import PharmacyView, { InventoryView } from "./views/Pharmacy";
import EmergencyView from "./views/Emergency";
import BillingView, { InsuranceView } from "./views/Billing";
import ReportsView from "./views/Reports";
import { NotificationsView, SettingsView } from "./views/Misc";

/* ---------------- RBAC ---------------- */

const ACCESS: Record<Role, ViewId[]> = {
  admin: ["dashboard", "patients", "appointments", "queue", "doctors", "wards", "lab", "pharmacy", "inventory", "emergency", "billing", "insurance", "staff", "reports", "notifications", "settings"],
  doctor: ["dashboard", "patients", "appointments", "queue", "doctors", "wards", "lab", "pharmacy", "emergency", "billing", "reports", "notifications"],
  nurse: ["dashboard", "patients", "queue", "wards", "emergency", "doctors", "notifications"],
  reception: ["dashboard", "patients", "appointments", "queue", "doctors", "billing", "notifications"],
  lab: ["dashboard", "patients", "queue", "lab", "reports", "notifications"],
  pharmacist: ["dashboard", "pharmacy", "inventory", "queue", "patients", "reports", "notifications"],
  billing: ["dashboard", "patients", "billing", "insurance", "queue", "reports", "notifications"],
};

const NAV: { group: string; items: { id: ViewId; label: string; icon: React.ReactNode }[] }[] = [
  { group: "Command", items: [{ id: "dashboard", label: "Dashboard", icon: <IGrid size={16} /> }, { id: "reports", label: "Reports", icon: <IChart size={16} /> }] },
  { group: "Front Desk", items: [{ id: "patients", label: "Patients", icon: <IUsers size={16} /> }, { id: "appointments", label: "Appointments", icon: <ICalendar size={16} /> }, { id: "queue", label: "Queue", icon: <IList size={16} /> }] },
  { group: "Clinical", items: [{ id: "doctors", label: "Doctors", icon: <IStetho size={16} /> }, { id: "wards", label: "Wards & Beds", icon: <IBed size={16} /> }, { id: "lab", label: "Laboratory", icon: <IFlask size={16} /> }, { id: "emergency", label: "Emergency", icon: <IZap size={16} /> }] },
  { group: "Supply & Finance", items: [{ id: "pharmacy", label: "Pharmacy", icon: <IPill size={16} /> }, { id: "inventory", label: "Inventory", icon: <IBox size={16} /> }, { id: "billing", label: "Billing", icon: <IReceipt size={16} /> }, { id: "insurance", label: "Insurance", icon: <IShield size={16} /> }] },
  { group: "Administration", items: [{ id: "staff", label: "Staff", icon: <ICard size={16} /> }, { id: "notifications", label: "Notifications", icon: <IBell size={16} /> }, { id: "settings", label: "Settings", icon: <IGear size={16} /> }] },
];

const VIEWS: Record<ViewId, () => React.ReactElement> = {
  dashboard: Dashboard, patients: Patients, appointments: Appointments, queue: QueueView,
  doctors: DoctorsView, wards: WardsView, lab: LabView, pharmacy: PharmacyView, inventory: InventoryView,
  emergency: EmergencyView, billing: BillingView, insurance: InsuranceView, staff: StaffView,
  reports: ReportsView, notifications: NotificationsView, settings: SettingsView,
};

const VIEW_LABEL: Record<ViewId, string> = {
  dashboard: "Hospital Command Center", patients: "Patients", appointments: "Appointments", queue: "Queue Management",
  doctors: "Doctors", wards: "Wards & Beds", lab: "Laboratory", pharmacy: "Pharmacy", inventory: "Inventory",
  emergency: "Emergency", billing: "Billing", insurance: "Insurance", staff: "Staff", reports: "Reports",
  notifications: "Notifications", settings: "Settings",
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="bg-clinical flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-alert"><IAlert size={22} /></span>
            <h1 className="mt-3 font-display text-lg font-extrabold text-ink">MediCore hit a fault</h1>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              The interface stopped unexpectedly. Your records are safe — they're stored on this device.
            </p>
            <p className="mt-3 rounded-lg bg-paper/80 p-2.5 font-mono text-[10px] leading-relaxed text-ink-faint">{String(this.state.error)}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="mt-4 w-full rounded-xl bg-pine-900 py-2.5 font-display text-sm font-bold text-mint transition-all hover:bg-pine-800"
            >
              Reload MediCore
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </ErrorBoundary>
  );
}

function Root() {
  const { user } = useStore();
  return (
    <>
      {user ? <Shell /> : <Login />}
      <ToastHost />
    </>
  );
}

/* ---------------- login ---------------- */

const ROLE_ICON: Record<Role, React.ReactNode> = {
  admin: <IGear size={17} />, doctor: <IStetho size={17} />, nurse: <IActivity size={17} />,
  reception: <IUsers size={17} />, lab: <IFlask size={17} />, pharmacist: <IPill size={17} />, billing: <IReceipt size={17} />,
};

function Login() {
  const { db, login } = useStore();
  const [role, setRole] = useState<Role>("admin");
  const accounts = db.staff.filter((s) => s.role === role && s.active);
  const [sel, setSel] = useState<string>("new");
  const [name, setName] = useState("");

  const pickRole = (r: Role) => {
    setRole(r);
    const acc = db.staff.filter((s) => s.role === r && s.active);
    setSel(acc.length ? acc[0].id : "new");
  };

  const canGo = sel !== "new" || name.trim().length >= 2;

  const submit = () => {
    if (!canGo) return;
    if (sel === "new") login(name, role);
    else {
      const s = accounts.find((a) => a.id === sel);
      login(s?.name ?? name, role, sel);
    }
  };

  return (
    <div className="bg-clinical flex min-h-screen">
      {/* brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-pine-950 p-10 text-white lg:flex">
        <div className="bg-pine-grid absolute inset-0" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint/15 text-mint"><IPulse size={26} /></span>
            <div>
              <p className="font-display text-xl font-extrabold tracking-tight">MediCore <span className="text-mint">HMS</span></p>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">Integrated Hospital Management</p>
            </div>
          </div>
          <h1 className="mt-14 max-w-md font-display text-4xl font-extrabold leading-[1.12] tracking-tight">
            One hospital.<br />One patient record.<br /><span className="text-mint">One connected system.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Registration to discharge — OPD, emergency, wards, laboratory, pharmacy and billing working from the same live record.
          </p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {["Front Desk", "EMR", "Triage", "Lab Workflow", "E-Prescription", "Auto-Billing", "Bed Map", "NHIS Claims", "Audit Trail"].map((m) => (
              <span key={m} className="rounded-md border border-white/12 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-mint/90">{m}</span>
            ))}
          </div>
        </div>
        <div className="relative">
          <EcgStrip className="h-14 w-full" />
          <div className="mt-4 flex items-center gap-6 text-[10.5px] text-white/50">
            <span><span className="font-mono font-bold text-mint">24</span> beds monitored</span>
            <span><span className="font-mono font-bold text-mint">13</span> departments linked</span>
            <span><span className="font-mono font-bold text-mint">100%</span> actions audited</span>
          </div>
        </div>
      </div>

      {/* sign-in panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-900 text-mint"><IPulse size={20} /></span>
            <p className="font-display text-lg font-extrabold">MediCore HMS</p>
          </div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-med-600">Staff workstation sign-in</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">Who's on duty?</h2>
          <p className="mt-1 text-xs text-ink-faint">Pick your role — MediCore opens exactly the modules you're authorised to use.</p>
          <div className="mt-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-med-200 bg-med-50 px-2.5 py-1.5 text-[10.5px] font-bold text-med-800">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-med-600" /> On-device data — works offline, nothing to install
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(ROLE_META) as Role[]).map((r) => (
              <button key={r} onClick={() => pickRole(r)}
                className={`rounded-xl border-2 p-2.5 text-left transition-all ${role === r ? "border-med-600 bg-med-50 shadow-sm" : "border-line bg-white hover:border-med-300"}`}>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${role === r ? "bg-med-600 text-white" : "bg-line-soft text-ink-soft"}`}>{ROLE_ICON[r]}</span>
                <p className="mt-1.5 text-[11px] font-bold leading-tight text-ink">{ROLE_META[r].label}</p>
                <p className="text-[9px] text-ink-faint">{ROLE_META[r].blurb}</p>
              </button>
            ))}
            <div className="rounded-xl border-2 border-dashed border-line p-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-line-soft text-ink-faint"><IShield size={17} /></span>
              <p className="mt-1.5 text-[10.5px] font-bold leading-tight text-ink-soft">Role-based access</p>
              <p className="text-[9px] text-ink-faint">Permissions enforced per module</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {accounts.length > 0 && (
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Existing {ROLE_META[role].label.toLowerCase()} accounts</span>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => setSel(a.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${sel === a.id ? "border-med-600 bg-med-600 text-white" : "border-line bg-white text-ink-soft hover:border-med-400"}`}>
                      {a.name}
                    </button>
                  ))}
                  <button onClick={() => setSel("new")}
                    className={`rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] font-semibold transition-all ${sel === "new" ? "border-med-600 bg-med-50 text-med-700" : "border-line text-ink-faint hover:border-med-300"}`}>
                    + New
                  </button>
                </div>
              </div>
            )}
            {sel === "new" && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Your full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Owusu" autoFocus
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-med-500 focus:ring-2 focus:ring-med-500/15" />
              </label>
            )}
            <button onClick={submit} disabled={!canGo}
              className="w-full rounded-xl bg-pine-900 py-3 font-display text-sm font-bold text-mint transition-all hover:bg-pine-800 active:scale-[0.99] disabled:opacity-45">
              Clock in as {sel === "new" ? (name.trim() || `new ${ROLE_META[role].label.toLowerCase()}`) : accounts.find((a) => a.id === sel)?.name} →
            </button>
            <p className="text-center text-[10.5px] leading-relaxed text-ink-faint">
              {sel === "new"
                ? `A ${ROLE_META[role].label.toLowerCase()} account is created on this device the first time you clock in.`
                : "Switch people anytime by signing out."}{" "}
              Every action is audit-logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */

function Shell() {
  const { user, nav, go, logout } = useStore();
  const [drawer, setDrawer] = useState(false);
  const allowed = ACCESS[user?.role ?? "reception"];
  const view: ViewId = allowed.includes(nav.view) ? nav.view : "dashboard";
  const View = VIEWS[view];

  const unread = useUnreadCount();
  const navTo = (v: ViewId, p?: Partial<Omit<Nav, "view">>) => {
    go(v, p);
    setDrawer(false);
  };

  return (
    <div className="bg-clinical flex min-h-screen">
      {/* mobile backdrop */}
      {drawer && <button aria-label="Close menu" onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-pine-950/55 backdrop-blur-[2px] lg:hidden" />}

      {/* sidebar — slide-over drawer on mobile, fixed rail on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] shrink-0 flex-col bg-pine-950 text-white shadow-2xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-[218px] lg:translate-x-0 lg:shadow-none ${drawer ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/15 text-mint"><IPulse size={22} /></span>
          <div>
            <p className="font-display text-[15px] font-extrabold leading-none tracking-tight">MediCore</p>
            <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-mint/80">HMS v3.2</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => {
            const items = g.items.filter((i) => allowed.includes(i.id));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <p className="px-2 pb-1.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.18em] text-white/35">{g.group}</p>
                <div className="space-y-0.5">
                  {items.map((i) => {
                    const active = view === i.id;
                    return (
                      <button key={i.id} onClick={() => navTo(i.id)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition-all ${active ? "bg-pine-800 text-mint" : "text-white/60 hover:bg-pine-900 hover:text-white"}`}>
                        {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-mint" />}
                        <span className={active ? "text-mint" : "text-white/40 group-hover:text-white/70"}>{i.icon}</span>
                        {i.label}
                        {i.id === "notifications" && unread > 0 && (
                          <span className="ml-auto rounded-md bg-mint px-1.5 py-0.5 font-mono text-[9px] font-bold text-pine-950">{unread}</span>
                        )}
                        {i.id === "emergency" && <span className="live-dot ml-auto h-1.5 w-1.5 rounded-full bg-red-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center justify-between rounded-lg bg-pine-900/70 px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white/60">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" /> On-device
            </span>
            <span className="font-mono text-[9px] text-white/45">saved locally</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-pine-900 p-2.5">
            <Avatar name={user?.name ?? "?"} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-bold text-white">{user?.name}</p>
              <p className="truncate font-mono text-[9px] text-mint/80">{ROLE_META[user?.role ?? "admin"].label}</p>
            </div>
            <button onClick={logout} title="Sign out" className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-pine-800 hover:text-mint"><ILogout size={15} /></button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <View key={view + (nav.patient ?? "")} />
        </main>
        <footer className="border-t border-line px-5 py-3 text-center font-mono text-[9.5px] text-ink-faint">
          MediCore HMS — Integrated Hospital Management · All actions are recorded in the audit trail · Accra, Ghana
        </footer>
      </div>
    </div>
  );
}

function useUnreadCount() {
  const { db, user } = useStore();
  return db.notifications.filter((n) => !n.read && (user?.role === "admin" || n.roles.includes(user?.role ?? "reception"))).length;
}

function TopBar({ view, onMenu }: { view: ViewId; onMenu: () => void }) {
  const { db, user, go, mutate } = useStore();
  const [q, setQ] = useState("");
  const [bell, setBell] = useState(false);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return db.patients.filter((p) => (p.name + p.mrn + p.phone).toLowerCase().includes(s)).slice(0, 5);
  }, [q, db.patients]);

  const mine = db.notifications.filter((n) => !n.read && (user?.role === "admin" || n.roles.includes(user?.role ?? "reception"))).slice(0, 6);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1480px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-5">
        <button onClick={onMenu} aria-label="Open menu"
          className="rounded-lg border border-line bg-white p-2 text-ink-soft transition-all hover:border-med-400 hover:text-med-700 active:scale-95 lg:hidden">
          <IMenu size={17} />
        </button>
        <div className="min-w-0">
          <p className="hidden font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-med-600 sm:block">MediCore General Hospital</p>
          <h2 className="truncate font-display text-[15px] font-extrabold text-ink">{VIEW_LABEL[view]}</h2>
        </div>

        {/* global patient search */}
        <div className="relative ml-auto w-full max-w-[190px] sm:max-w-[220px] md:max-w-xs">
          <ISearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find patient… name / MRN / phone"
            className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none transition-colors focus:border-med-500 focus:ring-2 focus:ring-med-500/15" />
          {results.length > 0 && (
            <div className="pop-in absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
              {results.map((p) => (
                <button key={p.mrn} onMouseDown={() => { go("patients", { patient: p.mrn }); setQ(""); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-med-50">
                  <Avatar name={p.name} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-ink">{p.name}</span>
                    <span className="font-mono text-[9.5px] text-ink-faint">{p.mrn} · {p.phone}</span>
                  </span>
                  <IChevR size={13} className="text-med-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        <LiveClock />

        {/* bell */}
        <div className="relative">
          <button onClick={() => setBell((b) => !b)} className="relative rounded-lg border border-line bg-white p-2 text-ink-soft transition-all hover:border-med-300 hover:text-med-700">
            <IBell size={16} />
            {mine.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 font-mono text-[8.5px] font-bold text-white">{mine.length}</span>}
          </button>
          {bell && (
            <div className="pop-in absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
                <p className="font-display text-xs font-bold">Unread notifications</p>
                <button onClick={() => { mutate((d) => { d.notifications.forEach((n) => { n.read = true; }); }, { audit: "Marked all notifications read" }); setBell(false); }} className="flex items-center gap-1 text-[10.5px] font-semibold text-med-600 hover:underline"><ICheck size={11} /> Mark all read</button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {mine.map((n) => (
                  <button key={n.id} onClick={() => mutate((d) => { d.notifications.find((x) => x.id === n.id)!.read = true; })}
                    className="flex w-full gap-2.5 border-b border-line-soft/60 px-4 py-2.5 text-left transition-colors hover:bg-med-50/50">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.icon === "alert" ? "bg-red-50 text-alert" : "bg-med-50 text-med-700"}`}>
                      {n.icon === "alert" ? <IAlert size={13} /> : n.icon === "lab" ? <IFlask size={13} /> : n.icon === "rx" ? <IPill size={13} /> : n.icon === "bed" ? <IBed size={13} /> : n.icon === "bill" ? <IReceipt size={13} /> : <IBell size={13} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] leading-snug text-ink">{n.text}</span>
                      <span className="font-mono text-[9px] text-ink-faint">{timeAgo(n.at)}</span>
                    </span>
                  </button>
                ))}
                {mine.length === 0 && <p className="px-4 py-6 text-center text-xs text-ink-faint">You're all caught up.</p>}
              </div>
              <button onClick={() => { go("notifications"); setBell(false); }} className="w-full border-t border-line-soft px-4 py-2 text-center text-[11px] font-bold text-med-600 transition-colors hover:bg-med-50">
                Open notification center →
              </button>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-lg border border-line bg-white py-1 pl-1 pr-3 sm:flex">
          <Avatar name={user?.name ?? "?"} size={26} />
          <div className="leading-tight">
            <p className="text-[11px] font-bold text-ink">{user?.name}</p>
            <Badge tone="med">{ROLE_META[user?.role ?? "admin"].label}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="hidden items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 md:flex">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" />
      <span className="font-mono text-[11px] font-semibold text-ink">{now.toLocaleTimeString("en-GB")}</span>
    </div>
  );
}

function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const toneCls = { ok: "border-med-600 bg-pine-900 text-mint", warn: "border-amber-500 bg-amber-50 text-amber-900", danger: "border-alert bg-red-50 text-red-800", info: "border-info bg-sky-50 text-sky-900" };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2 sm:bottom-5 sm:right-5">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismissToast(t.id)} className={`toast-in pointer-events-auto rounded-xl border-l-4 px-4 py-3 text-left text-xs font-semibold shadow-xl ${toneCls[t.tone]}`}>
          {t.text}
        </button>
      ))}
    </div>
  );
}
