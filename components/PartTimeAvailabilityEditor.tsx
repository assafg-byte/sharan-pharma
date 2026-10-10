"use client";

import { useEffect, useRef, useState } from "react";
import { DAYS_HE, getWeekStart, addWeeks, formatWeekRange } from "@/types";

interface Slot { dayOfWeek: number; startHour: number; endHour: number; available: boolean }

type CellState = "unset" | "available" | "unavailable";
const NEXT: Record<CellState, CellState> = { unset: "available", available: "unavailable", unavailable: "unset" };

const STATE_STYLE: Record<CellState, { bg: string; border: string; text: string; accent: string; icon?: string }> = {
  unset:       { bg: "#F7F8FA", border: "#E5E7EB", text: "#9CA3AF", accent: "transparent" },
  available:   { bg: "#E3F4E5", border: "#B7E0BC", text: "#1F6B36", accent: "#16A34A", icon: "check" },
  unavailable: { bg: "#FDE5E3", border: "#F4B6B0", text: "#9F1239", accent: "#D7252F", icon: "x" },
};

const AP_HOURS = Array.from({ length: 8 }, (_, i) => 8 + i);

function upcomingWeeks(): { label: string; short: string; weekStart: Date }[] {
  return [0, 1, 2].map(offset => {
    const ws = addWeeks(getWeekStart(new Date()), offset + 1);
    const label = formatWeekRange(ws);
    const short = offset === 0 ? "השבוע הבא" : offset === 1 ? "שבועיים קדימה" : "שלושה שבועות";
    return { label, short, weekStart: ws };
  });
}

function nextBulkState(vals: CellState[]): CellState {
  const allSame = vals.every(v => v === vals[0]);
  return allSame ? NEXT[vals[0]] : "available";
}

interface Props { employeeId: number }

export default function PartTimeAvailabilityEditor({ employeeId }: Props) {
  const weeks = upcomingWeeks();
  // allGrids[weekIdx][day][hourIdx] = CellState
  const [allGrids, setAllGrids] = useState<CellState[][][]>(() =>
    weeks.map(() => DAYS_HE.map(() => Array<CellState>(8).fill("unset")))
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dragState = useRef<CellState | null>(null);

  useEffect(() => {
    fetch(`/api/availability?employeeId=${employeeId}`)
      .then(r => r.json())
      .then((slots: Slot[]) => {
        if (!slots.length) return;
        setAllGrids(prev => {
          const next = prev.map(w => w.map(r => [...r]));
          slots.forEach(s => {
            const hIdx = s.startHour - 8;
            if (hIdx >= 0 && hIdx < 8 && s.dayOfWeek >= 0 && s.dayOfWeek < 5) {
              next[0][s.dayOfWeek][hIdx] = s.available ? "available" : "unavailable";
            }
          });
          return next;
        });
      });
  }, [employeeId]);

  function setCell(wk: number, d: number, h: number, val: CellState) {
    setAllGrids(prev => {
      const next = prev.map(w => w.map(r => [...r]));
      next[wk][d][h] = val;
      return next;
    });
  }

  function cycleCell(wk: number, d: number, h: number) {
    setAllGrids(prev => {
      const next = prev.map(w => w.map(r => [...r]));
      next[wk][d][h] = NEXT[next[wk][d][h]];
      return next;
    });
  }

  function cycleColumn(wk: number, d: number) {
    const vals = AP_HOURS.map((_, hi) => allGrids[wk][d][hi]);
    const target = nextBulkState(vals);
    setAllGrids(prev => {
      const next = prev.map(w => w.map(r => [...r]));
      AP_HOURS.forEach((_, hi) => { next[wk][d][hi] = target; });
      return next;
    });
  }

  function cycleRow(wk: number, h: number) {
    const vals = DAYS_HE.map((_, d) => allGrids[wk][d][h]);
    const target = nextBulkState(vals);
    setAllGrids(prev => {
      const next = prev.map(w => w.map(r => [...r]));
      DAYS_HE.forEach((_, d) => { next[wk][d][h] = target; });
      return next;
    });
  }

  function fillWeek(wk: number, val: CellState) {
    setAllGrids(prev => {
      const next = prev.map(w => w.map(r => [...r]));
      DAYS_HE.forEach((_, d) => AP_HOURS.forEach((_, h) => { next[wk][d][h] = val; }));
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    // Save each week independently (3 parallel calls)
    await Promise.all(weeks.map((_, wk) => {
      const slots = DAYS_HE.flatMap((_, d) =>
        AP_HOURS.map((hour, h) => {
          const val = allGrids[wk][d][h];
          if (val === "unset") return null;
          return { dayOfWeek: d, startHour: hour, endHour: hour + 1, available: val === "available" };
        }).filter(Boolean)
      );
      return fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, slots }),
      });
    }));
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  // Summary: per-week counts
  const counts = weeks.map((_, wk) => {
    let available = 0, unavailable = 0, unset = 0;
    allGrids[wk].forEach(row => row.forEach(v => {
      if (v === "available") available++;
      else if (v === "unavailable") unavailable++;
      else unset++;
    }));
    return { available, unavailable, unset };
  });

  // Stop drag on global mouseup
  useEffect(() => {
    const stop = () => { dragState.current = null; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  function WeekGrid({ wk }: { wk: number }) {
    const grid = allGrids[wk];
    return (
      <div className="flex flex-col gap-2 min-w-0">
        {/* Week header pill */}
        <div className="text-center">
          <span className="inline-flex flex-col items-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{weeks[wk].short}</span>
            <span className="text-[12px] font-semibold text-gray-800 tabular-nums">{weeks[wk].label}</span>
          </span>
        </div>

        {/* Quick fill */}
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => fillWeek(wk, "available")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#16A34A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
            כולם
          </button>
          <button onClick={() => fillWeek(wk, "unavailable")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#D7252F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            נקה
          </button>
          <button onClick={() => fillWeek(wk, "unset")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            אפס
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {[["זמין", counts[wk].available, "#16A34A", "#E3F4E5"],
            ["לא זמין", counts[wk].unavailable, "#D7252F", "#FDE5E3"],
            ["לא הוגדר", counts[wk].unset, "#9CA3AF", "#F7F8FA"],
          ].map(([label, val, color, bg]) => (
            <div key={label as string} className="rounded-lg px-1 py-1" style={{ background: bg as string }}>
              <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: color as string, opacity: 0.7 }}>{label}</div>
              <div className="text-[14px] font-bold tabular-nums" style={{ color: color as string }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Day headers row */}
        <div className="grid" style={{ gridTemplateColumns: "32px repeat(5, 1fr)", gap: 3 }}>
          <div />
          {DAYS_HE.map((d, dIdx) => (
            <button key={d} onClick={() => cycleColumn(wk, dIdx)}
              className="h-8 flex items-center justify-center text-[11px] font-semibold text-gray-700 bg-white rounded-md border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors">
              {d}
            </button>
          ))}
        </div>

        {/* Hour rows */}
        <div className="grid" style={{ gridTemplateColumns: "32px repeat(5, 1fr)", gridAutoRows: "36px", gap: 3 }}>
          {AP_HOURS.map((hour, hIdx) => (
            <>
              <button key={`t${hIdx}`} onClick={() => cycleRow(wk, hIdx)}
                className="flex items-center justify-center text-[10px] font-medium text-gray-400 tabular-nums hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors">
                {String(hour).padStart(2,"0")}:00
              </button>
              {DAYS_HE.map((_, dIdx) => {
                const val = grid[dIdx][hIdx];
                const s = STATE_STYLE[val];
                return (
                  <button key={`${dIdx}-${hIdx}`}
                    className="group relative rounded-md transition-all select-none"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                    onClick={() => cycleCell(wk, dIdx, hIdx)}
                    onMouseDown={() => { dragState.current = NEXT[val]; setCell(wk, dIdx, hIdx, NEXT[val]); }}
                    onMouseEnter={() => { if (dragState.current) setCell(wk, dIdx, hIdx, dragState.current); }}>
                    {val !== "unset" && (
                      <span className="absolute top-0.5 bottom-0.5 rounded-sm" style={{ right: 2, width: 2, background: s.accent, opacity: 0.7 }} />
                    )}
                    <span className="absolute inset-0 grid place-items-center" style={{ color: s.text }}>
                      {s.icon === "check" && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>}
                      {s.icon === "x"     && <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>}
                      {!s.icon && <span className="opacity-0 group-hover:opacity-60 text-[10px]">+</span>}
                    </span>
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none" dir="rtl">
      <p className="text-[11px] text-gray-400 mb-3">לחץ/י על תא לשינוי · גרור לצביעה · לחץ על יום/שעה לעמודה/שורה שלמה</p>

      {/* 3 weeks side-by-side */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)", minWidth: 680 }}>
          {[0, 1, 2].map(wk => <WeekGrid key={wk} wk={wk} />)}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 shrink-0">
        <span className="text-[12px] font-medium transition-opacity" style={{ color: "#16A34A", opacity: savedFlash ? 1 : 0 }}>
          ✓ הזמינות נשמרה
        </span>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #E1241A 0%, #C81E13 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 12px -4px rgba(215,37,47,0.45)" }}
          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
          onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
          {saving ? "שומר..." : "שמור זמינות (3 שבועות)"}
        </button>
      </div>
    </div>
  );
}
