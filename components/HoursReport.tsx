"use client";

import { useEffect, useMemo, useState } from "react";
import { weekKeyFromDate, getWeekStart } from "@/types";

// ── Interfaces (data layer unchanged) ─────────────────────────────────────────
interface AttBreak { id: number; breakStart: string; breakEnd: string | null; }
interface AttRecord {
  id: number; date: string; checkInTime: string | null; checkOutTime: string | null;
  breaks?: AttBreak[]; _manual?: boolean;
}
interface Props { employeeId: number; employeeName: string; onClose: () => void; }

// ── Utilities (unchanged) ─────────────────────────────────────────────────────
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function diffH(a: string | null, b: string | null, breaks?: AttBreak[]) {
  if (!a || !b) return 0;
  const total = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  const breakH = (breaks ?? []).filter(br => br.breakEnd)
    .reduce((acc, br) => acc + (new Date(br.breakEnd!).getTime() - new Date(br.breakStart).getTime()) / 3600000, 0);
  return Math.max(0, total - breakH);
}

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  red: "#D7252F", redDark: "#C81E13", redTint: "#FFEBEC", redBorder: "#F5D5D2",
  text: "#0F172A", soft: "#475569", mute: "#94A3B8",
  divider: "#F1F5F9", surface: "#FFFFFF", surfaceSoft: "#F8FAFC",
  greenBg: "#E3F4E5", greenBorder: "#B7E0BC", greenText: "#1F6B36",
  amberBg: "#FEF3C7", amberBorder: "#FCD34D", amberText: "#92400E",
  rejectBg: "#FEE2E2", rejectBorder: "#FCA5A5", rejectText: "#9F1239",
  shadow: "0 1px 3px rgba(215,37,47,0.06), 0 8px 24px rgba(215,37,47,0.10), 0 32px 64px rgba(0,0,0,0.06)",
};

const WEEKDAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const WEEKDAYS_SHORT = ["ר׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function dateAt(str: string) { return new Date(str + "T12:00:00"); }
function hebrewWeekday(dateStr: string) { return WEEKDAYS_HE[dateAt(dateStr).getDay()]; }
function dateLbl(dateStr: string) { const d = dateAt(dateStr); return `${d.getDate()} ${MONTHS_HE[d.getMonth()]}`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KPITile({ label, value, unit, hint, accent }: {
  label: string; value: string; unit?: string; hint?: string; accent?: string;
}) {
  return (
    <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: C.surface, border: `1px solid ${C.divider}` }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: C.mute, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 3 }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: accent ?? C.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit && <span style={{ fontSize: 10, fontWeight: 600, color: C.mute }}>{unit}</span>}
      </div>
      {hint && <p style={{ fontSize: 10, fontWeight: 600, color: C.soft, margin: "2px 0 0" }}>{hint}</p>}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ open }: { open: boolean }) {
  return open ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700,
      padding: "2px 6px", borderRadius: 999, background: C.amberBg, color: C.amberText, border: `1px solid ${C.amberBorder}`, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
      </svg>
      פתוח
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700,
      padding: "2px 6px", borderRadius: 999, background: C.greenBg, color: C.greenText, border: `1px solid ${C.greenBorder}`, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 12 10 17 19 7"/>
      </svg>
      אושר
    </span>
  );
}

// ── Day group header ──────────────────────────────────────────────────────────
function DayGroupHeader({ weekday, label, hours }: { weekday: string; label: string; hours: number }) {
  const target = 8;
  const over = hours > target;
  const low = hours > 0 && hours < target * 0.8;
  const barColor = over ? C.red : low ? C.amberText : C.greenText;
  const pct = hours > 0 ? Math.min(100, (hours / target) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 2px 5px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{weekday}</span>
        <span style={{ fontSize: 11, color: C.mute, fontVariantNumeric: "tabular-nums" }}>{label}</span>
      </div>
      {hours > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 50, height: 3, borderRadius: 999, background: C.divider, position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 0, right: 0, height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999 }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums" }}>{hours.toFixed(1)}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: barColor }}>שע׳</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────
function EntryRow({ record, menuOpen, onMenuToggle }: {
  record: AttRecord; menuOpen: boolean; onMenuToggle: () => void;
}) {
  const h = diffH(record.checkInTime, record.checkOutTime, record.breaks);
  const isOpen = !record.checkOutTime;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9,
      padding: "9px 11px", marginBottom: 5,
      background: menuOpen ? C.redTint : C.surface,
      border: `1px solid ${menuOpen ? C.redBorder : C.divider}`, borderRadius: 10 }}>
      {/* Source icon */}
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: record._manual ? C.redTint : "#EFF6FF",
        color: record._manual ? C.red : "#3B82F6" }}>
        {record._manual ? (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
        )}
      </span>
      {/* Times — arrow is SVG pointing LEFT (correct RTL direction start→end) */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmtTime(record.checkInTime)}</span>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={C.mute} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 5 5 12 12 19"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmtTime(record.checkOutTime)}</span>
      </div>
      {/* Duration */}
      {h > 0 && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{h.toFixed(1)}</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.mute }}>שע׳</span>
        </div>
      )}
      <StatusPill open={isOpen} />
      {/* Kebab */}
      <button onClick={e => { e.stopPropagation(); onMenuToggle(); }}
        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent",
          color: C.mute, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
      {/* Actions menu */}
      {menuOpen && (
        <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 4px)", left: 4, zIndex: 20,
          background: C.surface, borderRadius: 10, border: `1px solid ${C.divider}`,
          boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08)",
          padding: 4, minWidth: 148 }}>
          {[
            { icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>, label: "עריכה", danger: false },
            { icon: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>, label: "מחק", danger: true },
          ].map(({ icon, label, danger }, i) => (
            <button key={i} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 6,
              border: "none", background: "transparent", color: danger ? C.rejectText : C.text, fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "right" }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              <span style={{ flex: 1 }}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeekBars({ records, weekKey }: { records: AttRecord[]; weekKey: string }) {
  const today = todayStr();
  const weekStart = dateAt(weekKey);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const hours = records.filter(r => r.date === iso).reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0);
    return { d, iso, hours, dow: d.getDay(), isToday: iso === today };
  });
  const target = 8; const maxH = 68;
  return (
    <div style={{ marginBottom: 14, padding: "11px 10px 8px", background: C.surfaceSoft, border: `1px solid ${C.divider}`, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: C.mute, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>סקירה שבועית</p>
        <p style={{ fontSize: 9, color: C.mute, margin: 0 }}>יעד: {target} שע׳/יום</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, alignItems: "end" }}>
        {days.map((day, i) => {
          const weekend = day.dow === 5 || day.dow === 6;
          const barH = day.hours > 0 ? Math.max(3, (day.hours / target) * maxH) : 3;
          const barColor = day.hours === 0 ? "#E5E7EB" : day.hours >= target ? C.red : day.hours >= target * 0.75 ? C.greenText : C.amberText;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: day.hours ? C.text : C.mute, fontVariantNumeric: "tabular-nums", minHeight: 12 }}>
                {day.hours > 0 ? day.hours.toFixed(1) : ""}
              </span>
              <div style={{ width: "100%", height: maxH, display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: barH, background: barColor, borderRadius: 4, opacity: weekend ? 0.3 : 1, transition: "height 0.3s" }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: day.isToday ? 700 : 500,
                color: day.isToday ? C.red : weekend ? C.mute : C.soft,
                padding: day.isToday ? "1px 4px" : "0", borderRadius: 3, background: day.isToday ? C.redTint : "transparent" }}>
                {WEEKDAYS_SHORT[day.dow]} {day.d.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Monthly calendar heatmap ──────────────────────────────────────────────────
function MonthCalendar({ records, year, month }: { records: AttRecord[]; year: number; month: number }) {
  const today = todayStr();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const hoursMap: Record<string, number> = {};
  records.forEach(r => {
    const d = dateAt(r.date);
    if (d.getFullYear() === year && d.getMonth() === month)
      hoursMap[r.date] = (hoursMap[r.date] ?? 0) + diffH(r.checkInTime, r.checkOutTime, r.breaks);
  });
  const firstDow = dateAt(`${year}-${String(month+1).padStart(2,"0")}-01`).getDay();
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i+1)];
  while (cells.length % 7) cells.push(null);
  const rows: (number|null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i+7));

  function heat(h: number) {
    if (h === 0) return { bg: "#F8FAFC", text: C.mute, border: C.divider };
    if (h < 4)  return { bg: C.rejectBg, text: C.rejectText, border: C.rejectBorder };
    if (h < 7)  return { bg: C.amberBg, text: C.amberText, border: C.amberBorder };
    if (h < 8)  return { bg: C.greenBg, text: C.greenText, border: C.greenBorder };
    return { bg: C.redTint, text: C.red, border: C.redBorder };
  }

  return (
    <div style={{ marginBottom: 12, padding: "11px 10px 10px", background: C.surfaceSoft, border: `1px solid ${C.divider}`, borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: C.mute, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>מפת חום חודשית</p>
        <div style={{ display: "flex", gap: 4 }}>
          {[["#F8FAFC","0"],["#FEE2E2","<4"],[C.amberBg,"4-7"],[C.greenBg,"7+"],[C.redTint,"8+"]].map(([bg, l], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: bg as string, border: `1px solid ${C.divider}`, display: "inline-block" }} />
              <span style={{ fontSize: 8, color: C.mute }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {WEEKDAYS_SHORT.map((d, i) => <span key={i} style={{ textAlign: "center", fontSize: 8, fontWeight: 700, color: C.mute }}>{d}</span>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
          {row.map((day, ci) => {
            if (!day) return <div key={ci} />;
            const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const h = hoursMap[iso] ?? 0;
            const c = heat(h);
            const isToday = iso === today;
            return (
              <div key={ci} style={{ aspectRatio: "1/1", background: c.bg,
                border: `1px solid ${isToday ? C.red : c.border}`,
                boxShadow: isToday ? `0 0 0 1.5px ${C.red}` : "none",
                borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? C.red : c.text, lineHeight: 1 }}>{day}</span>
                {h > 0 && <span style={{ fontSize: 8, color: c.text, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{h.toFixed(1)}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Per-week summary list (monthly tab) ───────────────────────────────────────
function WeeklySummaryList({ records, year, month }: { records: AttRecord[]; year: number; month: number }) {
  const today = todayStr();
  // Collect unique weekKeys that touch this month
  const wkSet = new Set<string>();
  records.forEach(r => { const d = dateAt(r.date); if (d.getFullYear() === year && d.getMonth() === month) wkSet.add(weekKeyFromDate(getWeekStart(d))); });
  const weeks = Array.from(wkSet).sort().map(wk => {
    const wkStart = dateAt(wk);
    const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6);
    const hours = records.filter(r => r.date >= wk && r.date <= `${wkEnd.getFullYear()}-${String(wkEnd.getMonth()+1).padStart(2,"0")}-${String(wkEnd.getDate()).padStart(2,"0")}`)
      .reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0);
    const isCurrent = today >= wk && today <= `${wkEnd.getFullYear()}-${String(wkEnd.getMonth()+1).padStart(2,"0")}-${String(wkEnd.getDate()).padStart(2,"0")}`;
    const label = `${wkStart.getDate()}–${wkEnd.getDate()} ${MONTHS_HE[wkEnd.getMonth()]}`;
    return { wk, hours, isCurrent, label };
  });
  if (!weeks.length) return null;
  const target = 40;
  return (
    <>
      <p style={{ fontSize: 9, fontWeight: 700, color: C.mute, margin: "0 0 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>סיכום שבועי</p>
      {weeks.map(w => {
        const pct = Math.min(100, (w.hours / target) * 100);
        const barColor = w.hours >= target ? C.greenText : w.hours >= target * 0.8 ? C.amberText : w.hours > 0 ? C.rejectText : C.mute;
        return (
          <div key={w.wk} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", marginBottom: 5,
            background: w.isCurrent ? C.redTint : C.surface, border: `1px solid ${w.isCurrent ? C.redBorder : C.divider}`, borderRadius: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: "grid", placeItems: "center",
              background: w.isCurrent ? C.red : C.surfaceSoft, color: w.isCurrent ? "#fff" : C.soft }}>
              <span style={{ fontSize: 10, fontWeight: 800 }}>ש</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{w.label}</span>
                {w.isCurrent && <span style={{ fontSize: 8, fontWeight: 700, color: C.red, background: "#fff", border: `1px solid ${C.redBorder}`, padding: "1px 5px", borderRadius: 999 }}>נוכחי</span>}
              </div>
              <div style={{ height: 3, borderRadius: 999, background: C.divider, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{w.hours.toFixed(1)}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: C.mute }}>שע׳</span>
              </div>
              <span style={{ fontSize: 9, color: C.mute }}>/ {target}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Manual entry form ─────────────────────────────────────────────────────────
function ManualEntryForm({ employeeId, onSave, onCancel }: {
  employeeId: number; onSave: (rec: AttRecord) => void; onCancel: () => void;
}) {
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:30");
  const [breakMin, setBreakMin] = useState("30");
  const [saving, setSaving] = useState(false);

  const startMs = (() => { try { return new Date(`${date}T${start}:00`).getTime(); } catch { return 0; } })();
  const endMs = (() => { try { return new Date(`${date}T${end}:00`).getTime(); } catch { return 0; } })();
  const grossH = endMs > startMs ? (endMs - startMs) / 3600000 : 0;
  const brkH = Math.max(0, parseFloat(breakMin) || 0) / 60;
  const netH = Math.max(0, grossH - brkH);

  async function handleSave() {
    if (netH <= 0) return;
    setSaving(true);
    try {
      const wk = weekKeyFromDate(getWeekStart(dateAt(date)));
      const checkInTime = new Date(`${date}T${start}:00`).toISOString();
      const checkOutTime = new Date(`${date}T${end}:00`).toISOString();
      const rec = await fetch("/api/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, checkInTime, weekKey: wk }),
      }).then(r => r.json());
      const updated = await fetch(`/api/attendance/${rec.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOutTime }),
      }).then(r => r.json());
      let breaks: AttBreak[] = [];
      if (brkH > 0) {
        const bStart = new Date(startMs).toISOString();
        const bEnd = new Date(startMs + brkH * 3600000).toISOString();
        const br = await fetch(`/api/attendance/${rec.id}/break`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ breakStart: bStart }),
        }).then(r => r.json());
        const patchedBr = await fetch(`/api/attendance/${rec.id}/break/${br.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ breakEnd: bEnd }),
        }).then(r => r.json());
        breaks = [{ id: br.id, breakStart: bStart, breakEnd: patchedBr.breakEnd ?? bEnd }];
      }
      onSave({ ...updated, _manual: true, breaks });
    } finally { setSaving(false); }
  }

  const inp = (value: string, onChange: (v: string) => void, type = "text", extra?: object) => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} {...extra}
      style={{ border: "none", background: "transparent", fontSize: 12, fontWeight: 600, color: C.text, width: "100%", outline: "none" }} />
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: C.mute, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 7, background: C.surface, border: `1.5px solid ${C.redBorder}` }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 12, padding: "13px", background: C.redTint, border: `1px solid ${C.redBorder}`, borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 20, height: 20, borderRadius: 5, background: C.red, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.rejectText }}>הוספת שעה ידנית</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
        <Field label="תאריך">{inp(date, setDate, "date")}</Field>
        <Field label="כניסה">{inp(start, setStart, "time")}</Field>
        <Field label="יציאה">{inp(end, setEnd, "time")}</Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 6, marginBottom: 10 }}>
        <Field label="הפסקה (דק׳)">{inp(breakMin, setBreakMin, "number", { min: 0, max: 120 })}</Field>
        <Field label="הערה">{inp("", () => {}, "text", { placeholder: "אופציונלי..." })}</Field>
      </div>
      {netH > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 10px", borderRadius: 8, background: C.surface, border: `1px dashed ${C.redBorder}`, marginBottom: 9 }}>
          <span style={{ fontSize: 10, color: C.soft }}>סה״כ</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{netH.toFixed(1)}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.soft }}>שעות</span>
            {brkH > 0 && <span style={{ fontSize: 9, color: C.mute }}>({grossH.toFixed(1)} פחות {breakMin}ד׳ הפסקה)</span>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={handleSave} disabled={saving || netH <= 0}
          style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 700, cursor: netH <= 0 ? "not-allowed" : "pointer",
            background: (saving || netH <= 0) ? "#F8B4B4" : C.red, color: "#fff",
            boxShadow: netH > 0 ? "0 4px 14px -4px rgba(215,37,47,0.50)" : "none" }}>
          {saving ? "שומר..." : "שמור ושלח לאישור"}
        </button>
        <button onClick={onCancel}
          style={{ padding: "8px 12px", borderRadius: 9, background: C.surface, color: C.soft, border: `1px solid ${C.divider}`, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ביטול
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HoursReport({ employeeId, employeeName, onClose }: Props) {
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"week" | "month">("week");
  const [showForm, setShowForm] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const today = todayStr();
  const weekKey = weekKeyFromDate(getWeekStart(now));

  useEffect(() => {
    fetch(`/api/attendance?employeeId=${employeeId}&from=${monthStart}&to=${today}`)
      .then(r => r.json())
      .then(d => { setRecords(d); setLoading(false); });
  }, [employeeId, monthStart, today]);

  // Close kebab menu on outside click
  useEffect(() => {
    if (menuId === null) return;
    const h = (e: MouseEvent) => { if ((e.target as HTMLElement).closest("[data-menu-row]") === null) setMenuId(null); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [menuId]);

  const weekTotal = useMemo(() =>
    records.filter(r => r.date >= weekKey).reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0),
    [records, weekKey]
  );
  const monthTotal = useMemo(() =>
    records.reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0),
    [records]
  );
  const todayTotal = useMemo(() =>
    records.filter(r => r.date === today).reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0),
    [records, today]
  );
  const openCount = useMemo(() => records.filter(r => !r.checkOutTime).length, [records]);

  const visibleRecords = useMemo(() =>
    tab === "week"
      ? records.filter(r => r.date >= weekKey).sort((a, b) => b.date.localeCompare(a.date))
      : [...records].sort((a, b) => b.date.localeCompare(a.date)),
    [records, tab, weekKey]
  );

  const dayGroups = useMemo(() => {
    const map = new Map<string, AttRecord[]>();
    visibleRecords.forEach(r => { const arr = map.get(r.date) ?? []; arr.push(r); map.set(r.date, arr); });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibleRecords]);

  function exportExcel() {
    const bom = "﻿";
    const rows = ["תאריך,יום,כניסה,יציאה,שעות", ...records.map(r => {
      const h = diffH(r.checkInTime, r.checkOutTime, r.breaks);
      return `${r.date},${hebrewWeekday(r.date)},${fmtTime(r.checkInTime)},${fmtTime(r.checkOutTime)},${h > 0 ? h.toFixed(1) : ""}`;
    })];
    const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `שעות_${employeeName.replace(/\s+/g,"_")}_${today}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const TABS = [{ id: "week", label: "שבועי" }, { id: "month", label: "חודשי" }] as const;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{ width: 460, maxWidth: "100vw", borderTopRightRadius: 24, borderBottomRightRadius: 24,
          background: C.surface, border: `1px solid ${C.redBorder}`, boxShadow: C.shadow,
          fontFamily: "'Rubik', system-ui, sans-serif" }}>

        {/* Brand strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${C.red} 20%, ${C.redDark} 60%, transparent 100%)` }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "20px 22px 14px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "transparent", color: C.mute, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.01em" }}>דוח שעות</h2>
            <p style={{ fontSize: 11, color: C.soft, margin: "2px 0 0" }}>
              <span style={{ color: C.red, fontWeight: 700 }}>{employeeName}</span>
              <span style={{ margin: "0 5px", color: "#CBD5E1" }}>·</span>
              {MONTHS_HE[now.getMonth()]} {now.getFullYear()}
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: 6, padding: "12px 18px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
          <KPITile label="היום" value={todayTotal > 0 ? todayTotal.toFixed(1) : "—"} unit={todayTotal > 0 ? "שע׳" : undefined} />
          <KPITile label="שבועי" value={weekTotal.toFixed(1)} unit="שע׳" hint={weekTotal < 40 ? `חסרות ${(40-weekTotal).toFixed(1)}` : "✓ יעד"} accent={weekTotal >= 40 ? C.greenText : C.text} />
          <KPITile label="חודשי" value={monthTotal.toFixed(1)} unit="שע׳" />
          <KPITile label="פתוח" value={String(openCount)} hint={openCount > 0 ? "ממתין לסגירה" : "הכל סגור"} accent={openCount > 0 ? C.amberText : C.greenText} />
        </div>

        {/* Tabs + Add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, background: C.surfaceSoft, border: `1px solid ${C.divider}` }}>
            {TABS.map(t => {
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "5px 14px", borderRadius: 7, border: "none",
                    background: on ? C.surface : "transparent", color: on ? C.text : C.soft,
                    fontSize: 12, fontWeight: on ? 700 : 500,
                    boxShadow: on ? "0 1px 2px rgba(15,23,42,0.08)" : "none", cursor: "pointer" }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setShowForm(v => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: showForm ? C.surfaceSoft : C.red, color: showForm ? C.soft : "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: showForm ? "none" : "0 4px 14px -4px rgba(215,37,47,0.50)" }}>
            {showForm ? (
              <><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg> סגור טופס</>
            ) : (
              <><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> הוספת שעה</>
            )}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 80px" }}>
          {showForm && (
            <ManualEntryForm
              employeeId={employeeId}
              onSave={rec => { setRecords(prev => [...prev, rec]); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <p style={{ textAlign: "center", color: C.mute, fontSize: 13, padding: "32px 0" }} className="animate-pulse">טוען...</p>
          ) : (
            <>
              {/* Week tab: bar chart */}
              {tab === "week" && <WeekBars records={records} weekKey={weekKey} />}

              {/* Month tab: heatmap + weekly summary */}
              {tab === "month" && (
                <>
                  <MonthCalendar records={records} year={now.getFullYear()} month={now.getMonth()} />
                  <WeeklySummaryList records={records} year={now.getFullYear()} month={now.getMonth()} />
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.mute, margin: "14px 0 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>כל הרישומים</p>
                </>
              )}

              {/* Day-grouped entry list */}
              {dayGroups.length === 0 ? (
                <p style={{ textAlign: "center", color: C.mute, fontSize: 13, padding: "24px 0" }}>אין רישומים</p>
              ) : (
                dayGroups.map(([date, recs]) => {
                  const dayH = recs.reduce((s, r) => s + diffH(r.checkInTime, r.checkOutTime, r.breaks), 0);
                  return (
                    <div key={date}>
                      <DayGroupHeader weekday={hebrewWeekday(date)} label={dateLbl(date)} hours={dayH} />
                      {recs.map(r => (
                        <div key={r.id} data-menu-row="">
                          <EntryRow
                            record={r}
                            menuOpen={menuId === r.id}
                            onMenuToggle={() => setMenuId(prev => prev === r.id ? null : r.id)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer — Excel export */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "12px 18px", borderTop: `1px solid ${C.divider}`, background: C.surface, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={exportExcel}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10,
              background: `linear-gradient(180deg, ${C.red} 0%, ${C.redDark} 100%)`, color: "#fff",
              border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px -4px rgba(215,37,47,0.50), 0 1px 0 rgba(255,255,255,0.20) inset" }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ייצוא ל-Excel
          </button>
        </div>
      </aside>
    </>
  );
}
