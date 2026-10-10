"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import React from "react";
import { Shift, Employee, weekKeyFromDate, getWeekStart, addWeeks, formatWeekRange } from "@/types";
import ScheduleDashboard from "@/components/ScheduleDashboard";
import CheckInModal from "@/components/CheckInModal";
import HoursReport from "@/components/HoursReport";
import VacationPanel from "@/components/VacationPanel";
import DailyChecklist from "@/components/DailyChecklist";
import CampusModal from "@/components/CampusModal";
import PartTimeAvailabilityEditor from "@/components/PartTimeAvailabilityEditor";
import EmployeeKanban from "@/components/EmployeeKanban";
import MounjaroLeafletPanel from "@/components/MounjaroLeafletPanel";
import BreakBar from "@/components/BreakBar";
import { BreakReturnModal } from "@/components/BreakReturnModal";
import TaskPopup from "@/components/TaskPopup";

type CheckInPhase = "loading" | "clock-in" | "checklist" | "campus" | "done";

interface Task {
  id: number; title: string; description: string;
  dueDate: string; priority: string; status: string; assigneeIds: string;
}
interface AttendanceBreak {
  id: number; attendanceId: number; breakStart: string; breakEnd: string | null;
}
interface Attendance {
  id: number; date: string; checkInTime: string | null; checkOutTime: string | null;
  breaks: AttendanceBreak[];
}
interface CampusSettingsData {
  enabled: boolean; questionsPerSession: number;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Employee menu ─────────────────────────────────────────────────────────────
function EmployeeMenu({ onHours, onTasks, onVacation, onAvailability, onLeaflet, isPartTime, unseenCount, unseenTimeOffCount }: {
  onHours: () => void; onTasks: () => void; onVacation: () => void;
  onAvailability: () => void; onLeaflet: () => void; isPartTime: boolean; unseenCount: number; unseenTimeOffCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, tint: string, accent: string, badge?: number) => (
    <button onClick={() => { onClick(); setOpen(false); }}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-gray-800 hover:bg-gray-50 transition-colors text-right" dir="rtl">
      <span className="grid place-items-center rounded-md shrink-0 relative" style={{ width: 26, height: 26, background: tint, color: accent }}>
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium rounded-lg border transition-colors ${open ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
        style={{ height: 36 }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
        <span>תפריט</span>
        {unseenCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unseenCount > 9 ? "9+" : unseenCount}</span>
        )}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div role="menu" dir="rtl" className="absolute z-30 mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ left: 0, minWidth: 230, boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08)" }}>
          <div className="py-1.5">
            {item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
              "עלון מוּנגָ׳רוֹ", onLeaflet, "#EFF6FF", "#1E40AF")}
            {item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>,
              "משימות", onTasks, "#F0EBFF", "#7C3AED", unseenCount)}
            {isPartTime && item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 2v4M17 2v4M3 10h18"/></svg>,
              "זמינות שבועית", onAvailability, "#DBEAFE", "#1E40AF")}
            {item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
              "חופש 🏖️", onVacation, "#CFFAFE", "#0E7490", unseenTimeOffCount)}
            {item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
              "שעון נוכחות", onHours, "#E3F4E5", "#16A34A")}
            <div className="my-1 h-px bg-gray-100" />
            {item(<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
              "התנתק", () => signOut({ callbackUrl: "/login" }), "#FEF2F2", "#DC2626")}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Availability panel ────────────────────────────────────────────────────────
function AvailabilityPanel({ employeeId, onClose }: { employeeId: number; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{ width: 880, maxWidth: "95vw", borderTopRightRadius: 24, borderBottomRightRadius: 24, background: "#FFFFFF",
          border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-[18px] font-bold text-gray-900">זמינות שבועית</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <PartTimeAvailabilityEditor employeeId={employeeId} />
        </div>
      </aside>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function WeekSkeleton() {
  return (
    <div dir="rtl" className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="grid mb-[6px]" style={{ gridTemplateColumns: "56px repeat(5, 1fr)", gap: 6 }}>
          <div />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "56px repeat(5, 1fr)", gridTemplateRows: "repeat(8, 78px)", gap: 6 }}>
          {Array.from({ length: 5 }).map((_, col) =>
            Array.from({ length: 8 }).map((_, row) => (
              <div key={`${col}-${row}`} className="rounded-lg bg-gray-100 animate-pulse"
                style={{ gridColumn: col + 2, gridRow: row + 1, animationDelay: `${(col + row) * 40}ms` }} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Elapsed time hook ────────────────────────────────────────────────────────
// Break elapsed time counter — counts up independently from breakStart
function useBreakElapsed(breakStart: string | null) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!breakStart) { setElapsed(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(breakStart).getTime()) / 1000);
      const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60);
      setElapsed(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [breakStart]);
  return elapsed;
}

// Pre-computed confetti for the campus-disabled end-of-checklist reward
const END_CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  x:     (i * 37 + 11) % 97,
  color: ["#D7252F","#FBBF24","#34D399","#60A5FA","#A78BFA","#F472B6"][i % 6],
  delay: ((i * 0.06) % 0.45).toFixed(2),
  size:  8 + (i % 3) * 3,
}));

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeePage() {
  const { data: session, status } = useSession();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [filterMine, setFilterMine] = useState(false);
  // Dashboard selection — auto-defaults to self; resets on page load (no localStorage)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [filterJustCleared, setFilterJustCleared] = useState(false);
  const [checkInPhase, setCheckInPhase] = useState<CheckInPhase>("loading");
  const [campusSettings, setCampusSettings] = useState<CampusSettingsData | null>(null);
  const [panel, setPanel] = useState<"hours" | "tasks" | "vacation" | "availability" | "leaflet" | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [unseenTimeOffCount, setUnseenTimeOffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showEndConfetti, setShowEndConfetti] = useState(false);
  const [fadeReady, setFadeReady] = useState(false);

  const [activeBreak, setActiveBreak] = useState<AttendanceBreak | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  // Daily task pop-up — null = hidden
  const [taskPopupTasks, setTaskPopupTasks] = useState<Task[] | null>(null);

  const phaseInitialized = useRef(false);
  const clockingIn = useRef(false); // Bug 5: lock against double-tap
  const clearBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refinement 3: AbortController — cancels stale fetches on rapid week-switching
  const fetchAbortRef = useRef<AbortController | null>(null);

  const empId = session?.user?.employeeId;


  // Clean up all timers and in-flight fetches on unmount
  useEffect(() => () => {
    if (clearBannerTimer.current) clearTimeout(clearBannerTimer.current);
    if (confettiTimerRef.current)  clearTimeout(confettiTimerRef.current);
    if (taskPopupTimerRef.current) clearTimeout(taskPopupTimerRef.current);
    fetchAbortRef.current?.abort();
  }, []);

  function handleEmployeeSelect(id: number | null) {
    setSelectedEmployeeId(id);
    // Conflict: selecting a different employee auto-clears "mine only"
    if (id !== null && id !== empId && filterMine) {
      setFilterMine(false);
      if (clearBannerTimer.current) clearTimeout(clearBannerTimer.current);
      setFilterJustCleared(true);
      clearBannerTimer.current = setTimeout(() => {
        setFilterJustCleared(false);
        clearBannerTimer.current = null;
      }, 3000);
    }
  }
  const weekKey = weekKeyFromDate(weekStart);
  const today = todayStr();

  // Cross-fade
  useEffect(() => {
    if (loading) { setShowSkeleton(true); setFadeReady(false); return; }
    const raf = requestAnimationFrame(() => setFadeReady(true));
    const t = setTimeout(() => setShowSkeleton(false), 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [loading]);

  // Main data fetch — re-runs on week navigation
  // Refinement 3: AbortController cancels stale responses from previous weeks
  useEffect(() => {
    if (!empId) return;

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    Promise.all([
      fetch(`/api/schedule?weekKey=${weekKey}`, { signal }).then(r => r.json()),
      fetch("/api/tasks", { signal }).then(r => r.json()),
      fetch(`/api/attendance?employeeId=${empId}&from=${today}&to=${today}`, { signal }).then(r => r.json()),
      fetch(`/api/time-off?employeeId=${empId}`, { signal }).then(r => r.json()),
      fetch("/api/campus/settings", { signal }).then(r => r.json()),
    ]).then(([sched, allTasks, att, timeOffList, campus]) => {
      setAllShifts(sched.shifts ?? []);
      setAllEmployees(sched.employees ?? []);
      setCampusSettings(campus);

      // Task badge
      const mine = allTasks.filter((t: Task) =>
        t.status !== "DONE" && t.assigneeIds?.split(",").filter(Boolean).includes(String(empId))
      );
      const seenRaw = localStorage.getItem(`seen_tasks_${empId}`) ?? "[]";
      const seen: number[] = JSON.parse(seenRaw);
      setUnseenCount(mine.filter((t: Task) => !seen.includes(t.id)).length);

      // חופש badge
      const seenTimeOffRaw = localStorage.getItem(`seen_timeoff_${empId}`) ?? "[]";
      const seenTimeOff: { id: number; status: string }[] = JSON.parse(seenTimeOffRaw);
      const newUnseen = (timeOffList as { id: number; status: string }[]).filter(r =>
        !seenTimeOff.some(s => s.id === r.id && s.status === r.status)
      ).length;
      setUnseenTimeOffCount(newUnseen);

      setAttendance(att);

      // Restore active break if employee is mid-break on page load
      const openRec = att.find((a: Attendance) => a.date === today && !a.checkOutTime);
      if (openRec) {
        const ongoing = openRec.breaks?.find((b: AttendanceBreak) => !b.breakEnd) ?? null;
        setActiveBreak(ongoing);
      }

      setLoading(false);

      // Auto-checkout
      const open = att.find((a: Attendance) => a.date === today && !a.checkOutTime);
      if (open) {
        const myShifts = (sched.shifts ?? []).filter((s: Shift) => s.employeeId === empId);
        const ts = myShifts.find((s: Shift) => s.dayOfWeek === new Date().getDay());
        if (ts) {
          const endH = ts.startHour + ts.durationHours;
          if (new Date().getHours() + new Date().getMinutes() / 60 > endH) {
            const co = new Date();
            co.setHours(Math.floor(endH), Math.round((endH % 1) * 60), 0, 0);
            fetch(`/api/attendance/${open.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkOutTime: co.toISOString() }) });
          }
        }
      }

      // Initialize CheckInPhase once — not on subsequent week-navigation re-fetches.
      if (!phaseInitialized.current) {
        phaseInitialized.current = true;
        const hasOpenRecord = att.some(
          (a: Attendance) => a.date === today && !a.checkOutTime
        );
        setCheckInPhase(hasOpenRecord ? "done" : "clock-in");
      }
    }).catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") return; // stale — discard silently
      setLoading(false);
      if (!phaseInitialized.current) {
        phaseInitialized.current = true;
        setCheckInPhase("clock-in");
      }
    });
  }, [empId, weekKey, today]);

  // Task pop-up: ~2s after the check-in flow lands on the dashboard, then
  // re-checked every 60s for the rest of the session. Tracks which specific
  // task IDs have already been popped today (not just "was a popup shown
  // today") so a task the manager assigns mid-day still triggers a fresh
  // pop-up — the earlier "once a day, period" gate silently swallowed those.
  // When it does trigger, it always shows every currently-open task
  // consolidated in one pop-up, not just the new one. Showing it counts as
  // the employee having viewed each listed task (server-side, idempotent).
  const taskPopupOpenRef = useRef(false);
  useEffect(() => { taskPopupOpenRef.current = taskPopupTasks !== null; }, [taskPopupTasks]);

  useEffect(() => {
    if (checkInPhase !== "done" || !empId) return;

    function checkForNewTasks() {
      if (taskPopupOpenRef.current) return; // don't interrupt an open popup — next tick retries
      fetch("/api/tasks")
        .then(r => r.json())
        .then((all: Task[]) => {
          const mine = all.filter(t =>
            t.status !== "DONE" && t.assigneeIds?.split(",").filter(Boolean).includes(String(empId))
          );
          if (mine.length === 0) return;
          let seenIds: number[] = [];
          try { seenIds = JSON.parse(localStorage.getItem(`task_popup_seen_${empId}_${today}`) ?? "[]"); } catch {}
          const hasUnseen = mine.some(t => !seenIds.includes(t.id));
          if (!hasUnseen) return; // every currently-open task has already been popped today
          setTaskPopupTasks(mine);
          try { localStorage.setItem(`task_popup_seen_${empId}_${today}`, JSON.stringify(mine.map(t => t.id))); } catch {}
          // Badge: everything in the popup is now seen
          try { localStorage.setItem(`seen_tasks_${empId}`, JSON.stringify(mine.map(t => t.id))); } catch {}
          setUnseenCount(0);
          mine.forEach(t => fetch(`/api/tasks/${t.id}/view`, { method: "POST" }).catch(() => {}));
        })
        .catch(() => { /* network hiccup — the next poll tries again */ });
    }

    taskPopupTimerRef.current = setTimeout(checkForNewTasks, 2000);
    const pollId = setInterval(checkForNewTasks, 60000);

    return () => {
      if (taskPopupTimerRef.current) { clearTimeout(taskPopupTimerRef.current); taskPopupTimerRef.current = null; }
      clearInterval(pollId);
    };
  }, [checkInPhase, empId, today]);

  async function handlePopupTaskFinish(taskId: number) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    }).catch(() => null);
    if (!res || !res.ok) { alert("העדכון נכשל — נסה שוב"); return; }
    // Same reward as finishing the daily checklist
    setShowEndConfetti(true);
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    confettiTimerRef.current = setTimeout(() => {
      setShowEndConfetti(false);
      confettiTimerRef.current = null;
    }, 2400);
    setTaskPopupTasks(prev => {
      const next = prev?.filter(t => t.id !== taskId) ?? [];
      return next.length ? next : null; // last task finished → close the popup
    });
  }

  // Find the most recent OPEN record (no checkOutTime) for today.
  // Using find() on the full array returned the first record by insertion order,
  // which could be an already-clocked-out record — causing isClockedIn=false
  // even when open records exist and letting the employee create duplicates.
  const todayAttendance = attendance
    .filter(a => a.date === today && !a.checkOutTime)
    .sort((a, b) => b.id - a.id)[0] ?? null;
  const isClockedIn = !!todayAttendance;
  const breakElapsed = useBreakElapsed(activeBreak?.breakStart ?? null);
  const isPartTime = session?.user?.employeeType === "PART_TIME";
  const name = session?.user?.name ?? "";
  const gender = session?.user?.gender ?? "M";

  // Dashboard shows employees only — managers excluded from side panel, stats, and not-scheduled
  const nonManagerEmployees = useMemo(
    () => allEmployees.filter(e => e.role !== "MANAGER"),
    [allEmployees]
  );
  // Filter by the shift's embedded employee role — NOT by membership in the
  // active roster — so archived employees' historic shifts stay visible.
  const nonManagerShifts = useMemo(
    () => allShifts.filter(s => s.employee?.role !== "MANAGER"),
    [allShifts]
  );

  // "רק שלי" is only meaningful when the employee has their own shifts this week
  const hasMyShifts = useMemo(
    () => nonManagerShifts.some(s => s.employeeId === empId),
    [nonManagerShifts, empId]
  );

  const displayShifts = useMemo(() => {
    // Always show all non-manager shifts if the employee has none of their own
    if (filterMine && hasMyShifts) {
      return nonManagerShifts.filter(s => s.employeeId === empId);
    }
    return nonManagerShifts;
  }, [nonManagerShifts, filterMine, hasMyShifts, empId]);

  // Clock-in: starts clock immediately, then transitions to checklist
  // Bug 5: ref lock prevents duplicate attendance records from rapid double-taps
  async function handleClockIn() {
    if (!empId || clockingIn.current) return;
    clockingIn.current = true;
    try {
      const rec = await fetch("/api/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId, date: today, weekKey }),
      }).then(r => r.json());
      setAttendance(prev => [...prev, rec]);
      // Always run checklist first; campus (if enabled) follows via handleChecklistComplete
      setCheckInPhase("checklist");
    } finally {
      clockingIn.current = false;
    }
  }

  // Re-clock-in after clock-out: no checklist/campus chain (flow already done today)
  async function handleDirectClockIn() {
    if (!empId || clockingIn.current) return; // same double-tap lock as handleClockIn
    clockingIn.current = true;
    try {
      const rec = await fetch("/api/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId, date: today, weekKey }),
      }).then(r => r.json());
      setAttendance(prev => [...prev, rec]);
    } finally {
      clockingIn.current = false;
    }
  }

  async function handleStartBreak(expectedEnd?: string | null) {
    if (!todayAttendance || activeBreak) return;
    const rec = await fetch(`/api/attendance/${todayAttendance.id}/break`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expectedEnd ? { expectedEnd } : {}),
    }).then(r => r.json());
    setActiveBreak(rec);
    setAttendance(prev => prev.map(a =>
      a.id === todayAttendance.id ? { ...a, breaks: [...(a.breaks ?? []), rec] } : a
    ));
  }

  function handleBreakModalConfirm(expectedEnd: string | null) {
    setShowBreakModal(false);
    handleStartBreak(expectedEnd);
  }

  async function handleEndBreak() {
    if (!todayAttendance || !activeBreak) return;
    const breakEnd = new Date().toISOString();
    await fetch(`/api/attendance/${todayAttendance.id}/break/${activeBreak.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakEnd }),
    });
    setAttendance(prev => prev.map(a =>
      a.id === todayAttendance.id
        ? { ...a, breaks: a.breaks.map(b => b.id === activeBreak!.id ? { ...b, breakEnd } : b) }
        : a
    ));
    setActiveBreak(null);
  }

  function handleChecklistComplete() {
    if (campusSettings?.enabled) {
      setCheckInPhase("campus");
    } else {
      // Campus disabled — this is the end of the chain; reward with confetti
      setCheckInPhase("done");
      setShowEndConfetti(true);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => {
        setShowEndConfetti(false);
        confettiTimerRef.current = null;
      }, 2400);
    }
  }

  function handleCampusClose() {
    setCheckInPhase("done");
  }

  async function handleClockInButtonClick() {
    if (checkInPhase === "done") {
      await handleDirectClockIn();
    } else {
      setCheckInPhase("clock-in");
    }
    // loading / checklist / campus: button is disabled — no-op via button's disabled prop
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}>
        <div className="text-gray-400 text-sm animate-pulse">טוען...</div>
      </div>
    );
  }

  return (
    <>
      {/* End-of-checklist confetti — also reused when a popup task is finished.
          z-[70] so it shows above the task popup (z-[60]), not behind it. */}
      {showEndConfetti && END_CONFETTI.map((c, i) => (
        <span key={i} className="fixed pointer-events-none rounded-sm z-[70]" style={{
          width: c.size, height: c.size, left: `${c.x}%`, bottom: "0%",
          background: c.color,
          animation: `confetti-fly 2.2s ${c.delay}s ease-out forwards`,
        }} />
      ))}

      {/* Entry flow — phase-driven, mutually exclusive */}
      {checkInPhase === "checklist" && (
        <DailyChecklist name={name} gender={gender} onComplete={handleChecklistComplete} />
      )}
      {checkInPhase === "campus" && campusSettings && (
        <CampusModal
          questionsPerSession={campusSettings.questionsPerSession}
          employeeId={empId ?? 0}
          onClose={handleCampusClose}
        />
      )}

      <div className="min-h-screen p-6 relative overflow-hidden" dir="rtl"
        style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}>
        {/* Orbs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
          <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-5xl mx-auto bg-white rounded-3xl p-6 relative overflow-hidden"
          style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>
          <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lilly-logo.png" alt="Lilly" className="h-11 w-11 rounded-md object-contain"
                onError={e => (e.currentTarget.style.display = "none")} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">שלום, {name}</h1>
                <p className="text-sm text-gray-400 mt-0.5">{today.split("-").reverse().join("/")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isClockedIn ? (
                // "הפסקה" (start break) and "יציאה" (clock out) buttons removed
                // per request — break time is managed entirely via the break
                // picker below (BreakBar); the shift ends via auto-checkout.
                // Kept as a safety net: if an old-style break was already
                // active before this change, still let her end it.
                activeBreak ? (
                  <button onClick={handleEndBreak}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                    style={{ background: "#D97706" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#B45309")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#D97706")}>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    ▶ חזרה למשמרת {breakElapsed && <span className="text-xs opacity-80 font-normal">{breakElapsed}</span>}
                  </button>
                ) : null
              ) : (
                // Disabled + dimmed while phase="loading" — clicking would be a silent
                // no-op (Bug 6 fix), so we surface the loading state instead of hiding it
                <button
                  onClick={handleClockInButtonClick}
                  disabled={checkInPhase === "loading"}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                    checkInPhase === "loading"
                      ? "bg-emerald-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}>
                  {checkInPhase === "loading"
                    ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : "▶"}
                  {checkInPhase === "loading" ? "טוען..." : "כניסה"}
                </button>
              )}
              <EmployeeMenu
                onHours={() => setPanel("hours")}
                onTasks={() => setPanel("tasks")}
                onVacation={() => setPanel("vacation")}
                onAvailability={() => setPanel("availability")}
                onLeaflet={() => setPanel("leaflet")}
                isPartTime={isPartTime}
                unseenCount={unseenCount}
                unseenTimeOffCount={unseenTimeOffCount}
              />
            </div>
          </div>

          {/* Today's breaks — replaces the old LIVE presence strip. Clock-in /
              break / clock-out live in the header buttons above. */}
          {empId && <BreakBar refreshKey={checkInPhase} />}

          {/* Weekly grid */}
          <div className="relative">
            {showSkeleton && (
              <div className="absolute inset-0 z-10"
                style={{ opacity: fadeReady ? 0 : 1, transition: "opacity 350ms cubic-bezier(0.4,0,0.2,1)", pointerEvents: fadeReady ? "none" : "auto" }}>
                <WeekSkeleton />
              </div>
            )}
            <div style={{ opacity: fadeReady ? 1 : 0, transition: "opacity 350ms cubic-bezier(0.4,0,0.2,1)", minHeight: showSkeleton ? 670 : undefined }}>
              {!loading && (
                <ScheduleDashboard
                  shifts={nonManagerShifts}
                  displayShifts={displayShifts}
                  employees={nonManagerEmployees}
                  selectedEmployeeId={selectedEmployeeId}
                  onEmployeeSelect={handleEmployeeSelect}
                  filterJustCleared={filterJustCleared}
                  onPrevWeek={() => setWeekStart(w => addWeeks(w, -1))}
                  onNextWeek={() => setWeekStart(w => addWeeks(w, 1))}
                  weekStart={weekStart}
                />
              )}
            </div>
          </div>

          {/* Week nav + filter toggle */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setWeekStart(w => addWeeks(w, -1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">{formatWeekRange(weekStart)}</span>
              {hasMyShifts && (
                <button onClick={() => setFilterMine(v => !v)}
                  className="px-3 py-1 text-xs rounded-full font-semibold border transition-all"
                  style={{ background: filterMine ? "#D7252F" : "#fff", color: filterMine ? "#fff" : "#6B7280", borderColor: filterMine ? "#D7252F" : "#E5E7EB" }}>
                  {filterMine ? "✓ רק שלי" : "כולם"}
                </button>
              )}
            </div>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        {/* Panels */}
        {panel === "hours" && empId && <HoursReport employeeId={empId} employeeName={name} onClose={() => setPanel(null)} />}
        {panel === "tasks" && empId && (
          <EmployeeKanban
            employeeId={empId}
            employeeName={name}
            weekStart={weekStart}
            onClose={() => setPanel(null)}
            onUnseenChange={setUnseenCount}
          />
        )}
        {panel === "vacation" && empId && (
          <VacationPanel
            employeeId={empId}
            employeeName={name}
            onClose={() => setPanel(null)}
            onBadgeClear={() => setUnseenTimeOffCount(0)}
          />
        )}
        {panel === "availability" && empId && isPartTime && <AvailabilityPanel employeeId={empId} onClose={() => setPanel(null)} />}
        {panel === "leaflet" && empId && <MounjaroLeafletPanel employeeId={empId} onClose={() => setPanel(null)} />}

        {checkInPhase === "clock-in" && (
          <CheckInModal
            name={name}
            gender={gender}
            onConfirm={handleClockIn}
            onDismiss={() => {
              // No clock-in: skip checklist, but still run campus if enabled
              if (campusSettings?.enabled) {
                setCheckInPhase("campus");
              } else {
                setCheckInPhase("done");
              }
            }}
          />
        )}
      </div>

      {showBreakModal && (
        <BreakReturnModal
          onConfirm={handleBreakModalConfirm}
          onCancel={() => setShowBreakModal(false)}
        />
      )}

      {/* Daily task pop-up — fires once per day after the check-in flow */}
      {taskPopupTasks && taskPopupTasks.length > 0 && (
        <TaskPopup
          tasks={taskPopupTasks}
          onGotIt={() => setTaskPopupTasks(null)}
          onFinish={handlePopupTaskFinish}
        />
      )}
    </>
  );
}
