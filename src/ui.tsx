import { useEffect } from "react";
import type { ReactNode } from "react";
import { IX } from "./icons";
import { initials } from "./data";

/* ---------------- buttons ---------------- */

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost" | "danger" | "outline" | "dark";
  size?: "xs" | "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export function Btn({ children, onClick, variant = "primary", size = "sm", disabled, type = "button", className = "" }: BtnProps) {
  const v = {
    primary: "bg-med-600 text-white hover:bg-med-700 shadow-sm shadow-med-600/20",
    soft: "bg-med-50 text-med-700 hover:bg-med-100 border border-med-200/70",
    ghost: "text-ink-soft hover:bg-line-soft hover:text-ink",
    danger: "bg-alert text-white hover:bg-[#a5351f]",
    outline: "border border-line bg-white text-ink hover:border-med-400 hover:text-med-700",
    dark: "bg-pine-900 text-mint hover:bg-pine-800",
  }[variant];
  const s = { xs: "px-2 py-1 text-[11px]", sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" }[size];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- badge ---------------- */

type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "med" | "dark";

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  const t: Record<Tone, string> = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    neutral: "bg-line-soft text-ink-soft border-line",
    med: "bg-med-50 text-med-700 border-med-200",
    dark: "bg-pine-900 text-mint border-pine-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide ${t[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  scheduled: "info", "checked-in": "med", "in-consultation": "warn", completed: "ok", cancelled: "danger",
  ordered: "info", collected: "med", processing: "warn", results: "warn", verified: "ok",
  pending: "warn", dispensed: "ok", partial: "warn", unpaid: "danger", paid: "ok",
  submitted: "info", approved: "ok", rejected: "danger",
  available: "ok", occupied: "danger", cleaning: "warn", reserved: "info",
  waiting: "warn", "in-treatment": "info", admitted: "med", discharged: "ok",
  active: "ok", "on-duty": "ok", "off-duty": "neutral", "on-leave": "warn",
  outpatient: "neutral", emergency: "danger",
  critical: "danger", urgent: "warn", moderate: "info", stable: "ok",
};

export function StatusPill({ s, label }: { s: string; label?: string }) {
  const tone = STATUS_TONE[s] ?? "neutral";
  return <Badge tone={tone}>{label ?? s.replace(/-/g, " ")}</Badge>;
}

/* ---------------- card / layout ---------------- */

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-line bg-surface ${onClick ? "cursor-pointer transition-all hover:border-med-300 hover:shadow-md hover:shadow-med-600/5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/* ---------------- form controls ---------------- */

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-amber-700">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-med-500 focus:ring-2 focus:ring-med-500/15";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[70px] ${props.className ?? ""}`} />;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="M15.5 15.5L21 21" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-faint/70 focus:border-med-500 focus:ring-2 focus:ring-med-500/15"
      />
    </div>
  );
}

/* ---------------- tabs ---------------- */

export function Tabs({ items, value, onChange }: { items: { k: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-white p-1">
      {items.map((it) => (
        <button
          key={it.k}
          onClick={() => onChange(it.k)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            value === it.k ? "bg-pine-900 text-mint shadow-sm" : "text-ink-soft hover:bg-line-soft"
          }`}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${value === it.k ? "bg-pine-700 text-mint" : "bg-line-soft text-ink-faint"}`}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------------- modal ---------------- */

export function Modal({
  title, sub, onClose, children, w = "max-w-xl", footer, printable,
}: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; w?: string; footer?: ReactNode; printable?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pine-950/55 p-4 backdrop-blur-[2px] sm:p-8" onMouseDown={onClose}>
      <div
        className={`pop-in my-auto w-full ${w} rounded-2xl border border-line bg-white shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4 ${printable ? "" : ""}`}>
          <div>
            <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
          </div>
          <button onClick={onClose} className="no-print rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-line-soft hover:text-ink">
            <IX size={16} />
          </button>
        </div>
        <div className={`px-5 py-4 ${printable ? "print-area" : ""}`}>{children}</div>
        {footer && <div className="no-print flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- avatar ---------------- */

const AV_COLORS = [
  ["#0e7a63", "#d8ede4"], ["#1d6fb8", "#dbeafe"], ["#b45309", "#fde68a"], ["#7c3aed22", "#ede9fe"],
  ["#be123c", "#ffe4e6"], ["#0f766e", "#ccfbf1"], ["#4d7c0f", "#ecfccb"], ["#155e75", "#cffafe"],
];

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  const [fg, bg] = AV_COLORS[h % AV_COLORS.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36, border: `1px solid ${fg}22` }}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------- empty state ---------------- */

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <span className="mb-2 text-ink-faint">{icon}</span>
      <p className="font-display text-sm font-semibold text-ink-soft">{title}</p>
      {sub && <p className="mt-1 max-w-xs text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

/* ---------------- charts (hand-rolled SVG) ---------------- */

export function AreaChart({ values, labels, color = "#0e7a63", h = 120, money }: { values: number[]; labels?: string[]; color?: string; h?: number; money?: boolean }) {
  const W = 560, H = h, pad = 6;
  const max = Math.max(...values) * 1.15 || 1;
  const min = 0;
  const pts = values.map((v, i) => [pad + (i * (W - pad * 2)) / (values.length - 1), H - pad - ((v - min) / (max - min)) * (H - pad * 2)]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z`;
  const gid = `g${color.replace("#", "")}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="#dbe4df" strokeDasharray="3 5" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={color} stroke="#fff" strokeWidth="2" />
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between px-1 font-mono text-[9.5px] text-ink-faint">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span className="font-semibold text-med-700">
            {labels[labels.length - 1]} · {money ? `GH₵${values[values.length - 1].toLocaleString()}` : values[values.length - 1]}
          </span>
        </div>
      )}
    </div>
  );
}

export function BarsChart({ data, aLabel, bLabel }: { data: { label: string; a: number; b: number }[]; aLabel: string; bLabel: string }) {
  const max = Math.max(...data.flatMap((d) => [d.a, d.b])) * 1.15 || 1;
  return (
    <div>
      <div className="flex h-[120px] items-end gap-2">
        {data.map((d) => (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-1">
            <div className="flex h-[100px] w-full items-end justify-center gap-[3px]">
              <div className="w-[38%] rounded-t-[3px] bg-med-600 transition-all duration-300 group-hover:bg-med-500" style={{ height: `${(d.a / max) * 100}%` }} title={`${aLabel}: ${d.a}`} />
              <div className="w-[38%] rounded-t-[3px] bg-mint/60 transition-all duration-300 group-hover:bg-mint" style={{ height: `${(d.b / max) * 100}%` }} title={`${bLabel}: ${d.b}`} />
            </div>
            <span className="font-mono text-[9px] text-ink-faint">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10.5px] font-medium text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-med-600" /> {aLabel}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-mint/70" /> {bLabel}</span>
      </div>
    </div>
  );
}

export function Donut({ value, total, label, sub, color = "#0e7a63" }: { value: number; total: number; label: string; sub?: string; color?: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const f = total ? value / total : 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#e7eeea" strokeWidth="11" />
        <circle
          cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 46 46)"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.2,0.7,0.3,1)" }}
        />
        <text x="46" y="43" textAnchor="middle" className="font-display" fontSize="17" fontWeight="800" fill="#152420">
          {Math.round(f * 100)}%
        </text>
        <text x="46" y="57" textAnchor="middle" fontSize="8.5" fill="#7e908a" fontFamily="IBM Plex Mono">
          {value}/{total}
        </text>
      </svg>
      <div>
        <p className="font-display text-sm font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{sub}</p>}
      </div>
    </div>
  );
}

export function HBars({ items }: { items: { label: string; value: number; color?: string; suffix?: string }[] }) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-ink-soft">{it.label}</span>
            <span className="font-mono font-semibold text-ink">{it.value}{it.suffix ?? ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? "#0e7a63" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = "#0e7a63", w = 76, h = 26 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...values) || 1, min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 5)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - 2 - ((values[values.length - 1] - min) / (max - min || 1)) * (h - 5)} r="2.6" fill={color} />
    </svg>
  );
}

/* ---------------- export helpers ---------------- */

export function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadJSON(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- ECG strip ---------------- */

export function EcgStrip({ className = "", color = "#2fd3a7" }: { className?: string; color?: string }) {
  const d = "M0 30 H40 L52 30 L58 12 L66 48 L74 6 L82 44 L90 30 H120 L132 30 L138 20 L146 40 L152 30 H220 L232 30 L238 12 L246 48 L254 6 L262 44 L270 30 H300 L312 30 L318 20 L326 40 L332 30 H400 L412 30 L418 12 L426 48 L434 6 L442 44 L450 30 H520 L532 30 L538 20 L546 40 L552 30 H620 L632 30 L638 12 L646 48 L654 6 L662 44 L670 30 H740 L752 30 L758 20 L766 40 L772 30 H920";
  return (
    <svg viewBox="0 0 920 60" preserveAspectRatio="none" className={className}>
      <path d={d} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="2" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" className="animate-ecg" />
    </svg>
  );
}
