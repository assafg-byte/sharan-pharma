"use client";

import { useMemo } from "react";
import { Shift, Employee, DAYS_HE } from "@/types";

interface Props {
  shifts: Shift[];       // full roster — always, never filtered
  employees: Employee[];
}

export default function NotScheduledSection({ shifts, employees }: Props) {

  // Build scheduledMap once (O(shifts)) then do set-subtraction per day
  const notScheduledByDay = useMemo(() => {
    const scheduledMap = shifts.reduce((acc, s) => {
      if (!acc[s.dayOfWeek]) acc[s.dayOfWeek] = new Set<number>();
      acc[s.dayOfWeek].add(s.employeeId);
      return acc;
    }, {} as Record<number, Set<number>>);

    return Array.from({ length: 5 }, (_, day) => {
      const scheduled = scheduledMap[day] ?? new Set<number>();
      return employees.filter(e => !scheduled.has(e.id));
    });
  }, [shifts, employees]);

  const anyAbsent = notScheduledByDay.some(day => day.length > 0);
  if (!anyAbsent) return null;

  return (
    <div
      dir="rtl"
      style={{
        background: "#FAFAFA",
        borderRadius: 6,
        padding: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
          stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <path d="M7 2v4M17 2v4M3 10h18"/>
          <line x1="10" y1="14" x2="14" y2="18"/>
          <line x1="14" y1="14" x2="10" y2="18"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
          לא משובצות השבוע
        </span>
      </div>

      {/* 5-column day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {DAYS_HE.map((day, i) => {
          const absent = notScheduledByDay[i];
          return (
            <div key={day}>
              <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>{day}</div>
              <div style={{ fontSize: 11, color: "#2D2D2D", lineHeight: 1.5 }}>
                {absent.length === 0
                  ? <span style={{ color: "#BBB" }}>—</span>
                  : absent.map(e => e.name).join(", ")
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
