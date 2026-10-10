"use client";

import React, { useEffect, useState, useCallback } from "react";
import { BreakReturnModal } from "./BreakReturnModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceBreak {
  id: number; breakStart: string; breakEnd: string | null; expectedEnd: string | null;
}
interface AttendanceRecord {
  id: number; checkInTime: string | null; checkOutTime: string | null;
  breaks: AttendanceBreak[];
}
type AttendanceStatus = "not-in" | "clocked-in" | "on-break" | "clocked-out";
interface EmployeeEntry {
  employee: { id: number; name: string; color: string };
  attendance: AttendanceRecord | null;
  status: AttendanceStatus;
  hasShiftToday: boolean;
  shiftDurationHours: number | null;
  shiftStartHour: number | null;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const PT = {
  red:         "#D7252F",
  redDark:     "#C81E13",
  redBorder:   "#F5D5D2",
  text:        "#0F172A",
  textSoft:    "#475569",
  textMute:    "#94A3B8",
  divider:     "#F1F5F9",
  surface:     "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  green:       "#16A34A", greenBg: "#E3F4E5", greenBorder: "#B7E0BC", greenText: "#1F6B36",
  amber:       "#D97706", amberBg: "#FEF3C7", amberBorder: "#FCD34D", amberText: "#92400E",
  slate:       "#94A3B8", slateBg: "#F1F5F9",
} as const;

// ─── Status mapping ───────────────────────────────────────────────────────────

type DS = "working" | "break" | "scheduled" | "off";

function toDS(e: EmployeeEntry): DS {
  if (e.status === "clocked-in") return "working";
  if (e.status === "on-break")   return "break";
  if (e.status === "not-in" && e.hasShiftToday) return "scheduled";
  return "off";
}

const DS_META: Record<DS, { bg: string; border: string; text: string; dot: string; label: string }> = {
  working:   { bg: PT.surface,     border: PT.greenBorder, text: PT.greenText, dot: PT.green, label: "פעיל" },
  break:     { bg: PT.surface,     border: PT.amberBorder, text: PT.amberText, dot: PT.amber, label: "הפסקה" },
  scheduled: { bg: PT.surfaceSoft, border: "#E2E8F0",      text: PT.textSoft,  dot: PT.slate, label: "מתוכנן" },
  off:       { bg: PT.surfaceSoft, border: "#E2E8F0",      text: PT.textMute,  dot: "#CBD5E1", label: "לא נוכח" },
};

const DS_ORDER: Record<DS, number> = { working: 0, break: 1, scheduled: 2, off: 3 };

// ─── Utility helpers ──────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtHHMM(value: string | number): string {
  if (typeof value === "number") {
    const h = Math.floor(value);
    const m = Math.round((value % 1) * 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function hebrewDayDate(): string {
  const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const d = new Date();
  return `יום ${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function useWallClock() {
  const fmt = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  const [t, setT] = useState(fmt);
  useEffect(() => { const id = setInterval(() => setT(fmt()), 60000); return () => clearInterval(id); }, []);
  return t;
}

function hoursWorked(att: AttendanceRecord): string | null {
  if (!att.checkInTime) return null;
  const breakMs = (att.breaks ?? [])
    .filter(b => b.breakEnd)
    .reduce((s, b) => s + new Date(b.breakEnd!).getTime() - new Date(b.breakStart).getTime(), 0);
  const ms = Math.max(0, Date.now() - new Date(att.checkInTime).getTime() - breakMs);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${String(m).padStart(2,"0")}`;
}

function shiftPct(e: EmployeeEntry): number {
  if (!e.attendance?.checkInTime || !e.shiftDurationHours) return 0;
  const breakMs = (e.attendance.breaks ?? [])
    .filter(b => b.breakEnd)
    .reduce((s, b) => s + new Date(b.breakEnd!).getTime() - new Date(b.breakStart).getTime(), 0);
  const worked = (Date.now() - new Date(e.attendance.checkInTime).getTime() - breakMs) / 3600000;
  return Math.min(100, Math.max(0, Math.round((worked / e.shiftDurationHours) * 100)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ size = 40, stroke = 2.5, percent = 0, color, children, dim }: {
  size?: number; stroke?: number; percent?: number; color: string;
  children: React.ReactNode; dim?: boolean;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {percent > 0 && (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: stroke + 1, borderRadius: "50%",
        display: "grid", placeItems: "center", opacity: dim ? 0.65 : 1 }}>
        {children}
      </div>
    </div>
  );
}

function Initial({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
      display: "grid", placeItems: "center",
      fontSize: Math.round(size * 0.4), fontWeight: 800, flexShrink: 0,
    }}>{name.charAt(0)}</span>
  );
}

function Chip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 11, color: PT.textSoft, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 11, color: PT.text, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </span>
  );
}

function CompactV2Card({ entry, isOwn, isManager, onAction, onOpenPanel, mutating }: {
  entry: EmployeeEntry;
  isOwn: boolean;
  isManager: boolean;
  onAction?: (a: "break-start" | "break-end") => void;
  onOpenPanel?: () => void;
  mutating: boolean;
}) {
  const ds = toDS(entry);
  const s = DS_META[ds];
  const isActive = ds === "working" || ds === "break";
  const ringColor = ds === "working" ? PT.green : ds === "break" ? PT.amber : "#CBD5E1";
  const pct = shiftPct(entry);
  const hours = entry.attendance ? hoursWorked(entry.attendance) : null;

  return (
    <div
      onClick={() => { if (isManager && onOpenPanel) onOpenPanel(); }}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 12,
        background: isActive ? PT.surface : PT.surfaceSoft,
        border: `1px solid ${isActive ? s.border : PT.divider}`,
        opacity: ds === "off" ? 0.6 : 1,
        minWidth: 0, overflow: "hidden",
        transition: "box-shadow 0.15s, border-color 0.15s",
        cursor: isManager ? "pointer" : "default",
      }}
    >
      {/* Shimmer stripe — working cards only */}
      {ds === "working" && (
        <span aria-hidden="true" style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2, pointerEvents: "none",
          background: `linear-gradient(90deg, transparent, ${PT.green}, transparent)`,
          animation: "pb-shimmer 2.4s ease-in-out infinite",
        }} />
      )}
      {/* Breathing glow — working cards only */}
      {ds === "working" && (
        <span aria-hidden="true" style={{
          position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none",
          background: `radial-gradient(circle at 20% 50%, rgba(22,163,74,0.08), transparent 60%)`,
          animation: "pb-breathe 2.8s ease-in-out infinite",
        }} />
      )}

      {/* Avatar + ring */}
      <div style={{ position: "relative" }}>
        <ProgressRing size={40} stroke={2.5} percent={pct} color={ringColor} dim={ds === "off"}>
          <Initial name={entry.employee.name} color={entry.employee.color} size={32} />
        </ProgressRing>
        <span style={{
          position: "absolute", bottom: -1, left: -1,
          width: 10, height: 10, borderRadius: "50%",
          background: s.dot, border: `2px solid ${PT.surface}`,
          animation: ds === "working" ? "pb-pulse 1.6s ease-in-out infinite" : "none",
        }} />
      </div>

      {/* Name + time */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: PT.text, margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.employee.name}
        </p>
        {hours ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: s.text,
              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{hours}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: PT.textMute }}>שעות</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: s.text }}>{s.label}</span>
        )}
      </div>

      {/* Action button — own card when active */}
      {isOwn && ds === "working" && onAction && (
        <button disabled={mutating} onClick={(e) => { e.stopPropagation(); onAction("break-start"); }}
          style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: PT.amberBg, border: `1px solid ${PT.amberBorder}`, color: PT.amberText,
            display: "grid", placeItems: "center",
            cursor: mutating ? "not-allowed" : "pointer", opacity: mutating ? 0.5 : 1 }}
          title="התחל הפסקה">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
      )}
      {isOwn && ds === "break" && onAction && (
        <button disabled={mutating} onClick={(e) => { e.stopPropagation(); onAction("break-end"); }}
          style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: PT.greenBg, border: `1px solid ${PT.greenBorder}`, color: PT.greenText,
            display: "grid", placeItems: "center",
            cursor: mutating ? "not-allowed" : "pointer", opacity: mutating ? 0.5 : 1 }}
          title="חזרה מהפסקה">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── "Next event" footer ──────────────────────────────────────────────────────

interface NextEvt { name: string; label: string; time: string; amber: boolean }

function buildNextEvents(entries: EmployeeEntry[]): NextEvt[] {
  const now = new Date();
  const evts: NextEvt[] = [];
  for (const e of entries) {
    if (e.status === "on-break" && e.attendance) {
      const br = e.attendance.breaks.find(b => !b.breakEnd);
      if (br?.expectedEnd) {
        evts.push({ name: e.employee.name, label: "חוזרת מהפסקה ב-", time: fmtHHMM(br.expectedEnd), amber: true });
      }
      // no expectedEnd → employee said "לא יודע" → skip from footer
    }
    if (e.status === "not-in" && e.hasShiftToday && e.shiftStartHour != null) {
      const t = fmtHHMM(e.shiftStartHour);
      const [h, m] = t.split(":").map(Number);
      const start = new Date(now); start.setHours(h, m, 0, 0);
      if (start > now) evts.push({ name: e.employee.name, label: "מתחיל/ה ב-", time: t, amber: false });
    }
  }
  return evts.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  currentEmployeeId?: number;
  onOpenPanel?: (employeeId: number | null) => void;
  isManager?: boolean;
  onStatusChange?: () => void;
}

export default function PresenceBar({ currentEmployeeId, onOpenPanel, isManager = false, onStatusChange }: Props) {
  const [entries, setEntries] = useState<EmployeeEntry[]>([]);
  const [mutating, setMutating] = useState(false);
  const [pendingBreakAttId, setPendingBreakAttId] = useState<number | null>(null);
  const wallClock = useWallClock();

  const fetchEntries = useCallback(() => {
    fetch(`/api/attendance/today?date=${todayStr()}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchEntries();
    const t = setInterval(fetchEntries, 30000);
    return () => clearInterval(t);
  }, [fetchEntries]);

  const sorted = [...entries].sort((a, b) => {
    const od = DS_ORDER[toDS(a)] - DS_ORDER[toDS(b)];
    if (od !== 0) return od;
    return (b.hasShiftToday ? 1 : 0) - (a.hasShiftToday ? 1 : 0);
  });

  const working = entries.filter(e => e.status === "clocked-in").length;
  const onBreak = entries.filter(e => e.status === "on-break").length;
  const myEntry = currentEmployeeId != null ? (entries.find(e => e.employee.id === currentEmployeeId) ?? null) : null;
  const nextEvents = buildNextEvents(entries);

  // break-start: opens the return-time modal; break-end: calls API immediately
  function handleAction(action: "break-start" | "break-end") {
    if (action === "break-start") {
      if (myEntry?.attendance) setPendingBreakAttId(myEntry.attendance.id);
      return;
    }
    // break-end
    if (!myEntry?.attendance || mutating) return;
    const br = myEntry.attendance.breaks.find(b => !b.breakEnd);
    if (!br) return;
    setMutating(true);
    fetch(`/api/attendance/${myEntry.attendance.id}/break/${br.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakEnd: new Date().toISOString() }),
    }).then(() => { fetchEntries(); onStatusChange?.(); })
      .finally(() => setMutating(false));
  }

  async function confirmBreakStart(expectedEnd: string | null) {
    if (!pendingBreakAttId || mutating) return;
    setPendingBreakAttId(null);
    setMutating(true);
    try {
      await fetch(`/api/attendance/${pendingBreakAttId}/break`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedEnd ? { expectedEnd } : {}),
      });
      fetchEntries();
      onStatusChange?.();
    } finally {
      setMutating(false);
    }
  }

  if (sorted.length === 0) return null;

  return (
    <div dir="rtl" style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${PT.divider}` }}>

      {/* Break return-time modal */}
      {pendingBreakAttId !== null && (
        <BreakReturnModal
          onConfirm={confirmBreakStart}
          onCancel={() => setPendingBreakAttId(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 }}>
        {/* RTL start — LIVE badge + title + date + clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10, fontWeight: 800, color: PT.red, letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: PT.green,
              animation: "pb-pulse 1.6s ease-in-out infinite" }} />
            LIVE
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: PT.text }}>נוכחות היום</span>
          <span style={{ fontSize: 11, color: PT.textMute, fontVariantNumeric: "tabular-nums" }}>
            · {hebrewDayDate()}
          </span>
          {/* Wall clock pill */}
          <span style={{
            marginInlineStart: 2, display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 999,
            background: PT.surfaceSoft, border: `1px solid ${PT.divider}`,
            fontSize: 11, fontWeight: 700, color: PT.text, fontVariantNumeric: "tabular-nums",
          }}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke={PT.textMute} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
            </svg>
            {wallClock}
          </span>
        </div>
        {/* RTL end — summary chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Chip color={PT.green} label="פעילים" value={working} />
          <Chip color={PT.amber} label="בהפסקה" value={onBreak} />
          <Chip color={PT.slate} label="לא נוכחים" value={entries.length - working - onBreak} />
        </div>
      </div>

      {/* Employee grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 8 }}>
        {sorted.map(entry => (
          <CompactV2Card
            key={entry.employee.id}
            entry={entry}
            isOwn={entry.employee.id === currentEmployeeId}
            isManager={isManager}
            onAction={handleAction}
            onOpenPanel={isManager && onOpenPanel ? () => onOpenPanel(entry.employee.id) : undefined}
            mutating={mutating}
          />
        ))}
      </div>

      {/* "הבא בתור" footer */}
      {nextEvents.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginTop: 12,
          padding: "8px 12px", borderRadius: 10,
          background: PT.surfaceSoft, border: `1px solid ${PT.divider}`,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            background: PT.amberBg, border: `1px solid ${PT.amberBorder}`,
            display: "grid", placeItems: "center",
          }}>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={PT.amberText} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
            </svg>
          </span>
          <p style={{ fontSize: 12, color: PT.textSoft, margin: 0 }}>
            <span style={{ color: PT.textMute, fontWeight: 600, marginInlineEnd: 6 }}>הבא בתור:</span>
            {nextEvents.map((evt, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: PT.textMute, margin: "0 10px" }}>·</span>}
                <strong style={{ color: PT.text, fontWeight: 700 }}>{evt.name}</strong>
                <span> {evt.label}</span>
                <strong style={{ color: evt.amber ? PT.amberText : PT.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{evt.time}</strong>
              </React.Fragment>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
