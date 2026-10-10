"use client";

import { useState } from "react";
import { Shift, Employee, DAYS_HE, SLOTS, SLOT_HEIGHT, AFTER_HOURS_START, DAY_NOTE_MAX_LENGTH, DAY_NOTE_COUNTER_THRESHOLD, formatTime } from "@/types";
import ShiftBlock from "./ShiftBlock";

// An employee with approved time off on a given weekday (bottom row of the grid)
export interface DayOffEntry {
  employeeId: number;
  name: string;
  color: string;
  type: string; // FULL_DAY | HALF_DAY | PART_TIME
}

const LEAVE_LABEL: Record<string, string> = { FULL_DAY: "יום שלם", HALF_DAY: "חצי יום", PART_TIME: "חלקי" };

// One manager note cell — read-only by default (double-click or the pencil
// icon enters edit mode), local draft while typing, persisted on blur.
function DayNoteCell({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Resync the draft when the server value changes (week navigation) —
  // "adjust state on prop change" during render, not in an effect.
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) { setSyncedValue(value); if (!editing) setDraft(value); }

  function startEdit() { setDraft(value); setEditing(true); }
  function finishEdit(next: string) {
    setEditing(false);
    if (next !== value) onSave(next);
  }

  const nearLimit = draft.length >= DAY_NOTE_COUNTER_THRESHOLD;

  if (editing) {
    return (
      <div className="border-l border-gray-200 p-1 flex flex-col gap-0.5">
        <textarea
          value={draft}
          maxLength={DAY_NOTE_MAX_LENGTH}
          rows={2}
          autoFocus
          placeholder="הערה ליום…"
          aria-label="הערת מנהל"
          onChange={e => setDraft(e.target.value)}
          onFocus={e => (e.target.style.boxShadow = "0 0 0 2px #FCD34D")}
          onBlur={e => { e.target.style.boxShadow = ""; finishEdit(e.target.value); }}
          className="w-full text-[11px] leading-snug border border-gray-200 rounded-md px-2 py-1 resize-none focus:outline-none bg-amber-50/40"
        />
        {nearLimit && (
          <span className="text-[9px] text-left tabular-nums text-amber-600 font-semibold" dir="ltr">
            {draft.length}/{DAY_NOTE_MAX_LENGTH}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative border-l border-gray-200 p-1 group min-h-[34px] cursor-text"
      onDoubleClick={startEdit}
      title="לחיצה כפולה לעריכה"
    >
      <button
        onClick={startEdit}
        aria-label="ערוך הערה"
        className="absolute top-0.5 left-0.5 w-5 h-5 grid place-items-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white/80 text-gray-400 hover:text-amber-600 transition-opacity"
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <p className="text-[11px] leading-snug whitespace-pre-wrap break-words pl-5 pr-0.5 py-0.5">
        {value || <span className="text-gray-300">הערה ליום…</span>}
      </p>
    </div>
  );
}

interface Props {
  shifts: Shift[];
  weekStart: Date;
  draggingEmployee: Employee | null;
  copiedShiftId: number | null;
  onDrop: (dayOfWeek: number, startHour: number) => void;
  onCellClick: (dayOfWeek: number, startHour: number) => void;
  onShiftSelect: (id: number) => void;
  onShiftDelete: (id: number) => void;
  onShiftResize: (id: number, durationHours: number) => void;
  onShiftResizeTop: (id: number, startHour: number, durationHours: number) => void;
  onShiftResizeEnd: (
    id: number,
    orig: { startHour: number; durationHours: number },
    final: { startHour: number; durationHours: number },
  ) => void;
  onShiftMove: (id: number, dayOfWeek: number, startHour: number) => void;
  // Manager notes — one per weekday (top row). Manager-only, edit mode only.
  dayNotes: Record<number, string>;
  onDayNoteSave: (dayOfWeek: number, text: string) => void;
  // Approved time off per weekday (bottom row)
  dayOffByDay: Record<number, DayOffEntry[]>;
}

interface ShiftLayout {
  colIndex: number;
  totalCols: number;
}

function overlaps(a: Shift, b: Shift) {
  return (
    a.startHour < b.startHour + b.durationHours &&
    b.startHour < a.startHour + a.durationHours
  );
}

function computeDayLayout(dayShifts: Shift[]): Map<number, ShiftLayout> {
  const result = new Map<number, ShiftLayout>();
  const sorted = [...dayShifts].sort((a, b) => a.startHour - b.startHour);

  const columns: Shift[][] = [];
  for (const shift of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (!columns[c].some((s) => overlaps(s, shift))) {
        columns[c].push(shift);
        result.set(shift.id, { colIndex: c, totalCols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([shift]);
      result.set(shift.id, { colIndex: columns.length - 1, totalCols: 0 });
    }
  }

  for (const shift of sorted) {
    const myCol = result.get(shift.id)!.colIndex;
    const overlapCols = sorted
      .filter((s) => s.id !== shift.id && overlaps(s, shift))
      .map((s) => result.get(s.id)!.colIndex);
    result.set(shift.id, {
      colIndex: myCol,
      totalCols: Math.max(myCol, ...overlapCols) + 1,
    });
  }

  return result;
}

function dayDateLabel(weekStart: Date, dayIdx: number) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIdx);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export default function WeeklyGrid({
  shifts,
  weekStart,
  draggingEmployee,
  copiedShiftId,
  onDrop,
  onCellClick,
  onShiftSelect,
  onShiftDelete,
  onShiftResize,
  onShiftResizeTop,
  onShiftResizeEnd,
  onShiftMove,
  dayNotes,
  onDayNoteSave,
  dayOffByDay,
}: Props) {

  const layouts = new Map<number, Map<number, ShiftLayout>>();
  for (let day = 0; day < 5; day++) {
    layouts.set(day, computeDayLayout(shifts.filter((s) => s.dayOfWeek === day)));
  }

  function getShiftsStartingAt(day: number, slot: number) {
    return shifts.filter((s) => s.dayOfWeek === day && s.startHour === slot);
  }

  function isSlotOccupied(day: number, slot: number) {
    return shifts.some(
      (s) =>
        s.dayOfWeek === day &&
        s.startHour <= slot &&
        s.startHour + s.durationHours > slot
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: React.DragEvent, day: number, slot: number) {
    e.preventDefault();
    if (isAfterHours(slot)) return; // after-hours cells are not schedulable
    const shiftId = e.dataTransfer.getData("shiftId");
    if (shiftId) {
      onShiftMove(Number(shiftId), day, slot);
    } else {
      onDrop(day, slot);
    }
  }

  function handleCellClick(day: number, slot: number) {
    if (isAfterHours(slot)) return; // after-hours cells are not schedulable
    if (copiedShiftId !== null) {
      onCellClick(day, slot);
    }
  }

  const isFullHour = (slot: number) => slot % 1 === 0;
  const isAfterHours = (slot: number) => slot >= AFTER_HOURS_START;

  return (
    <div className="overflow-x-auto" dir="rtl">
      <div id="weekly-grid" className="min-w-[700px]">

        {/* Header */}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(5, 1fr)` }}>
          <div className="h-14" />
          {DAYS_HE.map((day, dayIdx) => (
            <div
              key={day}
              className="h-14 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-l border-gray-200"
            >
              <span>{day}</span>
              <span className="text-xs font-normal text-gray-400">{dayDateLabel(weekStart, dayIdx)}</span>
            </div>
          ))}
        </div>

        {/* Manager notes row — above the first hour slot */}
        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `48px repeat(5, 1fr)` }}>
          <div className="flex items-center justify-center text-[10px] font-medium text-gray-400 border-l border-gray-200 bg-gray-50 text-center leading-tight px-0.5">
            הערות מנהל
          </div>
          {DAYS_HE.map((_, dayIdx) => (
            <DayNoteCell key={dayIdx} value={dayNotes[dayIdx] ?? ""} onSave={(text) => onDayNoteSave(dayIdx, text)} />
          ))}
        </div>

        {/* Slot rows */}
        {SLOTS.map((slot) => {
          const full = isFullHour(slot);
          const afterHours = isAfterHours(slot);

          return (
            <div
              key={slot}
              className="grid"
              style={{ gridTemplateColumns: `48px repeat(5, 1fr)`, height: SLOT_HEIGHT }}
            >
              {/* Time label */}
              <div
                className={`flex items-start justify-start pl-2 pt-0.5 text-xs border-l border-gray-200 ${
                  afterHours
                    ? "text-gray-400 bg-gray-50"
                    : full
                    ? "text-gray-500 font-medium"
                    : "text-gray-300"
                }`}
              >
                {full ? formatTime(slot) : ""}
              </div>

              {/* Day cells */}
              {DAYS_HE.map((_, dayIdx) => {
                const cellShifts = getShiftsStartingAt(dayIdx, slot);
                const occupied = isSlotOccupied(dayIdx, slot);
                const dayLayout = layouts.get(dayIdx)!;
                const isPasteTarget = copiedShiftId !== null && !occupied;

                return (
                  <div
                    key={dayIdx}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dayIdx, slot)}
                    onClick={() => handleCellClick(dayIdx, slot)}
                    className={[
                      "relative border-l transition-colors",
                      full ? "border-t border-gray-200" : "border-t border-dashed border-gray-100",
                      afterHours ? "bg-gray-50" : "",
                      !afterHours && !occupied && draggingEmployee ? "bg-blue-50/50" : "",
                      isPasteTarget && !afterHours ? "cursor-copy hover:bg-green-50" : "",
                    ].join(" ")}
                    style={{ height: SLOT_HEIGHT }}
                  >
                    {cellShifts.map((shift) => {
                      const layout = dayLayout.get(shift.id) ?? { colIndex: 0, totalCols: 1 };
                      return (
                        <ShiftBlock
                          key={shift.id}
                          shift={shift}
                          columnIndex={layout.colIndex}
                          totalColumns={layout.totalCols}
                          selected={shift.id === copiedShiftId}
                          onSelect={onShiftSelect}
                          onDelete={onShiftDelete}
                          onResize={onShiftResize}
                          onResizeTop={onShiftResizeTop}
                          onResizeEnd={onShiftResizeEnd}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Approved day-off row — below the last slot */}
        <div className="grid border-t border-gray-200" style={{ gridTemplateColumns: `48px repeat(5, 1fr)` }}>
          <div className="flex items-center justify-center text-[10px] font-medium text-gray-400 border-l border-gray-200 bg-gray-50">
            חופש
          </div>
          {DAYS_HE.map((_, dayIdx) => {
            const entries = dayOffByDay[dayIdx] ?? [];
            return (
              <div key={dayIdx} className="border-l border-gray-200 bg-gray-50/60 px-1.5 py-1 flex flex-col gap-0.5" style={{ minHeight: 28 }}>
                {entries.map((e) => (
                  <span key={e.employeeId} className="inline-flex items-center gap-1 text-[11px] font-medium leading-tight" title={`${e.name} · ${LEAVE_LABEL[e.type] ?? e.type}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                    <span className="truncate" style={{ color: e.color }}>{e.name}</span>
                    <span className="text-gray-400 font-normal shrink-0">· {LEAVE_LABEL[e.type] ?? e.type}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
