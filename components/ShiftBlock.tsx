"use client";

import { useRef, useState } from "react";
import { Shift, SLOT_HEIGHT, formatTime } from "@/types";

interface Props {
  shift: Shift;
  columnIndex: number;
  totalColumns: number;
  selected: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onResize: (id: number, durationHours: number) => void;
  onResizeTop: (id: number, newStartHour: number, newDuration: number) => void;
  onResizeEnd: (
    id: number,
    orig: { startHour: number; durationHours: number },
    final: { startHour: number; durationHours: number },
  ) => void;
}

export default function ShiftBlock({
  shift,
  columnIndex,
  totalColumns,
  selected,
  onSelect,
  onDelete,
  onResize,
  onResizeTop,
  onResizeEnd,
}: Props) {
  const [resizing, setResizing] = useState(false);
  const didDrag = useRef(false);
  const startY = useRef(0);

  const height = shift.durationHours * SLOT_HEIGHT * 2;
  const endHour = shift.startHour + shift.durationHours;

  // Percentage-based: no pixel measurement needed, always accurate
  const leftPct = (columnIndex / totalColumns) * 100;
  const widthPct = (1 / totalColumns) * 100;

  function onBottomResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    startY.current = e.clientY;
    const origStart = shift.startHour;
    const startDuration = shift.durationHours;
    const maxDuration = 16 - shift.startHour;
    let finalDuration = startDuration;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientY - startY.current;
      const snapped = Math.round((startDuration + delta / SLOT_HEIGHT) * 2) / 2;
      finalDuration = Math.max(0.5, Math.min(maxDuration, snapped));
      onResize(shift.id, finalDuration);
    }
    function onMouseUp() {
      setResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      onResizeEnd(
        shift.id,
        { startHour: origStart, durationHours: startDuration },
        { startHour: origStart, durationHours: finalDuration },
      );
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onTopResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    startY.current = e.clientY;
    const origStart = shift.startHour;
    const origDuration = shift.durationHours;
    let finalStart = origStart;
    let finalDuration = origDuration;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientY - startY.current;
      const slotsDelta = Math.round((delta / SLOT_HEIGHT) * 2) / 2;
      const newStart = origStart + slotsDelta;
      const newDuration = origDuration - slotsDelta;
      if (newStart < 8 || newDuration < 0.5) return;
      finalStart = newStart;
      finalDuration = newDuration;
      onResizeTop(shift.id, newStart, newDuration);
    }
    function onMouseUp() {
      setResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      onResizeEnd(
        shift.id,
        { startHour: origStart, durationHours: origDuration },
        { startHour: finalStart, durationHours: finalDuration },
      );
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onDragStart(e: React.DragEvent) {
    didDrag.current = true;
    e.dataTransfer.setData("shiftId", String(shift.id));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!didDrag.current) onSelect(shift.id);
    didDrag.current = false;
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => { didDrag.current = false; }}
      onClick={handleClick}
      className="absolute rounded-md overflow-visible select-none transition-shadow shift-block"
      style={{
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        height: height - 2,
        top: 1,
        backgroundColor: shift.employee.color,
        opacity: totalColumns > 1 ? 0.82 : 1,
        cursor: resizing ? "ns-resize" : "grab",
        zIndex: selected ? 20 : 10,
        boxShadow: selected
          ? `0 0 0 3px white, 0 0 0 5px ${shift.employee.color}, 0 4px 12px rgba(0,0,0,0.3)`
          : "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      {/* Top resize handle */}
      <div
        onMouseDown={onTopResizeMouseDown}
        className="export-hide absolute top-0 left-0 right-0 h-4 cursor-ns-resize flex items-start justify-center pt-0.5 z-20"
      >
        <div className="w-6 h-0.5 rounded bg-white/50" />
      </div>

      {/* Start time floating on top border */}
      <div
        className="shift-time-label absolute left-1/2 -translate-x-1/2 -top-2.5 text-[10px] font-bold text-white px-1 rounded whitespace-nowrap z-30 pointer-events-none"
        style={{ backgroundColor: shift.employee.color }}
      >
        {formatTime(shift.startHour)}
      </div>

      {/* Name + delete */}
      <div className="flex items-center justify-between px-1.5 pt-5">
        <span className="text-white text-xs font-semibold leading-tight drop-shadow truncate">
          {shift.employee.name}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(shift.id); }}
          className="export-hide text-white/70 hover:text-white text-xs ml-1 leading-none flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Copy hint when selected */}
      {selected && (
        <div className="export-hide absolute inset-x-0 flex justify-center mt-1">
          <span className="text-[9px] text-white/90 bg-black/20 rounded px-1">
            לחץ על תא להדבקה
          </span>
        </div>
      )}

      {/* End time floating on bottom border */}
      <div
        className="shift-time-label absolute left-1/2 -translate-x-1/2 -bottom-2.5 text-[10px] font-bold text-white px-1 rounded whitespace-nowrap z-30 pointer-events-none"
        style={{ backgroundColor: shift.employee.color }}
      >
        {formatTime(endHour)}
      </div>

      {/* Bottom resize handle */}
      <div
        onMouseDown={onBottomResizeMouseDown}
        className="export-hide absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-end justify-center pb-0.5"
      >
        <div className="w-6 h-0.5 rounded bg-white/50" />
      </div>
    </div>
  );
}
