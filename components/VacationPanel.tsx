"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TimeOff {
  id: number;
  date: string;       // ISO start date
  toDate?: string;    // ISO end date (null = single day)
  type: string;
  status: string;
  notes: string;
  createdAt: string;
  employee?: { id: number; name: string };
}

interface Props {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
  onBadgeClear?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TOTAL_DAYS = 18;

const C = {
  red:       "#D7252F",
  redDark:   "#C81E13",
  redDeep:   "#9F1239",
  redTint:   "#FFEBEC",
  redBorder: "#F5D5D2",
  text:      "#0F172A",
  textSoft:  "#475569",
  textMute:  "#94A3B8",
  divider:   "#F1F5F9",
  surface:   "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  approvedBg: "#E3F4E5", approvedBorder: "#B7E0BC", approvedText: "#1F6B36",
  pendingBg:  "#FEF3C7", pendingBorder:  "#FCD34D", pendingText:  "#92400E",
  rejectedBg: "#FEE2E2", rejectedBorder: "#FCA5A5", rejectedText: "#9F1239",
  shadow: "0 1px 3px rgba(215,37,47,0.06), 0 8px 24px rgba(215,37,47,0.10), 0 32px 64px rgba(0,0,0,0.06)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtIL(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Count Israeli workdays (Sun–Thu; skip Fri=5, Sat=6)
function calcWorkdays(from: string, to: string, type: string): number {
  const end = new Date(to + "T00:00:00");
  const cur = new Date(from + "T00:00:00");
  let count = 0;
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 5 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return type === "HALF_DAY" ? count * 0.5 : count;
}

function requestDays(r: TimeOff): number {
  return calcWorkdays(r.date, r.toDate || r.date, r.type);
}

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00"); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function requestPriority(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d <= 0) return "HIGH";
  if (d <= 6) return "MEDIUM";
  return "LOW";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BalanceCard({ used, pending }: { used: number; pending: number }) {
  const remaining = Math.max(0, TOTAL_DAYS - used - pending);
  const pctUsed = Math.min(100, Math.round((used / TOTAL_DAYS) * 100));
  const pctPending = Math.min(100 - pctUsed, Math.round((pending / TOTAL_DAYS) * 100));
  return (
    <div style={{
      margin: "14px 20px 0", padding: "14px 16px", borderRadius: 14,
      background: C.surfaceSoft, border: `1px solid ${C.divider}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.textMute, margin: 0,
                    textTransform: "uppercase", letterSpacing: "0.06em" }}>
          מכסת חופש 2026
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{remaining}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMute }}>נותרו</span>
          <span style={{ fontSize: 11, color: C.textMute, marginInlineStart: 4 }}>/ {TOTAL_DAYS}</span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#F1F5F9", position: "relative", overflow: "hidden" }}>
        <span style={{
          position: "absolute", top: 0, right: 0, height: "100%",
          width: `${pctUsed}%`, background: C.approvedText, borderRadius: 999,
        }} />
        {pending > 0 && (
          <span style={{
            position: "absolute", top: 0, right: `${pctUsed}%`, height: "100%",
            width: `${pctPending}%`, background: C.pendingText, opacity: 0.55, borderRadius: 999,
          }} />
        )}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <Legend dot={C.approvedText} label={`נוצל ${used}`} />
        {pending > 0 && <Legend dot={C.pendingText} label={`ממתין ${pending}`} />}
        <Legend dot="#CBD5E1" label={`נותר ${remaining}`} />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: C.textSoft, fontWeight: 500 }}>{label}</span>
    </span>
  );
}

function DateFieldRow({ label, value, onChange, min }: {
  label: string; value: string; onChange: (v: string) => void; min?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filled = !!value;
  return (
    <div style={{ flex: 1, position: "relative" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textMute, margin: "0 0 4px",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <div
        onClick={() => { try { inputRef.current?.showPicker?.(); } catch { inputRef.current?.focus(); } }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", borderRadius: 10,
          background: C.surface,
          border: `1.5px solid ${filled ? C.redBorder : C.divider}`,
          cursor: "pointer",
        }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
          stroke={filled ? C.red : C.textMute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: filled ? 700 : 400,
          color: filled ? C.text : C.textMute, fontVariantNumeric: "tabular-nums" }}>
          {filled ? fmtIL(value) : "dd/mm/yyyy"}
        </span>
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        />
      </div>
    </div>
  );
}

function TypeSelector({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  const types = [
    { id: "FULL_DAY", label: "יום מלא", icon: "sun" },
    { id: "HALF_DAY", label: "חצי יום", icon: "halfsun" },
    { id: "PART_TIME", label: "שעות", icon: "clock" },
  ];
  const SunIcon = () => (
    <><circle cx="12" cy="12" r="4" />
      <line x1="12" y1="3" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21" />
      <line x1="3" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="7" y2="7" /><line x1="17" y1="17" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="18.4" x2="7" y2="17" /><line x1="17" y1="7" x2="18.4" y2="5.6" /></>
  );
  const HalfSunIcon = () => (
    <><path d="M12 4v3" /><path d="M12 14v0a4 4 0 0 1-4-4h8a4 4 0 0 1-4 4z" /><path d="M4 14h16" /></>
  );
  const ClockIcon = () => (
    <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>
  );
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textMute, margin: "0 0 6px",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>סוג</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {types.map(t => {
          const on = t.id === active;
          return (
            <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 6px", borderRadius: 10,
              border: `1.5px solid ${on ? C.red : C.divider}`,
              background: on ? C.redTint : C.surface,
              color: on ? C.red : C.textSoft, cursor: "pointer",
              boxShadow: on ? "0 0 0 3px rgba(215,37,47,0.08)" : "none",
              fontFamily: "inherit",
            }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {t.icon === "sun" && <SunIcon />}
                {t.icon === "halfsun" && <HalfSunIcon />}
                {t.icon === "clock" && <ClockIcon />}
              </svg>
              <span style={{ fontSize: 12, fontWeight: on ? 700 : 600 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const QUICK_TAGS = ["חגים", "טיפול רפואי", "בר מצווה", "רפואי", "משפחה"];

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const filled = value.trim().length > 0;
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textMute, margin: "0 0 4px",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>סיבה (אופציונלי)</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder="לדוגמה: חופשה משפחתית מתוכנת"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10, resize: "none",
          background: C.surface, border: `1.5px solid ${filled ? C.redBorder : C.divider}`,
          fontSize: 12, color: C.text, fontFamily: "inherit", outline: "none",
          lineHeight: 1.55, boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: C.textMute, fontWeight: 600 }}>תגיות מהירות:</span>
        {QUICK_TAGS.map(t => (
          <button key={t} type="button" onClick={() => onChange(value ? `${value} ${t}` : t)} style={{
            padding: "3px 9px", borderRadius: 999,
            background: C.redTint, border: `1px solid ${C.redBorder}`,
            color: C.redDeep, fontSize: 10, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}>+ {t}</button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; border: string; text: string; label: string }> = {
    APPROVED: { bg: C.approvedBg, border: C.approvedBorder, text: C.approvedText, label: "אושר" },
    PENDING:  { bg: C.pendingBg,  border: C.pendingBorder,  text: C.pendingText,  label: "ממתין" },
    REJECTED: { bg: C.rejectedBg, border: C.rejectedBorder, text: C.rejectedText, label: "נדחה" },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      {status === "APPROVED" && (
        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 12 10 17 19 7" />
        </svg>
      )}
      {status === "PENDING" && (
        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
        </svg>
      )}
      {status === "REJECTED" && (
        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      )}
      {s.label}
    </span>
  );
}

function RequestRow({ req, onCancel }: { req: TimeOff; onCancel?: () => void }) {
  const days = requestDays(req);
  const isRange = req.toDate && req.toDate !== req.date;
  const d = daysUntil(req.date);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "12px 14px", marginBottom: 8,
      background: C.surface, border: `1px solid ${C.divider}`, borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: C.redTint, color: C.red, display: "grid", placeItems: "center",
          }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                {fmtIL(req.date)}{isRange ? ` — ${fmtIL(req.toDate!)}` : ""}
              </span>
              <span style={{ fontSize: 11, color: C.textMute }}>·</span>
              <span style={{ fontSize: 11, color: C.textMute }}>
                {req.type === "FULL_DAY" ? "יום מלא" : req.type === "HALF_DAY" ? "חצי יום" : "שעות"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: C.textSoft, fontWeight: 500 }}>
                {days} {days === 1 ? "יום" : "ימים"}
              </span>
              {req.status === "APPROVED" && d >= 0 && d <= 30 && (
                <span style={{ fontSize: 11, color: C.approvedText, fontWeight: 600 }}>
                  {d === 0 ? "היום!" : `עוד ${d} ימים`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusPill status={req.status} />
          {onCancel && req.status === "PENDING" && (
            <button onClick={onCancel} style={{
              width: 22, height: 22, borderRadius: 5, border: "none",
              background: "transparent", color: C.textMute, display: "grid", placeItems: "center",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12,
            }}>✕</button>
          )}
        </div>
      </div>
      {req.notes && (
        <p style={{ fontSize: 11, color: C.textSoft, margin: 0, lineHeight: 1.45, paddingInlineEnd: 40 }}>
          {req.notes}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: C.textMute, margin: "8px 4px 8px",
      textTransform: "uppercase", letterSpacing: "0.08em",
    }}>{children}</p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VacationPanel({ employeeId, employeeName, onClose, onBadgeClear }: Props) {
  const [list, setList] = useState<TimeOff[]>([]);
  const [activeTab, setActiveTab] = useState<"form" | "list">("form");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [type, setType] = useState("FULL_DAY");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  useEffect(() => {
    fetch(`/api/time-off?employeeId=${employeeId}`)
      .then(r => r.json())
      .then((data: TimeOff[]) => {
        setList(data);
        localStorage.setItem(`seen_timeoff_${employeeId}`, JSON.stringify(data.map(r => ({ id: r.id, status: r.status }))));
        onBadgeClear?.();
      });
  }, [employeeId, onBadgeClear]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const { usedDays, pendingDays } = useMemo(() => {
    const usedDays = list
      .filter(r => r.status === "APPROVED")
      .reduce((acc, r) => acc + requestDays(r), 0);
    const pendingDays = list
      .filter(r => r.status === "PENDING")
      .reduce((acc, r) => acc + requestDays(r), 0);
    return { usedDays, pendingDays };
  }, [list]);

  const pending = list.filter(r => r.status === "PENDING").sort((a, b) => a.date.localeCompare(b.date));
  const done    = list.filter(r => r.status !== "PENDING").sort((a, b) => b.date.localeCompare(a.date));

  const calcDays = useMemo(() => {
    if (!fromDate) return null;
    const effectiveTo = toDate && toDate >= fromDate ? toDate : fromDate;
    return calcWorkdays(fromDate, effectiveTo, type);
  }, [fromDate, toDate, type]);

  const isRange = !!fromDate && !!toDate && toDate > fromDate;

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate) return;
    setSaving(true);
    const effectiveTo = toDate && toDate >= fromDate ? toDate : null;
    const req = await fetch("/api/time-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, date: fromDate, toDate: effectiveTo, type, notes: reason }),
    }).then(r => r.json());

    // Auto-create manager task
    const dateLabel = effectiveTo ? `${fmtIL(fromDate)} — ${fmtIL(effectiveTo)}` : fmtIL(fromDate);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `בקשת חופש — ${employeeName} — ${dateLabel}`,
        description: `סוג: ${type === "FULL_DAY" ? "יום מלא" : type === "HALF_DAY" ? "חצי יום" : "שעות"}${reason ? ` · ${reason}` : ""}`,
        dueDate: fromDate,
        priority: requestPriority(fromDate),
        status: "TODO",
        assigneeIds: "",
        order: 0,
      }),
    });

    setList(prev => [req, ...prev]);
    setFromDate(""); setToDate(""); setType("FULL_DAY"); setReason("");
    setActiveTab("list");
    setSaving(false);
  }

  async function handleCancel(id: number) {
    await fetch(`/api/time-off/${id}`, { method: "DELETE" });
    setList(prev => prev.filter(r => r.id !== id));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <aside
        dir="rtl"
        style={{
          position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50,
          width: 520, maxWidth: "95vw",
          borderTopRightRadius: 24, borderBottomRightRadius: 24,
          background: C.surface,
          border: `1px solid ${C.redBorder}`,
          boxShadow: C.shadow,
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "'Rubik', system-ui, sans-serif",
        }}
      >
        {/* Brand strip */}
        <span aria-hidden="true" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 1,
          background: `linear-gradient(90deg, ${C.red} 0%, ${C.redDark} 50%, rgba(215,37,47,0.4) 100%)`,
          pointerEvents: "none",
        }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "start", justifyContent: "space-between",
          padding: "20px 24px 16px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: "transparent", color: C.textMute, display: "grid",
            placeItems: "center", cursor: "pointer", marginTop: 2,
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.01em" }}>
              בקשת חופש
            </h2>
            <p style={{ fontSize: 12, color: C.textSoft, margin: "3px 0 0" }}>
              <span style={{ color: C.red, fontWeight: 700 }}>{employeeName}</span>
              <span style={{ margin: "0 6px", color: "#CBD5E1" }}>·</span>
              שנת 2026
            </p>
          </div>
        </div>

        {/* Balance card */}
        <div style={{ flexShrink: 0 }}>
          <BalanceCard used={usedDays} pending={pendingDays} />
        </div>

        {/* Tab toggle */}
        <div style={{ padding: "14px 20px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{
            display: "inline-flex", gap: 2, padding: 3, borderRadius: 10,
            background: C.surfaceSoft, border: `1px solid ${C.divider}`,
          }}>
            {([
              { id: "form", label: "בקשה חדשה" },
              { id: "list", label: "הבקשות שלי" },
            ] as const).map(t => {
              const on = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "5px 14px", borderRadius: 8, border: "none",
                  background: on ? C.surface : "transparent",
                  color: on ? C.text : C.textSoft,
                  fontSize: 12, fontWeight: on ? 700 : 500,
                  boxShadow: on ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{t.label}</button>
              );
            })}
          </div>
          {activeTab === "list" && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: C.textSoft,
              padding: "3px 9px", borderRadius: 999,
              background: C.surfaceSoft, border: `1px solid ${C.divider}`,
            }}>{list.length} בקשות</span>
          )}
        </div>

        {/* Content area */}
        {activeTab === "form" ? (
          <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Date fields */}
                <div style={{ display: "flex", gap: 8 }}>
                  <DateFieldRow label="מתאריך" value={fromDate} onChange={v => { setFromDate(v); if (toDate && v > toDate) setToDate(""); }} min={today} />
                  <DateFieldRow label="עד תאריך" value={toDate} onChange={setToDate} min={fromDate || today} />
                </div>

                {/* Calculated days card — shown when from date selected */}
                {calcDays !== null && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 12,
                    background: C.redTint, border: `1px dashed ${C.redBorder}`,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.redDeep }}>
                      מספר ימי חופש בבקשה
                    </span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                        {calcDays}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.redDeep }}>ימים</span>
                      {isRange && (
                        <span style={{ fontSize: 10, color: C.textMute }}>· {fmtIL(fromDate)} — {fmtIL(toDate)}</span>
                      )}
                    </div>
                  </div>
                )}

                <TypeSelector active={type} onChange={setType} />
                <ReasonField value={reason} onChange={setReason} />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 20px", borderTop: `1px solid ${C.divider}`,
              background: C.surface, display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              <button type="button" onClick={onClose} style={{
                padding: "11px 18px", borderRadius: 10,
                background: C.surface, color: C.textSoft, border: `1px solid ${C.divider}`,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>ביטול</button>
              <button type="submit" disabled={saving || !fromDate} style={{
                flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                background: !fromDate ? "#E5E7EB" : C.red,
                color: !fromDate ? C.textMute : "#fff",
                fontSize: 14, fontWeight: 700, cursor: !fromDate ? "not-allowed" : "pointer",
                boxShadow: fromDate ? "0 4px 14px -4px rgba(215,37,47,0.50), 0 1px 0 rgba(255,255,255,0.18) inset" : "none",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: "inherit",
              }}>
                {saving ? (
                  "שולח..."
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    שלח בקשה
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 16px" }}>
            {list.length === 0 && (
              <p style={{ textAlign: "center", color: C.textMute, fontSize: 13, padding: "40px 0" }}>
                אין בקשות עדיין
              </p>
            )}
            {pending.length > 0 && (
              <>
                <SectionLabel>פעיל</SectionLabel>
                {pending.map(r => (
                  <RequestRow key={r.id} req={r} onCancel={() => handleCancel(r.id)} />
                ))}
              </>
            )}
            {done.length > 0 && (
              <>
                <SectionLabel>היסטוריה</SectionLabel>
                {done.map(r => (
                  <RequestRow key={r.id} req={r} />
                ))}
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
