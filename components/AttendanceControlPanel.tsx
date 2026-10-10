"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AttendanceBreak {
  id: number; attendanceId: number; breakStart: string; breakEnd: string | null;
}
interface AttendanceRecord {
  id: number; date: string; checkInTime: string | null; checkOutTime: string | null;
  breaks: AttendanceBreak[];
}
type AttendanceStatus = "not-in" | "clocked-in" | "on-break" | "clocked-out";
interface EmployeeEntry {
  employee: { id: number; name: string; color: string };
  attendance: AttendanceRecord | null;
  status: AttendanceStatus;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  "clocked-in":  "נכנסה",
  "on-break":    "בהפסקה",
  "clocked-out": "יצאה",
  "not-in":      "לא נכנסה",
};
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  "clocked-in":  "#22C55E",
  "on-break":    "#F59E0B",
  "clocked-out": "#9CA3AF",
  "not-in":      "#E5E7EB",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function timeInputToISO(date: string, timeStr: string): string {
  // date = "YYYY-MM-DD", timeStr = "HH:MM"
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// Elapsed since ISO — updates every 60s
function useElapsedSince(iso: string | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!iso) { setLabel(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 60) setLabel(`${diff}′`);
      else setLabel(`${Math.floor(diff/60)}h ${diff%60}′`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [iso]);
  return label;
}

// ── Top section: live status card ────────────────────────────────────────────
function LiveCard({ entry, onRefresh }: { entry: EmployeeEntry; onRefresh: () => void }) {
  const [useNow, setUseNow] = useState(true);
  const [timeOverride, setTimeOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const lastEventIso =
    entry.status === "on-break"
      ? entry.attendance?.breaks.find(b => !b.breakEnd)?.breakStart ?? null
      : entry.status === "clocked-in"  ? entry.attendance?.checkInTime ?? null
      : entry.status === "clocked-out" ? entry.attendance?.checkOutTime ?? null
      : null;
  const elapsed = useElapsedSince(lastEventIso);

  async function doAction() {
    if (busy) return;
    setBusy(true);
    const timeISO = !useNow && timeOverride
      ? timeInputToISO(todayStr(), timeOverride)
      : new Date().toISOString();
    try {
      if (entry.status === "not-in" || entry.status === "clocked-out") {
        // כניסה on behalf of employee
        await fetch("/api/attendance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: entry.employee.id, date: todayStr(), checkInTime: timeISO, weekKey: "" }),
        });
      } else if (entry.status === "clocked-in") {
        // יציאה on behalf of employee
        await fetch(`/api/attendance/${entry.attendance!.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkOutTime: timeISO }),
        });
      }
      setUseNow(true);
      setTimeOverride("");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  const canAct = entry.status !== "on-break"; // can't proxy while on break

  return (
    <div dir="rtl" className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-gray-100 bg-gray-50">
      {/* Color + status dot */}
      <span className="relative shrink-0" style={{ width: 32, height: 32 }}>
        <span className="absolute inset-0 rounded-full opacity-20" style={{ background: STATUS_COLOR[entry.status] }} />
        <span className="absolute inset-[5px] rounded-full" style={{ background: entry.employee.color }} />
        <span className="absolute bottom-0 left-0 w-3 h-3 rounded-full border-2 border-white"
          style={{ background: STATUS_COLOR[entry.status] }} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{entry.employee.name}</p>
        <p className="text-xs text-gray-500">
          {STATUS_LABEL[entry.status]}
          {elapsed ? ` · ${elapsed}` : ""}
        </p>
      </div>

      {canAct && (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Time override toggle */}
          <div className="flex flex-col items-end gap-0.5">
            <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={!useNow} onChange={e => setUseNow(!e.target.checked)} className="w-3 h-3" />
              שעה ספציפית
            </label>
            {!useNow && (
              <input
                type="time"
                value={timeOverride}
                onChange={e => setTimeOverride(e.target.value)}
                className="text-[11px] border border-gray-200 rounded px-1 py-0.5 w-[72px]"
              />
            )}
          </div>
          <button
            onClick={doAction}
            disabled={busy || (!useNow && !timeOverride)}
            className="px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40 transition-colors"
            style={{ background: entry.status === "clocked-in" ? "#D7252F" : "#16A34A" }}
          >
            {busy ? "..." : entry.status === "clocked-in" ? "יציאה" : "כניסה"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── History section: editable past shifts ─────────────────────────────────────
interface BreakRowProps {
  breakRecord: AttendanceBreak;
  attendanceId: number;
  isLocked: boolean;
  onUpdated: (updated: AttendanceBreak) => void;
  onDeleted: (id: number) => void;
}

function BreakRow({ breakRecord, attendanceId, isLocked, onUpdated, onDeleted }: BreakRowProps) {
  const [startVal, setStartVal] = useState(toTimeInput(breakRecord.breakStart));
  const [endVal, setEndVal]     = useState(toTimeInput(breakRecord.breakEnd));
  const [saving, setSaving]     = useState(false);

  const date = breakRecord.breakStart.slice(0, 10);

  async function save() {
    setSaving(true);
    const body: Record<string, string> = {};
    if (startVal) body.breakStart = timeInputToISO(date, startVal);
    if (endVal)   body.breakEnd   = timeInputToISO(date, endVal);
    const res = await fetch(`/api/attendance/${attendanceId}/break/${breakRecord.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json());
    onUpdated(res);
    setSaving(false);
  }

  async function remove() {
    if (!confirm("למחוק הפסקה זו?")) return;
    await fetch(`/api/attendance/${attendanceId}/break/${breakRecord.id}`, { method: "DELETE" });
    onDeleted(breakRecord.id);
  }

  return (
    <div dir="rtl" className="flex items-center gap-2 py-1.5 text-xs text-gray-600">
      <span className="text-gray-300 text-[10px] font-medium w-10 shrink-0">הפסקה</span>
      <input type="time" value={startVal} onChange={e => setStartVal(e.target.value)} disabled={isLocked}
        className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px] disabled:opacity-40" />
      <span className="text-gray-300">–</span>
      <input type="time" value={endVal} onChange={e => setEndVal(e.target.value)} disabled={isLocked}
        className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px] disabled:opacity-40" />
      {!isLocked && (
        <>
          <button onClick={save} disabled={saving}
            className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 disabled:opacity-40">
            {saving ? "..." : "שמור"}
          </button>
          <button onClick={remove}
            className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100">
            מחק
          </button>
        </>
      )}
    </div>
  );
}

function HistoryRow({ record, onUpdated }: { record: AttendanceRecord; onUpdated: (r: AttendanceRecord) => void }) {
  const [inTime, setInTime]   = useState(toTimeInput(record.checkInTime));
  const [outTime, setOutTime] = useState(toTimeInput(record.checkOutTime));
  const [saving, setSaving]   = useState(false);
  const [breaks, setBreaks]   = useState<AttendanceBreak[]>(record.breaks ?? []);
  const [addingBreak, setAddingBreak] = useState(false);
  const [newBrkStart, setNewBrkStart] = useState("");
  const [newBrkEnd, setNewBrkEnd]     = useState("");

  // Active (open) shifts are read-only — edge case protection
  const isLocked = !record.checkOutTime;

  async function saveShiftTimes() {
    if (isLocked) return;
    setSaving(true);
    const body: Record<string, string> = {};
    if (inTime)  body.checkInTime  = timeInputToISO(record.date, inTime);
    if (outTime) body.checkOutTime = timeInputToISO(record.date, outTime);
    const res = await fetch(`/api/attendance/${record.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json());
    onUpdated(res);
    setSaving(false);
  }

  async function addBreak() {
    if (!newBrkStart) return;
    const body: Record<string, string> = { breakStart: timeInputToISO(record.date, newBrkStart) };
    if (newBrkEnd) body.breakEnd = timeInputToISO(record.date, newBrkEnd);
    const res = await fetch(`/api/attendance/${record.id}/break`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json());
    setBreaks(prev => [...prev, res]);
    setNewBrkStart(""); setNewBrkEnd(""); setAddingBreak(false);
  }

  return (
    <div dir="rtl" className="rounded-xl border border-gray-100 overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
        <span className="text-xs font-semibold text-gray-700">
          {record.date.split("-").reverse().join("/")}
        </span>
        {isLocked && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-medium">
            משמרת פעילה — עריכה אפשרית לאחר יציאה
          </span>
        )}
      </div>

      <div className="px-3 pb-3 pt-1.5 space-y-1.5">
        {/* Shift times */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="text-gray-300 text-[10px] font-medium w-10 shrink-0">כניסה</span>
          <input type="time" value={inTime} onChange={e => setInTime(e.target.value)} disabled={isLocked}
            className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px] disabled:opacity-40" />
          <span className="text-gray-300 text-[10px] font-medium w-8 shrink-0">יציאה</span>
          <input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} disabled={isLocked}
            className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px] disabled:opacity-40" />
          {!isLocked && (
            <button onClick={saveShiftTimes} disabled={saving}
              className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 disabled:opacity-40">
              {saving ? "..." : "שמור"}
            </button>
          )}
        </div>

        {/* Break rows */}
        {breaks.map(b => (
          <BreakRow
            key={b.id}
            breakRecord={b}
            attendanceId={record.id}
            isLocked={isLocked}
            onUpdated={updated => setBreaks(prev => prev.map(x => x.id === updated.id ? updated : x))}
            onDeleted={id => setBreaks(prev => prev.filter(x => x.id !== id))}
          />
        ))}

        {/* Add break */}
        {!isLocked && (
          addingBreak ? (
            <div dir="rtl" className="flex items-center gap-2 text-xs text-gray-600 pt-0.5">
              <span className="text-gray-300 text-[10px] font-medium w-10 shrink-0">הוסף</span>
              <input type="time" value={newBrkStart} onChange={e => setNewBrkStart(e.target.value)}
                placeholder="התחלה" className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px]" />
              <span className="text-gray-300">–</span>
              <input type="time" value={newBrkEnd} onChange={e => setNewBrkEnd(e.target.value)}
                placeholder="סיום" className="border border-gray-200 rounded px-1.5 py-0.5 w-[72px]" />
              <button onClick={addBreak}
                className="px-2 py-0.5 text-[10px] bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">
                הוסף
              </button>
              <button onClick={() => setAddingBreak(false)}
                className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600">
                ביטול
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingBreak(true)}
              className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors pt-0.5">
              + הוסף הפסקה
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  focusEmployeeId: number | null;
  onClose: () => void;
}

export default function AttendanceControlPanel({ focusEmployeeId, onClose }: Props) {
  const [liveEntries, setLiveEntries] = useState<EmployeeEntry[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(focusEmployeeId);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const histRef = useRef<HTMLDivElement>(null);

  function fetchLive() {
    fetch(`/api/attendance/today?date=${todayStr()}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLiveEntries(data); })
      .catch(() => {});
  }

  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 60000);
    return () => clearInterval(t);
  }, []);

  // Scroll to focused employee on open
  useEffect(() => {
    if (focusEmployeeId && histRef.current) {
      setSelectedEmpId(focusEmployeeId);
    }
  }, [focusEmployeeId]);

  // Fetch history when selected employee changes
  useEffect(() => {
    if (!selectedEmpId) return;
    setHistLoading(true);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const today = todayStr();
    fetch(`/api/attendance?employeeId=${selectedEmpId}&from=${monthStart}&to=${today}`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setHistLoading(false); })
      .catch(() => setHistLoading(false));
  }, [selectedEmpId]);

  const sortedLive = [...liveEntries].sort((a, b) => {
    const order: Record<AttendanceStatus, number> = { "clocked-in": 0, "on-break": 1, "clocked-out": 2, "not-in": 3 };
    return order[a.status] - order[b.status];
  });

  const selectedEmployee = liveEntries.find(e => e.employee.id === selectedEmpId)?.employee ?? null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{ width: 520, maxWidth: "95vw", borderTopRightRadius: 24, borderBottomRightRadius: 24, background: "#FFFFFF",
          border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>

        {/* Top accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">לוח בקרה</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">נוכחות בזמן אמת</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Top: live status ── */}
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">נוכחות היום</p>
            <div className="flex flex-col gap-2">
              {sortedLive.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4 animate-pulse">טוען...</p>
              )}
              {sortedLive.map(entry => (
                <LiveCard key={entry.employee.id} entry={entry} onRefresh={fetchLive} />
              ))}
            </div>
          </div>

          {/* ── Bottom: history editor ── */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">עריכת היסטוריה</p>

            {/* Employee selector */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {liveEntries.map(e => (
                <button key={e.employee.id} onClick={() => setSelectedEmpId(e.employee.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                  style={{
                    background: selectedEmpId === e.employee.id ? e.employee.color : "#fff",
                    color: selectedEmpId === e.employee.id ? "#fff" : "#374151",
                    borderColor: selectedEmpId === e.employee.id ? e.employee.color : "#E5E7EB",
                  }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: selectedEmpId === e.employee.id ? "#fff" : e.employee.color }} />
                  {e.employee.name}
                </button>
              ))}
            </div>

            {selectedEmployee ? (
              histLoading ? (
                <p className="text-sm text-gray-400 text-center py-6 animate-pulse">טוען...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">אין רישומים החודש</p>
              ) : (
                <div ref={histRef} className="flex flex-col gap-3">
                  {history.map(record => (
                    <HistoryRow
                      key={record.id}
                      record={record}
                      onUpdated={updated =>
                        setHistory(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
                      }
                    />
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">בחרי עובדת לעריכת היסטוריה</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
