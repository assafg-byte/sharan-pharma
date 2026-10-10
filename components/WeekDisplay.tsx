"use client";

import { useEffect, useMemo, useState } from "react";
import { Shift, Employee, DAYS_HE, weekKeyFromDate } from "@/types";
import { levelFor, levelLabel, paletteFor, paletteForLevel, TRAFFIC_LEVELS, type TrafficLightThresholds } from "@/lib/trafficLight";
import { useTrafficLightThresholds } from "@/lib/useTrafficLight";

interface Props {
  shifts: Shift[];
  employees?: Employee[];           // full roster — required by ScheduleDashboard wrapper; optional here so pages compile before commit 8
  selectedEmployeeId?: number;      // drives cell highlight/dim when set
  onExport?: () => void;
  exporting?: boolean;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onSwitchToEdit?: () => void;
  onCopyPrevWeek?: () => void;
  useGreenFill?: boolean;           // false = old plain white/thin-border look for 2+ cells
  weekStart?: Date;                 // drives the live "now" line — only shown when this is the actual current week
}

export const FIRST_HOUR = 8;
export const LAST_HOUR  = 16;
const ROW_PX     = 78;   // every row is exactly this tall — no exceptions (matches WeekSkeleton)
const GAP        = 6;    // gap between cells (matches WeekSkeleton)
const TIME_COL   = 56;   // px width of the time-label column (matches WeekSkeleton)

export const fmt = (h: number) => {
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

// ── Data model ──────────────────────────────────────────────────────────────

export interface DaySlice { employeeIds: number[]; finishing: number[] }
export interface Period { start: number; end: number; days: DaySlice[] }

/**
 * Build a flat list of time periods from shift start/end boundaries.
 * Each boundary where ANY shift starts or ends creates a new period row.
 * This keeps the grid compact (only as many rows as there are changes) while
 * maintaining full temporal alignment across all five day columns.
 */
export function buildPeriods(shifts: Shift[]): Period[] {
  // Union of all boundaries where staffing can change, PLUS every whole hour
  // in the window — guarantees the grid always reads as an hour-by-hour table
  // (8:00, 9:00, …) instead of collapsing into one giant block when every
  // employee's shift happens to share the same start/end (e.g. the full-time
  // default schedule, which is 8:00–16:00 for everyone).
  const bSet = new Set<number>([FIRST_HOUR, LAST_HOUR]);
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) bSet.add(h);
  shifts.forEach(s => {
    const start = s.startHour;
    const end   = s.startHour + s.durationHours;
    if (start >= FIRST_HOUR && start <= LAST_HOUR) bSet.add(start);
    if (end   >= FIRST_HOUR && end   <= LAST_HOUR) bSet.add(end);
  });

  const boundaries = [...bSet].sort((a, b) => a - b);

  return boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];

    const days: DaySlice[] = Array.from({ length: 5 }, (_, dayIdx) => {
      // Shifts that overlap this period [start, end)
      const active = shifts.filter(s =>
        s.dayOfWeek === dayIdx &&
        s.startHour < end &&
        s.startHour + s.durationHours > start
      );
      const employeeIds = [...new Set(active.map(s => s.employeeId))]
        .sort((a, b) => a - b);

      // Employees whose shift ends exactly at `end`
      // (omit at LAST_HOUR — everyone "stops" there, not noteworthy)
      const finishing = end < LAST_HOUR
        ? [...new Set(
            shifts
              .filter(s => s.dayOfWeek === dayIdx &&
                           Math.abs(s.startHour + s.durationHours - end) < 0.001)
              .map(s => s.employeeId)
          )]
        : [];

      return { employeeIds, finishing };
    });

    return { start, end, days };
  });
}

// ── Single-employee periods ──────────────────────────────────────────────────
// Segment boundaries come from the selected employee's own shifts only (not
// the whole team), so a block merges/splits exactly where THEIR coverage
// changes. Color still reflects total team headcount at that time, since a
// lone worker (yellow) vs. backed-up (green) is still meaningful to them.

export interface EmpDaySlice { working: boolean; finishing: boolean }
export interface EmpPeriod { start: number; end: number; days: EmpDaySlice[] }

export function buildEmployeePeriods(shifts: Shift[], employeeId: number): EmpPeriod[] {
  const empShifts = shifts.filter(s => s.employeeId === employeeId);

  // Same rationale as buildPeriods: force whole-hour rows so the single-
  // employee grid is also a real hour-by-hour table, not a collapsed block.
  const bSet = new Set<number>([FIRST_HOUR, LAST_HOUR]);
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) bSet.add(h);
  empShifts.forEach(s => {
    const start = s.startHour;
    const end   = s.startHour + s.durationHours;
    if (start >= FIRST_HOUR && start <= LAST_HOUR) bSet.add(start);
    if (end   >= FIRST_HOUR && end   <= LAST_HOUR) bSet.add(end);
  });

  const boundaries = [...bSet].sort((a, b) => a - b);

  return boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];

    const days: EmpDaySlice[] = Array.from({ length: 5 }, (_, dayIdx) => {
      const working = empShifts.some(s =>
        s.dayOfWeek === dayIdx && s.startHour < end && s.startHour + s.durationHours > start
      );
      const finishing = end < LAST_HOUR && empShifts.some(s =>
        s.dayOfWeek === dayIdx && Math.abs(s.startHour + s.durationHours - end) < 0.001
      );

      return { working, finishing };
    });

    return { start, end, days };
  });
}

// ── Full-day coverage detection ──────────────────────────────────────────────
// True when the employee's shifts on this day merge into one continuous
// block spanning the entire store window [FIRST_HOUR, LAST_HOUR) — i.e. a
// full-time day with no gaps. Drives the daily-summary-card view instead of
// the hour grid, since an all-green column of identical cells says nothing.

export function isFullDayCoverage(empShifts: Shift[], dayIdx: number): boolean {
  const dayShifts = empShifts
    .filter(s => s.dayOfWeek === dayIdx)
    .sort((a, b) => a.startHour - b.startHour);
  if (dayShifts.length === 0) return false;

  let cursor = FIRST_HOUR;
  for (const s of dayShifts) {
    if (s.startHour > cursor) return false; // gap before this shift
    cursor = Math.max(cursor, s.startHour + s.durationHours);
  }
  return cursor >= LAST_HOUR;
}

// ── Visual helpers ──────────────────────────────────────────────────────────

// Traffic light: red / orange / yellow / green by headcount — the headcount
// thresholds are manager-configurable (lib/trafficLight.ts; default 0/1/2/3+). 2+ cells always get a full fill,
// in both table styles. The old style used to render white with only a thin
// accent strip, which read as a "half-painted" cell.

// ── Cell ────────────────────────────────────────────────────────────────────

function Cell({
  slice, col, row, shifts, selectedEmployeeId, useGreenFill, thresholds,
}: {
  slice: DaySlice;
  col: number;
  row: number;
  shifts: Shift[];
  selectedEmployeeId?: number;
  useGreenFill: boolean;
  thresholds: TrafficLightThresholds;
}) {
  const count = slice.employeeIds.length;
  const level = levelFor(count, thresholds);
  const { bg, accent, nameColor } = paletteFor(count, thresholds);
  const hasFinishing = slice.finishing.length > 0;

  const isRed   = level === "none";
  const isAmber = level === "one";
  const sel     = selectedEmployeeId ?? null;
  const selPresent = sel !== null && slice.employeeIds.includes(sel);

  // ── Border: only yellow/green cells lose their accent when selected employee absent ─
  // Rule: amber/red borders are warnings — never overridden by filter state.
  const borderColor =
    (!isRed && !isAmber && sel !== null && !selPresent) ? "#E5E5E5" : accent;

  // ── Employee data (name + color from shifts relation) ────────────────────────
  const employeeData = slice.employeeIds.map(id => {
    const shift = shifts.find(s => s.employeeId === id);
    return { id, name: shift?.employee?.name ?? String(id), color: shift?.employee?.color ?? "#888" };
  });

  // ── Per-name color logic (all three traffic-light states encoded explicitly) ──
  // Rule: selection affects text emphasis only; warnings always win on status colors.
  function nameTextColor(empId: number): string {
    const isSelected = empId === sel;
    if (isRed)   return nameColor; // red: warning always wins, nothing to dim
    if (sel === null) return (isAmber || useGreenFill) ? nameColor : "#1A1A1A"; // no filter
    if (selPresent && isSelected) return employeeData.find(e => e.id === empId)?.color ?? "#1A1A1A";
    if (selPresent && !isSelected) return isAmber ? "#666666" : "#767676"; // WCAG AA dimmed
    if (isAmber)  return nameColor; // not their cell, amber — warning wins, keep color
    return "#767676";               // not their cell, yellow/green — dim to WCAG AA gray
  }

  const finishing = slice.finishing.map(id =>
    shifts.find(s => s.employeeId === id)?.employee?.name ?? String(id)
  );

  return (
    <div
      dir="rtl"
      style={{
        gridColumn: col,
        gridRow: row,
        position: "relative",
        background: bg,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 8px",
        transition: "background-color 200ms ease, border-color 200ms ease",
      }}
    >
      {/* ── Accent strip — short floating bar on the (RTL) right edge ── */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 4, bottom: 4, insetInlineStart: 3,
        width: 2.5, borderRadius: 2, background: borderColor, opacity: 0.65,
      }} />

      {/* ── Zero employees — just the warning icon, no extra copy ── */}
      {count === 0 && (
        <span style={{ fontSize: 14, lineHeight: 1 }} title="ללא איוש">⚠️</span>
      )}

      {/* ── One or more employees — names stacked vertically, centered ── */}
      {count > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          {employeeData.map(emp => (
            <span key={emp.id} style={{
              fontSize: 13, lineHeight: 1.2,
              color: nameTextColor(emp.id),
              fontWeight: (sel !== null && emp.id === sel) ? 700 : (isAmber ? 600 : 700),
              transition: "color 200ms ease",
            }}>
              {emp.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Finishing note — plain centered "- name" line ── */}
      {hasFinishing && (
        <div style={{
          position: "absolute", bottom: 2, left: 0, right: 0,
          textAlign: "center", fontSize: 9, fontWeight: 600,
          color: (isAmber || isRed) ? nameColor : "#1A1A1A", opacity: 0.6,
          letterSpacing: "-0.02em", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          - {finishing.join(", ")}
        </div>
      )}
    </div>
  );
}

// ── Single-employee cell ─────────────────────────────────────────────────────
// Working slots use the normal traffic-light treatment; non-working slots are
// neutral gray — no red, no ⚠️, no accent strip. Red gaps are only meaningful
// in the all-employees view.

function EmployeeCell({
  slice, col, row, employee,
}: {
  slice: EmpDaySlice;
  col: number;
  row: number;
  employee: Employee;
}) {
  if (!slice.working) {
    return (
      <div style={{
        gridColumn: col, gridRow: row,
        background: "#F8FAFC", border: "1px solid #F1F5F9",
        borderRadius: 10, opacity: 0.5,
      }} />
    );
  }

  const bg = "#E3F4E5";
  const accent = "#16A34A";
  const nameColor = "#1F6B36";

  return (
    <div
      dir="rtl"
      style={{
        gridColumn: col, gridRow: row,
        position: "relative",
        background: bg,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "6px 8px",
      }}
    >
      <span aria-hidden="true" style={{
        position: "absolute", top: 4, bottom: 4, insetInlineStart: 3,
        width: 2.5, borderRadius: 2, background: accent, opacity: 0.65,
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: nameColor }}>
        {employee.name}
      </span>
      {slice.finishing && (
        <div style={{
          position: "absolute", bottom: 2, left: 0, right: 0,
          textAlign: "center", fontSize: 9, fontWeight: 600,
          color: nameColor, opacity: 0.6, letterSpacing: "-0.02em",
        }}>
          - מסיים/ת
        </div>
      )}
    </div>
  );
}

// ── Full-time day card ───────────────────────────────────────────────────────
// Replaces the hour grid for a day where the selected employee covers the
// entire window with no gaps — a column of identical green cells carries no
// information, so show a compact summary instead.

function FullTimeDayCard({
  col, row, startTime, endTime, hours, coworkers,
}: {
  col: number;
  row: string;
  startTime: string;
  endTime: string;
  hours: number;
  coworkers: string[];
}) {
  return (
    <div
      dir="rtl"
      style={{
        gridColumn: col, gridRow: row,
        background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
        border: "1px solid #BBF7D0",
        borderInlineStart: "4px solid #4ADE80",
        borderRadius: 12,
        padding: 16,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 8, textAlign: "center",
      }}
    >
      <div style={{ color: "#16A34A", fontWeight: 700, fontSize: 16 }}>
        ✓ עובדת כל היום
      </div>
      <div style={{
        color: "#6B7280", fontSize: 13,
        direction: "ltr", unicodeBidi: "isolate",
      }}>
        {startTime} – {endTime}
      </div>
      <div style={{
        background: "#DCFCE7", color: "#16A34A", borderRadius: 20,
        padding: "4px 12px", fontSize: 13, fontWeight: 600,
      }}>
        {hours % 1 === 0 ? hours : hours.toFixed(1)} שעות
      </div>
      <div style={{ width: "60%", height: 1, background: "#D1FAE5" }} />
      {coworkers.length > 0 && (
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          <span>עם: </span>
          <span style={{ color: "#6B7280" }}>{coworkers.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function AgentIllustration() {
  return (
    <svg viewBox="0 0 200 180" width="180" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="80" r="70" fill="#E6EAF8"/>
      <ellipse cx="100" cy="62" rx="22" ry="24" fill="#F5F7FF" stroke="#6B7AAD" strokeWidth="2.5"/>
      <path d="M82 56 C 82 36, 118 32, 122 50 C 124 56, 124 60, 122 62 L 118 56 C 110 50, 96 52, 86 58 Z" fill="#6B7AAD"/>
      <path d="M76 60 C 76 38, 124 38, 124 60" stroke="#6B7AAD" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <rect x="71" y="58" width="10" height="14" rx="3" fill="#6B7AAD"/>
      <rect x="119" y="58" width="10" height="14" rx="3" fill="#6B7AAD"/>
      <path d="M81 68 Q 84 78, 96 79" stroke="#6B7AAD" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      <circle cx="96" cy="79" r="2.2" fill="#6B7AAD"/>
      <path d="M88 86 L 88 96 L 112 96 L 112 86" stroke="#6B7AAD" strokeWidth="2.5" strokeLinejoin="round" fill="#F5F7FF"/>
      <path d="M48 158 L 152 158 L 162 168 L 38 168 Z" fill="#F5F7FF" stroke="#6B7AAD" strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="58" y="98" width="84" height="60" rx="4" fill="#F5F7FF" stroke="#6B7AAD" strokeWidth="2.5"/>
      <circle cx="100" cy="163" r="1.6" fill="#6B7AAD"/>
    </svg>
  );
}

function UpcomingEmptyState({ onEdit, onBack, onCopy }: { onEdit?: () => void; onBack?: () => void; onCopy?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl" dir="rtl"
      style={{ background: "linear-gradient(180deg, #F4F6FF 0%, #ECEFFA 100%)", border: "1px solid #E0E4F4", padding: "48px 32px" }}>
      <div className="relative max-w-[520px] mx-auto flex flex-col items-center text-center">
        <AgentIllustration />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full mt-5 mb-3"
          style={{ color: "#4338CA", background: "#E0E7FF" }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#6366F1" }}/>
          עתידי
        </span>
        <h3 className="text-[22px] font-bold text-gray-900 mb-5">סידור עבודה לשבוע זה</h3>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18"/>
              </svg>
              חזור
            </button>
          )}
          {onCopy && (
            <button onClick={onCopy} className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 2v4M17 2v4M3 10h18"/><path d="M9 14l2 2 4-4"/>
              </svg>
              העתק מהשבוע הקודם
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-colors"
              style={{ background: "#0F172A" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1E293B")}
              onMouseLeave={e => (e.currentTarget.style.background = "#0F172A")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              התחל לסדר
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────

function Legend({ onExport, exporting, thresholds }: { onExport?: () => void; exporting?: boolean; thresholds: TrafficLightThresholds }) {
  const item = (accent: string, bg: string, label: string) => (
    <div className="flex items-center gap-2" dir="rtl">
      <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3,
                     background: bg, borderInlineStart: `3px solid ${accent}` }}/>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4" dir="rtl">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">מקרא:</span>
      {TRAFFIC_LEVELS.map(level => {
        const { accent, bg } = paletteForLevel(level);
        return <span key={level}>{item(accent, bg, levelLabel(level, thresholds))}</span>;
      })}
      {onExport && (
        <button onClick={onExport} disabled={exporting}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          style={{ marginInlineStart: "auto" }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {exporting ? "מייצא..." : "ייצוא כתמונה"}
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function WeekDisplay({
  shifts, employees: _employees, selectedEmployeeId,
  onExport, exporting, onPrevWeek, onNextWeek, onSwitchToEdit, onCopyPrevWeek,
  useGreenFill = true, weekStart,
}: Props) {
  // One Period per unique time boundary — the compact, fixed-height grid
  const periods = useMemo(() => buildPeriods(shifts), [shifts]);
  const thresholds = useTrafficLightThresholds();

  // Live "now" line (Apple/Google Calendar style) — ticks every 30s so it
  // visibly moves without a reload. Only meaningful when the week on screen
  // is the actual current week.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date()); // avoid SSR/client mismatch — set only after mount
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const isCurrentWeek = !!weekStart && !!now && weekKeyFromDate(weekStart) === weekKeyFromDate(now);
  const todayIdx = now ? now.getDay() : -1; // 0=Sun … 4=Thu match dayOfWeek directly
  const showNowLine = isCurrentWeek && todayIdx >= 0 && todayIdx <= 4;
  const nowHour = now ? now.getHours() + now.getMinutes() / 60 : 0;

  const selectedEmployee = selectedEmployeeId != null
    ? _employees?.find(e => e.id === selectedEmployeeId) ?? null
    : null;

  const empPeriods = useMemo(
    () => selectedEmployee ? buildEmployeePeriods(shifts, selectedEmployee.id) : null,
    [shifts, selectedEmployee]
  );

  // Per-day hours for the selected employee — drives the expanded day headers
  const perDayHours = useMemo(() => {
    if (!selectedEmployee) return null;
    const hours = [0, 0, 0, 0, 0];
    shifts
      .filter(s => s.employeeId === selectedEmployee.id)
      .forEach(s => { hours[s.dayOfWeek] += s.durationHours; });
    return hours;
  }, [shifts, selectedEmployee]);

  // Per-day full-coverage flag + coworkers — drives the daily-summary-card
  // view (see isFullDayCoverage) instead of the hour grid for that day.
  const fullDayInfo = useMemo(() => {
    if (!selectedEmployee) return null;
    const empShifts = shifts.filter(s => s.employeeId === selectedEmployee.id);
    return Array.from({ length: 5 }, (_, dayIdx) => ({
      isFull: isFullDayCoverage(empShifts, dayIdx),
      coworkers: [...new Set(
        shifts
          .filter(s => s.dayOfWeek === dayIdx && s.employeeId !== selectedEmployee.id)
          .map(s => s.employee?.name)
          .filter((n): n is string => !!n)
      )],
    }));
  }, [shifts, selectedEmployee]);

  if (shifts.length === 0) {
    return (
      <>
        <UpcomingEmptyState onEdit={onSwitchToEdit} onBack={onPrevWeek} onCopy={onCopyPrevWeek}/>
        <Legend onExport={onExport} exporting={exporting} thresholds={thresholds}/>
      </>
    );
  }

  const activePeriods: { start: number; end: number }[] = empPeriods ?? periods;
  const N = activePeriods.length;
  const headerHeight = selectedEmployee ? 48 : 36;

  // Live "now" line position — find which row currently contains the time,
  // then interpolate its fractional position within that row's real height.
  // Skipped entirely when a single employee is selected/filtered (per
  // request) — not just for a FullTimeDayCard day.
  const todayIsFullTimeCard = !!(selectedEmployee && fullDayInfo?.[todayIdx]?.isFull);
  const nowRowIndex = showNowLine && !selectedEmployee && !todayIsFullTimeCard
    ? activePeriods.findIndex(p => nowHour >= p.start && nowHour < p.end)
    : -1;
  const nowLineVisible = nowRowIndex >= 0;
  const totalGridHeight = N * ROW_PX + Math.max(0, N - 1) * GAP;
  const nowTopPercent = (() => {
    if (!nowLineVisible || totalGridHeight <= 0) return 0;
    const p = activePeriods[nowRowIndex];
    const frac = p.end > p.start ? (nowHour - p.start) / (p.end - p.start) : 0;
    const topPx = nowRowIndex * (ROW_PX + GAP) + frac * ROW_PX;
    return (topPx / totalGridHeight) * 100;
  })();
  const todayCol = todayIdx + 2; // matches the +2 offset used by Cell/EmployeeCell below

  return (
    <>
      <div className="overflow-x-auto relative group/board" dir="rtl">
        {/* Hover nav arrows */}
        <div className="absolute top-0 bottom-0 right-0 z-20 pointer-events-none flex items-center" style={{ width: 56 }}>
          <button onClick={onPrevWeek} aria-label="שבוע קודם"
            className="pointer-events-auto opacity-0 group-hover/board:opacity-100 hover:scale-110 w-11 h-11 grid place-items-center rounded-full bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 transition-all"
            style={{ boxShadow: "0 8px 24px -6px rgba(15,23,42,0.18)", marginInlineEnd: 8 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </button>
        </div>
        <div className="absolute top-0 bottom-0 left-0 z-20 pointer-events-none flex items-center justify-end" style={{ width: 56 }}>
          <button onClick={onNextWeek} aria-label="שבוע הבא"
            className="pointer-events-auto opacity-0 group-hover/board:opacity-100 hover:scale-110 w-11 h-11 grid place-items-center rounded-full bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 transition-all"
            style={{ boxShadow: "0 8px 24px -6px rgba(15,23,42,0.18)", marginInlineStart: 8 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 6 9 12 15 18"/>
            </svg>
          </button>
        </div>

        <div id="weekly-grid" className="min-w-[600px]">
          {/* Day headers */}
          <div className="grid" style={{
            gridTemplateColumns: `${TIME_COL}px repeat(5, 1fr)`,
            gap: GAP,
            marginBottom: GAP,
          }}>
            <div style={{ background: "#fff", height: headerHeight }}/>
            {DAYS_HE.map((day, dayIdx) => {
              const dayHours = perDayHours ? perDayHours[dayIdx] : null;
              const hasHours = dayHours != null && dayHours > 0;
              return (
                <div key={day} style={{
                  background: selectedEmployee ? (hasHours ? "#E3F4E5" : "#fff") : "#fff",
                  border: selectedEmployee && hasHours ? "1px solid #B7E0BC" : "none",
                  height: headerHeight,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2,
                }}>
                  <span className="text-[13px] font-semibold text-gray-700">{day}</span>
                  {selectedEmployee && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: hasHours ? "#1F6B36" : "#9CA3AF",
                      fontVariantNumeric: "tabular-nums",
                      direction: "ltr", unicodeBidi: "isolate",
                    }}>
                      {hasHours ? (dayHours! % 1 === 0 ? dayHours : dayHours!.toFixed(1)) + " ש׳" : "–"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main grid — N rows × 78px, 6px gap, no row-spanning */}
          <div className="grid" style={{
            gridTemplateColumns: `${TIME_COL}px repeat(5, 1fr)`,
            gridTemplateRows: `repeat(${N}, minmax(${ROW_PX}px, auto))`,
            gap: GAP,
          }}>
            {/* Time labels — one per period, centered in the fixed 56px row.
                Duration badge lives here (not inside cells) so it never
                overlaps or obscures the employee names. */}
            {activePeriods.map((p, i) => {
              const dH = p.end - p.start;
              const showDuration = dH > 2;
              return (
                <div key={`t${i}`} style={{
                  gridColumn: 1, gridRow: i + 1,
                  background: "#fff",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 2,
                }}>
                  {/* direction: ltr + unicode-bidi: isolate prevents the RTL
                      container from reversing tabular-nums digit order */}
                  <span style={{
                    fontSize: 11, color: "#9CA3AF",
                    fontVariantNumeric: "tabular-nums", fontWeight: 500,
                    direction: "ltr", unicodeBidi: "isolate",
                  }}>
                    {fmt(p.start)}
                  </span>
                  {showDuration && (
                    <span style={{
                      fontSize: 9, color: "#C0C0C0", lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                      direction: "ltr", unicodeBidi: "isolate",
                    }}>
                      {dH % 1 === 0 ? dH : dH.toFixed(1)}ש׳
                    </span>
                  )}
                </div>
              );
            })}

            {/* Cells — one per (period × day), no spanning — except full-time
                days, which get one card spanning all rows in that column */}
            {selectedEmployee && empPeriods
              ? <>
                  {empPeriods.map((p, rowIdx) =>
                    p.days.map((slice, dayIdx) => (
                      fullDayInfo?.[dayIdx].isFull ? null : (
                        <EmployeeCell
                          key={`r${rowIdx}-d${dayIdx}`}
                          slice={slice}
                          col={dayIdx + 2}
                          row={rowIdx + 1}
                          employee={selectedEmployee}
                        />
                      )
                    ))
                  )}
                  {fullDayInfo?.map((info, dayIdx) => info.isFull && (
                    <FullTimeDayCard
                      key={`card-${dayIdx}`}
                      col={dayIdx + 2}
                      row={`1 / span ${N}`}
                      startTime={fmt(FIRST_HOUR)}
                      endTime={fmt(LAST_HOUR)}
                      hours={LAST_HOUR - FIRST_HOUR}
                      coworkers={info.coworkers}
                    />
                  ))}
                </>
              : periods.map((p, rowIdx) =>
                  p.days.map((slice, dayIdx) => (
                    <Cell
                      key={`r${rowIdx}-d${dayIdx}`}
                      slice={slice}
                      col={dayIdx + 2}
                      row={rowIdx + 1}
                      shifts={shifts}
                      selectedEmployeeId={selectedEmployeeId}
                      useGreenFill={useGreenFill}
                      thresholds={thresholds}
                    />
                  ))
                )}

            {/* Live "now" line (Apple/Google Calendar style) — only on the
                actual current day, spans just that day's column. */}
            {nowLineVisible && (
              <div aria-hidden style={{ gridColumn: todayCol, gridRow: `1 / span ${N}`, position: "relative", pointerEvents: "none" }}>
                <div style={{
                  position: "absolute", left: -4, right: -4, top: `${nowTopPercent}%`,
                  height: 0, borderTop: "2px solid #E5252A", zIndex: 15,
                }}>
                  <span style={{
                    position: "absolute", insetInlineEnd: -4, top: -4,
                    width: 8, height: 8, borderRadius: "50%", background: "#E5252A",
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Legend onExport={onExport} exporting={exporting} thresholds={thresholds}/>
    </>
  );
}
