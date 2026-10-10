"use client";

import { Employee, Shift } from "@/types";

interface Props {
  employees: Employee[];
  shifts: Shift[];                              // full roster — for weekly-hours calculation
  selectedEmployeeId: number | null;
  onEmployeeSelect: (id: number | null) => void;
}

export default function EmployeeFilterStrip({
  employees,
  shifts,
  selectedEmployeeId,
  onEmployeeSelect,
}: Props) {

  // Weekly hours per employee (sum of durationHours across all their shifts)
  const weeklyHours: Record<number, number> = {};
  for (const s of shifts) {
    weeklyHours[s.employeeId] = (weeklyHours[s.employeeId] ?? 0) + s.durationHours;
  }

  function handleClick(id: number) {
    onEmployeeSelect(selectedEmployeeId === id ? null : id);
  }

  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "#FAFAFA",
        borderRadius: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 12, color: "#888", fontWeight: 600, flexShrink: 0 }}>
        עובדות:
      </span>

      {employees.map(emp => {
        const isSelected = emp.id === selectedEmployeeId;
        const hours = weeklyHours[emp.id] ?? 0;

        return (
          <button
            key={emp.id}
            onClick={() => handleClick(emp.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              border: isSelected ? `2px solid ${emp.color}` : "1px solid #E5E7EB",
              background: isSelected ? `${emp.color}1A` : "#fff",
              cursor: "pointer",
              fontSize: 12,
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: emp.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: "#2D2D2D" }}>{emp.name}</span>
            {hours > 0 && (
              <span style={{
                fontSize: 11, color: "#999",
                fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate",
              }}>
                {hours % 1 === 0 ? hours : hours.toFixed(1)}ש׳
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
