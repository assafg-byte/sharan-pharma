"use client";

import { useEffect, useState } from "react";

interface AttendanceBreak {
  id: number; breakStart: string; breakEnd: string | null;
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
}

const STATUS_RING: Record<AttendanceStatus, string> = {
  "clocked-in":  "#22C55E", // ירוק
  "on-break":    "#F59E0B", // צהוב
  "clocked-out": "#9CA3AF", // אפור
  "not-in":      "#E5E7EB", // אפור בהיר
};
const STATUS_LABEL: Record<AttendanceStatus, string> = {
  "clocked-in":  "נכנסה",
  "on-break":    "בהפסקה",
  "clocked-out": "יצאה",
  "not-in":      "לא נכנסה",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function useElapsedSince(iso: string | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!iso) { setLabel(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 60) setLabel(`${diff}′`);
      else setLabel(`${Math.floor(diff/60)}h${diff%60 ? ` ${diff%60}′` : ""}`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [iso]);
  return label;
}

function lastEventTime(entry: EmployeeEntry): string | null {
  if (!entry.attendance) return null;
  const { checkInTime, checkOutTime, breaks } = entry.attendance;
  if (entry.status === "clocked-out") return checkOutTime;
  if (entry.status === "on-break") {
    const active = breaks.find(b => !b.breakEnd);
    return active?.breakStart ?? checkInTime;
  }
  return checkInTime;
}

function EmployeeChip({ entry, onOpen }: { entry: EmployeeEntry; onOpen: (id: number) => void }) {
  const lastEvt = lastEventTime(entry);
  const elapsed = useElapsedSince(lastEvt);
  const ringColor = STATUS_RING[entry.status];

  return (
    <button
      onClick={() => onOpen(entry.employee.id)}
      dir="rtl"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0 transition-colors hover:bg-gray-50"
      style={{ borderColor: "#F5D5D2", background: "#FFFBFA" }}
      title={STATUS_LABEL[entry.status]}
    >
      {/* Color dot + status ring */}
      <span className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
        <span className="absolute inset-0 rounded-full" style={{ background: ringColor, opacity: 0.25 }} />
        <span className="relative w-2.5 h-2.5 rounded-full" style={{ background: entry.employee.color }} />
      </span>
      <span className="text-gray-800">{entry.employee.name}</span>
      {elapsed && (
        <span className="text-gray-400 font-normal">{elapsed}</span>
      )}
      {/* Status indicator dot */}
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ringColor }} />
    </button>
  );
}

interface Props {
  onOpenPanel: (focusEmployeeId: number | null) => void;
}

export default function AttendanceStatusStrip({ onOpenPanel }: Props) {
  const [entries, setEntries] = useState<EmployeeEntry[]>([]);

  function fetchToday() {
    fetch(`/api/attendance/today?date=${todayStr()}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => {});
  }

  useEffect(() => {
    fetchToday();
    const t = setInterval(fetchToday, 60000);
    return () => clearInterval(t);
  }, []);

  // Show all employees (show "not-in" greyed out, shift-scheduled first)
  const sorted = [...entries].sort((a, b) => {
    const order: Record<AttendanceStatus, number> = { "clocked-in": 0, "on-break": 1, "clocked-out": 2, "not-in": 3 };
    return order[a.status] - order[b.status];
  });

  if (sorted.length === 0) return null;

  return (
    <div dir="rtl" className="mb-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">נוכחות היום</span>
        <button
          onClick={() => onOpenPanel(null)}
          className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          לוח בקרה ←
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {sorted.map(entry => (
          <EmployeeChip
            key={entry.employee.id}
            entry={entry}
            onOpen={(id) => onOpenPanel(id)}
          />
        ))}
      </div>
    </div>
  );
}
