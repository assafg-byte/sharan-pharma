"use client";

import { useMemo } from "react";
import WeekDisplay, { buildPeriods } from "./WeekDisplay";
import StatStrip from "./StatStrip";
import EmployeeFilterStrip from "./EmployeeFilterStrip";
import NotScheduledSection from "./NotScheduledSection";
import { Shift, Employee } from "@/types";

// ── Props ─────────────────────────────────────────────────────────────────────
// selectedEmployeeId / onEmployeeSelect are controlled by the parent page so
// that conflict-resolution logic (filterMine ↔ selection) lives in one place.

export interface ScheduleDashboardProps {
  shifts: Shift[];          // full roster — used by all dashboard sections
  displayShifts: Shift[];   // possibly filtered — passed to the table only
  employees: Employee[];
  selectedEmployeeId: number | null;
  onEmployeeSelect: (id: number | null) => void;
  filterJustCleared?: boolean;  // true for 3s after auto-clearing filterMine conflict
  // Pass-through props for WeekDisplay navigation / export
  onExport?: () => void;
  exporting?: boolean;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onSwitchToEdit?: () => void;
  onCopyPrevWeek?: () => void;
  // Manual table-style switch — manager-only. Omit on the employee page so
  // employees always see whichever style is current with no control of it.
  // The toggle button itself lives in edit mode (manager/page.tsx); this
  // only drives WeekDisplay's useGreenFill.
  tableStyle?: "new" | "old";
  // Sunday of the displayed week — passed through to WeekDisplay so it can
  // tell whether "now" falls inside this week (drives the live now-line).
  weekStart?: Date;
}

export default function ScheduleDashboard({
  shifts,
  displayShifts,
  employees,
  selectedEmployeeId,
  onEmployeeSelect,
  filterJustCleared = false,
  onExport,
  exporting,
  onPrevWeek,
  onNextWeek,
  onSwitchToEdit,
  onCopyPrevWeek,
  tableStyle,
  weekStart,
}: ScheduleDashboardProps) {

  // ── Stat calculations (always use full `shifts`, never filtered) ─────────────

  const stats = useMemo(() => {
    const periods = buildPeriods(shifts);

    let coverageHours = 0;
    let aloneCount = 0;
    let gapCount = 0;

    for (const p of periods) {
      const duration = p.end - p.start;
      for (const day of p.days) {
        const n = day.employeeIds.length;
        // Employee-hours, not wall-clock hours: 3 full-timers × 5 days × 8h = 120
        coverageHours += duration * n;
        if (n === 1) aloneCount++;
        else if (n === 0) gapCount++;
      }
    }

    const activeCount = new Set(shifts.map(s => s.employeeId)).size;

    return {
      coverageHours: Math.round(coverageHours * 10) / 10, // one decimal if needed
      aloneCount,
      gapCount,
      activeCount,
    };
  }, [shifts]);

  const selectedEmployee = selectedEmployeeId !== null
    ? employees.find(e => e.id === selectedEmployeeId) ?? null
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir="rtl">

      {/* ── Conflict-cleared note when no employee selected ── */}
      {!selectedEmployee && filterJustCleared && (
        <div style={{
          fontSize: 11, color: "#854F0B",
          background: "#FFFBF0", border: "0.5px solid #FCD34D",
          borderRadius: 6, padding: "6px 12px",
        }}>
          &quot;רק שלי&quot; בוטל
        </div>
      )}

      {/* ── Stat strip ── */}
      <StatStrip
        coverageHours={stats.coverageHours}
        aloneCount={stats.aloneCount}
        gapCount={stats.gapCount}
        activeCount={stats.activeCount}
      />

      {/* ── Table (full width — no side panel) ── */}
      <div>
        {/* Selected-employee label above the table removed per request —
            deselect by clicking her pill again in the filter strip below. */}
        <WeekDisplay
          shifts={displayShifts}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId ?? undefined}
          onExport={onExport}
          exporting={exporting}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          onSwitchToEdit={onSwitchToEdit}
          onCopyPrevWeek={onCopyPrevWeek}
          useGreenFill={tableStyle !== "old"}
          weekStart={weekStart}
        />
      </div>

      {/* ── Employee filter strip — below the table + legend, full width ── */}
      <EmployeeFilterStrip
        employees={employees}
        shifts={shifts}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeSelect={onEmployeeSelect}
      />

      {/* ── Not scheduled this week ── */}
      <NotScheduledSection shifts={shifts} employees={employees} />
    </div>
  );
}
