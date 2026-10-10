"use client";

import { useMemo } from "react";
import { Employee, Shift, DAYS_HE, formatWeekRange } from "@/types";

interface Props {
  employees: Employee[];
  shifts: Shift[];
  weekStart: Date;
  onClose: () => void;
}

const FIRST_HOUR = 8;
const LAST_HOUR  = 16;
const DAY_OPEN   = LAST_HOUR - FIRST_HOUR; // 8h

function fmtH(h: number) {
  if (h === 0) return "—";
  return Number.isInteger(h) ? `${h}` : h.toFixed(1).replace(/\.0$/, "");
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: accent }}>{value}</span>
    </div>
  );
}

export default function HoursPanel({ employees, shifts, weekStart, onClose }: Props) {
  const data = useMemo(() => {
    // dayHours[empIdx][dayIdx] = hours
    const dayHours = employees.map(emp =>
      [0, 1, 2, 3, 4].map(d =>
        shifts.filter(s => s.employeeId === emp.id && s.dayOfWeek === d)
              .reduce((acc, s) => acc + s.durationHours, 0)
      )
    );

    const empWeekly = employees.map((_, ei) => dayHours[ei].reduce((a, b) => a + b, 0));

    const dayTotals = [0, 1, 2, 3, 4].map(d =>
      employees.reduce((sum, _, ei) => sum + dayHours[ei][d], 0)
    );

    // gaps: uncovered half-hours per day
    const gaps = [0, 1, 2, 3, 4].map(d => {
      let gap = 0;
      for (let h = FIRST_HOUR; h < LAST_HOUR; h += 0.5) {
        const covered = shifts.some(s => s.dayOfWeek === d && s.startHour <= h && s.startHour + s.durationHours > h);
        if (!covered) gap += 0.5;
      }
      return gap;
    });

    const grandTotal = empWeekly.reduce((a, b) => a + b, 0);
    const totalGaps  = gaps.reduce((a, b) => a + b, 0);

    return { dayHours, empWeekly, dayTotals, gaps, grandTotal, totalGaps };
  }, [shifts, employees]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel — slides in from LEFT in RTL */}
      <aside
        className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden"
        dir="rtl"
        style={{
          width: 480,
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          background: "#FFFFFF",
          border: "1px solid #F5D5D2",
          boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)",
        }}
      >
        {/* Lilly-red accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none z-10"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Soft red orb */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">שעות עובדים</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500" aria-label="סגור">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Summary strip */}
        <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-gray-100 shrink-0">
          <Stat label="סה״כ שעות" value={fmtH(data.grandTotal)} accent="#0f172a" />
          <Stat label="שעות פתוחות" value={`${DAY_OPEN * 5}`} accent="#64748b" />
          <Stat label="פערים מוכסים" value={fmtH(data.totalGaps)} accent={data.totalGaps > 0 ? "#DC2626" : "#16A34A"} />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {employees.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">אין עובדים להצגה</p>
          )}

          {/* Per-employee cards */}
          {employees.map((emp, ei) => {
            const weekly = data.empWeekly[ei];
            return (
              <div key={emp.id} className="rounded-xl border border-gray-200 bg-white p-3" style={{ boxShadow: "0 1px 0 rgba(15,23,42,0.02)" }}>
                {/* Employee header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: emp.color }} />
                    <span className="text-[14px] font-semibold text-gray-900">{emp.name}</span>
                  </div>
                  <span className="text-[18px] font-bold tabular-nums" style={{ color: emp.color }}>
                    {fmtH(weekly)}h
                  </span>
                </div>

                {/* Day bars */}
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                  {DAYS_HE.map((day, di) => {
                    const h = data.dayHours[ei][di];
                    const ratio = DAY_OPEN ? h / DAY_OPEN : 0;
                    return (
                      <div key={di} className="flex flex-col items-stretch gap-1">
                        <div className="text-[10px] text-center text-gray-400 leading-none">{day}</div>
                        <div className="relative bg-gray-100 rounded h-7 overflow-hidden">
                          <div className="absolute bottom-0 left-0 right-0" style={{ height: `${ratio * 100}%`, background: h ? emp.color : "transparent", opacity: h ? 0.85 : 0 }} />
                          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums" style={{ color: h >= 4 ? "#fff" : "#475569" }}>
                            {h ? fmtH(h) : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Daily coverage totals */}
          {employees.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[13px] font-semibold text-gray-700">כיסוי יומי</span>
                <span className="text-[10px] text-gray-400">סה״כ שעות עובד לכל יום (פתוח: {DAY_OPEN}h)</span>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {DAYS_HE.map((day, di) => (
                  <div key={di} className="flex flex-col items-center gap-0.5">
                    <div className="text-[10px] text-gray-400 leading-none">{day}</div>
                    <div className="text-[13px] font-bold text-gray-800 tabular-nums">{fmtH(data.dayTotals[di])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gaps row */}
          {employees.length > 0 && (
            <div className="rounded-xl border border-red-100 p-3" style={{ background: "#FFF7F7" }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">⚠️</span>
                  <span className="text-[13px] font-semibold text-red-700">פערי כיסוי</span>
                </div>
                <span className="text-[10px] text-red-400">שעות ללא עובד פעיל</span>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {DAYS_HE.map((day, di) => {
                  const g = data.gaps[di];
                  return (
                    <div key={di} className="flex flex-col items-center gap-0.5">
                      <div className="text-[10px] text-gray-400 leading-none">{day}</div>
                      <div className="text-[13px] font-bold tabular-nums" style={{ color: g > 0 ? "#B42318" : "#94a3b8" }}>
                        {g > 0 ? fmtH(g) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
