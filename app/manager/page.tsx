"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import React from "react";
import { signOut, useSession } from "next-auth/react";
import MounjaroLeafletPanel from "@/components/MounjaroLeafletPanel";
import { Employee, Shift, DEFAULT_COLORS, SLOTS, DAYS_HE, getWeekStart, weekKeyFromDate, addWeeks } from "@/types";
import WeeklyGrid from "@/components/WeeklyGrid";
import EmployeeManager from "@/components/EmployeeManager";
import ScheduleDashboard from "@/components/ScheduleDashboard";
import KanbanBoard from "@/components/KanbanBoard";
import HoursPanel from "@/components/HoursPanel";
import TimeOffRequestsBar from "@/components/TimeOffRequestsBar";
import ConflictWarning from "@/components/ConflictWarning";
import { buildExportCanvas } from "@/lib/exportCanvas";
import { useTrafficLightThresholds } from "@/lib/useTrafficLight";
import { checkConflict, shiftDate, type ApprovedLeave, type PtSlot, type ConflictReason } from "@/lib/conflictCheck";
import CampusDashboard from "@/components/CampusDashboard";
import AttendanceControlPanel from "@/components/AttendanceControlPanel";
import NotificationBell, { type NotificationItem } from "@/components/NotificationBell";
import BreakBar from "@/components/BreakBar";
import type { DayOffEntry } from "@/components/WeeklyGrid";

// Bottom edge of the edit grid — a shift may not extend past the last slot
const GRID_END_HOUR = SLOTS[SLOTS.length - 1] + 0.5;

// Default working day auto-filled for full-time employees in an empty week
const FULL_TIME_DEFAULT_START = 8;
const FULL_TIME_DEFAULT_HOURS = 8; // 8:00–16:00

// "YYYY-MM-DD" week key → local-midnight Date of that Sunday
function weekStartFromKey(wk: string): Date {
  const [y, m, d] = wk.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface ApprovedLeaveRecord {
  id: number; employeeId: number; date: string; toDate: string | null; type: string;
  employee: { id: number; name: string; color: string };
}

// ── Header dropdown menu ───────────────────────────────────────────────────────
function HeaderMenu({ viewMode, setViewMode, onHours, onTasks, onCampus, onLoachBakara, onLeaflet }: {
  viewMode: "edit" | "display";
  setViewMode: (m: "edit" | "display") => void;
  onHours: () => void;
  onTasks: () => void;
  onCampus: () => void;
  onLoachBakara: () => void;
  onLeaflet: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isEditing = viewMode === "edit";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, tint: string, accent: string, trailing?: React.ReactNode) => (
    <button onClick={() => { onClick(); setOpen(false); }}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-gray-800 hover:bg-gray-50 transition-colors text-right" dir="rtl">
      <span className="grid place-items-center rounded-md shrink-0" style={{ width: 26, height: 26, background: tint, color: accent }}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium rounded-lg border transition-colors ${open ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
        style={{ height: 36 }} aria-haspopup="menu" aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
        <span>תפריט</span>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div role="menu" dir="rtl" className="absolute z-30 mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{ left: 0, minWidth: 220, boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08)" }}>
          <div className="py-1.5">
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
              "עלון מוּנגָ׳רוֹ", onLeaflet, "#EFF6FF", "#1E40AF"
            )}
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
              "שעות", onHours, "#E3F4E5", "#16A34A"
            )}
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10M7 8h4M7 16h6"/></svg>,
              "לוח בקרה", onLoachBakara, "#FEF3C7", "#92400E"
            )}
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>,
              "משימות", onTasks, "#F0EBFF", "#7C3AED"
            )}
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
              "לימוד קמפוס", onCampus, "#EEF2FF", "#4F46E5"
            )}
            <div className="my-1 h-px bg-gray-100" />
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
              "מצב עריכה",
              () => setViewMode(isEditing ? "display" : "edit"),
              isEditing ? "#FEF3C7" : "#F1F5F9",
              isEditing ? "#92400E" : "#475569",
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: isEditing ? "#FEF3C7" : "#F1F5F9", color: isEditing ? "#92400E" : "#94A3B8" }}>
                {isEditing ? "פעיל" : "כבוי"}
              </span>
            )}
            <div className="my-1 h-px bg-gray-100" />
            {item(
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
              "התנתק",
              () => signOut({ callbackUrl: "/login" }),
              "#FEF2F2", "#DC2626"
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader matching the display grid shape ────────────────────────────
function WeekSkeleton() {
  const DAYS = 5;
  const ROWS = 8;
  const ROW_H = 78;
  const GAP = 6;
  return (
    <div dir="rtl" className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Day header row */}
        <div className="grid mb-[6px]" style={{ gridTemplateColumns: "56px repeat(5, 1fr)", gap: GAP }}>
          <div />
          {Array.from({ length: DAYS }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
        {/* Grid */}
        <div className="grid" style={{
          gridTemplateColumns: "56px repeat(5, 1fr)",
          gridTemplateRows: `repeat(${ROWS}, ${ROW_H}px)`,
          gap: GAP,
        }}>
          {/* Time gutter */}
          {Array.from({ length: ROWS }).map((_, i) => (
            <div key={`t${i}`} className="flex items-start justify-center">
              <div className="w-8 h-3 mt-0 rounded bg-gray-100 animate-pulse" style={{ transform: "translateY(-7px)" }} />
            </div>
          ))}
          {/* Cells */}
          {Array.from({ length: DAYS }).map((_, col) =>
            Array.from({ length: ROWS }).map((_, row) => (
              <div key={`${col}-${row}`}
                className="rounded-lg bg-gray-100 animate-pulse"
                style={{ gridColumn: col + 2, gridRow: row + 1, animationDelay: `${(col + row) * 40}ms` }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [savedShifts, setSavedShifts] = useState<Shift[]>([]);
  const [draggingEmployee, setDraggingEmployee] = useState<Employee | null>(null);
  const [copiedShiftId, setCopiedShiftId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "display">("display");
  // Manual override for the weekly table's visual style — persisted per
  // browser since it's a display preference, not shared schedule data.
  const [tableStyle, setTableStyle] = useState<"new" | "old">("new");
  useEffect(() => {
    const saved = localStorage.getItem("tableStyle");
    if (saved === "old" || saved === "new") setTableStyle(saved);
  }, []);
  const toggleTableStyle = useCallback(() => {
    setTableStyle(prev => {
      const next = prev === "new" ? "old" : "new";
      localStorage.setItem("tableStyle", next);
      return next;
    });
  }, []);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const trafficLightThresholds = useTrafficLightThresholds();
  const [isSaving, setIsSaving] = useState(false);
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [loachBakaraOpen, setLoachBakaraOpen] = useState(false);
  const [loachBakaraFocusId, setLoachBakaraFocusId] = useState<number | null>(null);
  const [leafletOpen, setLeafletOpen] = useState(false);
  const { data: session } = useSession();
  const managerEmpId = session?.user?.employeeId;
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [approvedLeave, setApprovedLeave] = useState<ApprovedLeave[]>([]);
  // Same approved-leave records, untrimmed — the edit grid's day-off row needs
  // name/color/type, not just the date range used by checkConflict.
  const [approvedLeaveFull, setApprovedLeaveFull] = useState<ApprovedLeaveRecord[]>([]);
  const [ptSlots, setPtSlots] = useState<PtSlot[]>([]);
  // Manager notes — one per weekday for the current week (item: הערות מנהל)
  const [dayNotes, setDayNotes] = useState<Record<number, string>>({});
  // Informational banner after auto-filling a full-time default schedule
  const [defaultScheduleBanner, setDefaultScheduleBanner] = useState<string | null>(null);
  // Weeks already auto-filled this session — guards StrictMode double-invoke
  const seededDefaultWeeks = useRef(new Set<string>());
  const [pendingConflict, setPendingConflict] = useState<{
    shift: Shift; reason: ConflictReason; employeeName: string;
    // Set for resize conflicts: the change was already applied live during the
    // drag, so cancel restores these original values instead of discarding.
    revert?: { startHour: number; durationHours: number };
    // Set for copy-prev-week conflicts: the shift carries last week's real DB
    // id, so it must NOT go through the generic add/move branches below —
    // confirm/cancel just resolve the awaiting copy loop.
    resolve?: (keep: boolean) => void;
  } | null>(null);
  // Per-item notification feed — polled on its own cadence, independent of week data
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const refreshNotifications = useCallback(() => {
    fetch("/api/notifications/manager")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.notifications) setNotifications(d.notifications); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshNotifications();
    const t = setInterval(refreshNotifications, 60000);
    return () => clearInterval(t);
  }, [refreshNotifications]);
  async function handleMarkNotificationRead(id: number) {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }
  async function handleClearNotificationHistory() {
    setNotifications([]);
    await fetch("/api/notifications/manager", { method: "DELETE" }).catch(() => {});
  }
  const [fadeReady, setFadeReady] = useState(false);
  // Success toast after copy-prev-week — a silent success looks like a bug
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyToastTimer.current) clearTimeout(copyToastTimer.current); }, []);
  const showCopyToast = useCallback((msg: string) => {
    setCopyToast(msg);
    if (copyToastTimer.current) clearTimeout(copyToastTimer.current);
    copyToastTimer.current = setTimeout(() => setCopyToast(null), 4500);
  }, []);

  const currentWeekKey = weekKeyFromDate(weekStart);
  const seeded = useRef(false);
  const tempId = useRef(-1); // negative ids = not yet saved to DB
  // Refinement 3: AbortController ref — cancels stale fetches on rapid week-switching
  const fetchAbortRef = useRef<AbortController | null>(null);

  const isDirty = JSON.stringify(shifts.map(s => ({...s, employee: undefined}))) !==
                  JSON.stringify(savedShifts.map(s => ({...s, employee: undefined})));

  // Dashboard shows employees only — managers excluded from side panel, stats, and not-scheduled.
  // Memoized so derived sets don't recompute on every render (e.g., modal keystrokes).
  const nonManagerEmployees = useMemo(
    () => employees.filter(e => e.role !== "MANAGER"),
    [employees],
  );
  // Filter by the shift's embedded employee role — NOT by membership in the
  // active roster — so archived employees' historic shifts stay visible.
  const nonManagerShifts = useMemo(
    () => shifts.filter(s => s.employee?.role !== "MANAGER"),
    [shifts],
  );

  // Approved day-offs bucketed by weekday for the edit grid's bottom row
  const dayOffByDay = useMemo(() => {
    const map: Record<number, DayOffEntry[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (let day = 0; day < 5; day++) {
      const dateStr = shiftDate(weekStart, day);
      for (const r of approvedLeaveFull) {
        if (r.date <= dateStr && dateStr <= (r.toDate ?? r.date)) {
          map[day].push({ employeeId: r.employeeId, name: r.employee.name, color: r.employee.color, type: r.type });
        }
      }
    }
    return map;
  }, [approvedLeaveFull, weekStart]);

  // Manager day-note: persist immediately on blur (independent of shift Save/Discard)
  async function handleDayNoteSave(dayOfWeek: number, text: string) {
    setDayNotes(prev => ({ ...prev, [dayOfWeek]: text }));
    const res = await fetch("/api/day-notes", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekKey: currentWeekKey, dayOfWeek, text }),
    }).catch(() => null);
    if (!res || !res.ok) alert("שמירת ההערה נכשלה — נסה שוב");
  }

  const fetchAll = useCallback(async (wk: string) => {
    // Refinement 3: abort any in-flight fetch from a previous week navigation
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    try {
      const [schedRes, leaveRes, slotsRes, notesRes] = await Promise.all([
        fetch(`/api/schedule?weekKey=${wk}`, { signal }),
        fetch("/api/time-off?status=APPROVED", { signal }),
        fetch("/api/availability", { signal }),
        fetch(`/api/day-notes?weekKey=${wk}`, { signal }),
      ]);
      const { employees: emps, shifts: sh } = await schedRes.json();
      const leave: ApprovedLeaveRecord[] = await leaveRes.json();
      const slots = await slotsRes.json();
      const notes: { dayOfWeek: number; text: string }[] = notesRes.ok ? await notesRes.json() : [];
      const leaveTrimmed: ApprovedLeave[] = leave.map((r) => ({ employeeId: r.employeeId, date: r.date, toDate: r.toDate ?? null }));
      setEmployees(emps);
      setShifts(sh);
      setSavedShifts(sh);
      setApprovedLeave(leaveTrimmed);
      setApprovedLeaveFull(leave);
      setPtSlots(slots.map((s: { employeeId: number; dayOfWeek: number; startHour: number; endHour: number; available: boolean }) => ({ employeeId: s.employeeId, dayOfWeek: s.dayOfWeek, startHour: s.startHour, endHour: s.endHour, available: s.available })));
      setDayNotes(Object.fromEntries(notes.map((n) => [n.dayOfWeek, n.text])));
      setLoading(false);

      // Auto-seed demo employees if the DB is empty
      let roster: Employee[] = emps;
      if (!seeded.current && emps.length === 0) {
        seeded.current = true;
        const defaults = [
          { name: "עובד 1", color: DEFAULT_COLORS[0] },
          { name: "עובד 2", color: DEFAULT_COLORS[1] },
          { name: "עובד 3", color: DEFAULT_COLORS[2] },
        ];
        await Promise.all(
          defaults.map((d) =>
            fetch("/api/employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            })
          )
        );
        const empRes2 = await fetch("/api/employees");
        roster = await empRes2.json();
        setEmployees(roster);
      }

      // Full-time default schedule: the first time a current/future week with
      // no shifts at all is opened, pre-fill Sun–Thu 8:00–16:00 for every
      // full-time employee (skipping approved days off). The manager can then
      // edit freely — these are ordinary saved shifts, nothing is locked.
      const isPastWeek = wk < weekKeyFromDate(new Date());
      if (sh.length === 0 && !isPastWeek && !seededDefaultWeeks.current.has(wk)) {
        seededDefaultWeeks.current.add(wk);
        const fullTimers = roster.filter((e) => e.employeeType === "FULL_TIME" && e.role !== "MANAGER" && !e.archived);
        const wkStart = weekStartFromKey(wk);
        const toCreate: { employeeId: number; dayOfWeek: number }[] = [];
        const skipped: string[] = [];
        for (const e of fullTimers) {
          for (let day = 0; day < 5; day++) {
            const dateStr = shiftDate(wkStart, day);
            const reason = checkConflict(e.id, day, FULL_TIME_DEFAULT_START, FULL_TIME_DEFAULT_HOURS, dateStr, leaveTrimmed, []);
            if (reason === "time-off") { skipped.push(`${e.name} (${DAYS_HE[day]})`); continue; }
            toCreate.push({ employeeId: e.id, dayOfWeek: day });
          }
        }
        if (toCreate.length > 0) {
          await Promise.all(toCreate.map((c) =>
            fetch("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ employeeId: c.employeeId, dayOfWeek: c.dayOfWeek, startHour: FULL_TIME_DEFAULT_START, durationHours: FULL_TIME_DEFAULT_HOURS, weekKey: wk }) })
          ));
          const fresh: Shift[] = await (await fetch(`/api/shifts?weekKey=${wk}`)).json();
          setShifts(fresh);
          setSavedShifts(fresh);
          // Once dismissed for this week, stay dismissed across remounts/navigation —
          // only a genuinely new week (fresh auto-fill) shows it again.
          let dismissed = false;
          try { dismissed = localStorage.getItem(`default_schedule_banner_dismissed_${wk}`) === "1"; } catch {}
          if (dismissed) return;
          setDefaultScheduleBanner(
            `נוצר סידור ברירת מחדל (א׳–ה׳ 8:00–16:00) ל-${fullTimers.length} עובדים במשרה מלאה` +
            (skipped.length ? ` · דולגו ${skipped.length} ימים עקב חופש מאושר: ${skipped.join(", ")}` : "")
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return; // stale — discard silently
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(currentWeekKey);
    setCopiedShiftId(null);
    setViewMode("display");
  }, [fetchAll, currentWeekKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCopiedShiftId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cross-fade: when loading finishes, fade in real data then unmount skeleton
  useEffect(() => {
    if (loading) {
      setShowSkeleton(true);
      setFadeReady(false);
      return;
    }
    // Next frame: trigger CSS transition
    const raf = requestAnimationFrame(() => setFadeReady(true));
    // After transition completes: unmount skeleton
    const timer = setTimeout(() => setShowSkeleton(false), 380);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [loading]);

  // Abort any in-flight fetch when the manager page unmounts
  useEffect(() => () => { fetchAbortRef.current?.abort(); }, []);

  // Warn before closing/reloading the tab with unsaved schedule edits
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Week navigation replaces `shifts` from the server — confirm first if that
  // would discard unsaved edits.
  function navigateWeek(n: number) {
    if (isDirty && !window.confirm("יש שינויים שלא נשמרו. לעבור שבוע ולבטל אותם?")) return;
    setWeekStart(w => addWeeks(w, n));
  }

  async function handleAddEmployee(data: { name: string; color: string; gender?: string; dateOfBirth?: string; employeeType?: string; phone4?: string; password?: string }) {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const emp = await res.json();
    setEmployees((prev) => [...prev, emp]);
  }

  async function handleRenameEmployee(id: number, name: string) {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const updated = await res.json();
    setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
    setShifts((prev) =>
      prev.map((s) =>
        s.employeeId === id ? { ...s, employee: updated } : s
      )
    );
  }

  // "Delete" archives the employee server-side (history preserved, login blocked)
  async function handleDeleteEmployee(id: number) {
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error ?? "הפעולה נכשלה");
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setShifts((prev) => prev.filter((s) => s.employeeId !== id));
    setSavedShifts((prev) => prev.filter((s) => s.employeeId !== id));
  }

  function handleRestoreEmployee(emp: Employee) {
    setEmployees((prev) => [...prev, emp].sort((a, b) => a.id - b.id));
  }

  async function handleUpdateEmployee(id: number, data: Record<string, string>) {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error ?? "העדכון נכשל");
      return;
    }
    const updated = await res.json();
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
  }

  function handleDrop(dayOfWeek: number, startHour: number) {
    if (!draggingEmployee) return;
    const exists = shifts.some(
      (s) => s.employeeId === draggingEmployee.id && s.dayOfWeek === dayOfWeek && s.startHour === startHour
    );
    if (exists) return;

    const newShift: Shift = {
      id: tempId.current--,
      employeeId: draggingEmployee.id,
      employee: draggingEmployee,
      dayOfWeek, startHour, durationHours: 1,
      weekKey: currentWeekKey,
    };

    const dateStr = shiftDate(weekStart, dayOfWeek);
    const reason = checkConflict(draggingEmployee.id, dayOfWeek, startHour, 1, dateStr, approvedLeave, ptSlots);
    if (reason) {
      setPendingConflict({ shift: newShift, reason, employeeName: draggingEmployee.name });
      setDraggingEmployee(null);
      return;
    }
    setShifts((prev) => [...prev, newShift]);
    setDraggingEmployee(null);
  }

  function handleShiftSelect(id: number) {
    setCopiedShiftId((prev) => (prev === id ? null : id));
  }

  function handleCellClick(dayOfWeek: number, startHour: number) {
    if (copiedShiftId === null) return;
    const source = shifts.find((s) => s.id === copiedShiftId);
    if (!source) return;
    const exists = shifts.some(
      (s) => s.employeeId === source.employeeId && s.dayOfWeek === dayOfWeek && s.startHour === startHour
    );
    if (exists) return;
    const newShift: Shift = {
      id: tempId.current--,
      employeeId: source.employeeId,
      employee: source.employee,
      dayOfWeek,
      startHour,
      durationHours: source.durationHours,
      weekKey: currentWeekKey,
    };
    const dateStr = shiftDate(weekStart, dayOfWeek);
    const reason = checkConflict(source.employeeId, dayOfWeek, startHour, source.durationHours, dateStr, approvedLeave, ptSlots);
    if (reason) {
      setPendingConflict({ shift: newShift, reason, employeeName: source.employee.name });
      return;
    }
    setShifts((prev) => [...prev, newShift]);
  }

  function handleShiftDelete(id: number) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function handleShiftResize(id: number, durationHours: number) {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, durationHours } : s)));
  }

  function handleShiftResizeTop(id: number, startHour: number, durationHours: number) {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, startHour, durationHours } : s)));
  }

  // Called on mouseup after a resize drag — the resize was applied live, so a
  // conflict here offers to revert to the pre-drag values. Original and final
  // values come from ShiftBlock because this closure may be stale by mouseup.
  function handleShiftResizeEnd(
    id: number,
    orig: { startHour: number; durationHours: number },
    final: { startHour: number; durationHours: number },
  ) {
    const shift = shifts.find(s => s.id === id);
    if (!shift) return;
    if (final.startHour === orig.startHour && final.durationHours === orig.durationHours) return;
    const dateStr = shiftDate(weekStart, shift.dayOfWeek);
    const reason = checkConflict(shift.employeeId, shift.dayOfWeek, final.startHour, final.durationHours, dateStr, approvedLeave, ptSlots);
    if (reason) {
      setPendingConflict({
        shift: { ...shift, startHour: final.startHour, durationHours: final.durationHours },
        reason,
        employeeName: shift.employee.name,
        revert: { startHour: orig.startHour, durationHours: orig.durationHours },
      });
    }
  }

  function handleShiftMove(id: number, dayOfWeek: number, startHour: number) {
    const shift = shifts.find(s => s.id === id);
    if (!shift) return;
    // Don't stack an exact duplicate on the employee's existing shift
    const exists = shifts.some(
      (s) => s.id !== id && s.employeeId === shift.employeeId && s.dayOfWeek === dayOfWeek && s.startHour === startHour
    );
    if (exists) return;
    // Don't let the shift extend past the bottom of the grid
    if (startHour + shift.durationHours > GRID_END_HOUR) return;
    const dateStr = shiftDate(weekStart, dayOfWeek);
    const reason = checkConflict(shift.employeeId, dayOfWeek, startHour, shift.durationHours, dateStr, approvedLeave, ptSlots);
    if (reason) {
      const movedShift = { ...shift, dayOfWeek, startHour };
      setPendingConflict({ shift: movedShift, reason, employeeName: shift.employee.name });
      return;
    }
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, dayOfWeek, startHour } : s)));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const savedIds = new Set(savedShifts.map((s) => s.id));
      const currentIds = new Set(shifts.filter((s) => s.id > 0).map((s) => s.id));

      const toDelete = savedShifts.filter((s) => !currentIds.has(s.id));
      const toCreate = shifts.filter((s) => s.id < 0);
      const toUpdate = shifts.filter((s) => {
        if (s.id < 0 || !savedIds.has(s.id)) return false;
        const orig = savedShifts.find((o) => o.id === s.id)!;
        return orig.dayOfWeek !== s.dayOfWeek || orig.startHour !== s.startHour || orig.durationHours !== s.durationHours;
      });

      const responses = await Promise.all([
        ...toDelete.map((s) => fetch(`/api/shifts/${s.id}`, { method: "DELETE" })),
        ...toUpdate.map((s) =>
          fetch(`/api/shifts/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dayOfWeek: s.dayOfWeek, startHour: s.startHour, durationHours: s.durationHours }),
          })
        ),
        ...toCreate.map((s) =>
          fetch("/api/shifts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: s.employeeId, dayOfWeek: s.dayOfWeek, startHour: s.startHour, durationHours: s.durationHours, weekKey: currentWeekKey }),
          })
        ),
      ]);

      // Reload from DB to get real IDs for newly created shifts
      const res = await fetch(`/api/shifts?weekKey=${currentWeekKey}`);
      const fresh: Shift[] = await res.json();
      setShifts(fresh);
      setSavedShifts(fresh);
      setCopiedShiftId(null); // temp IDs are gone after reload — clear stale selection

      if (responses.some((r) => !r.ok)) {
        alert("חלק מהשינויים לא נשמרו. הלוח נטען מחדש מהשרת — בדוק ונסה שוב.");
      }
    } catch {
      alert("השמירה נכשלה. בדוק את החיבור ונסה שוב.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    setShifts(savedShifts);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const canvas = buildExportCanvas(shifts, trafficLightThresholds);
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "לוח-שבועי.png";
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("הייצוא נכשל: " + String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 relative overflow-hidden" dir="rtl"
      style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}>

      {/* Floating soft-red orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-3xl p-6 relative overflow-hidden"
        style={{
          border: "1px solid #F5D5D2",
          boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)",
        }}>

        {/* Lilly-red top accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          {/* Right: logo + title (first child in RTL = visual right) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lilly-logo.png"
              alt="Lilly"
              className="h-11 w-11 rounded-md object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">מוקד לילי</h1>
            </div>
          </div>

          {/* Left: notification bell + dropdown menu */}
          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onOpen={refreshNotifications}
              onClearHistory={handleClearNotificationHistory}
            />
            <HeaderMenu
              viewMode={viewMode}
              setViewMode={setViewMode}
              onHours={() => setHoursOpen(true)}
              onTasks={() => setKanbanOpen(true)}
              onCampus={() => setCampusOpen(true)}
              onLoachBakara={() => setLoachBakaraOpen(true)}
              onLeaflet={() => setLeafletOpen(true)}
            />
          </div>
        </div>

        {/* Full-time default-schedule notice (auto-fill on first open of an empty week) */}
        {defaultScheduleBanner && (
          <div dir="rtl" className="mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>
            <span className="text-base leading-none mt-0.5">ℹ️</span>
            <span className="flex-1 leading-snug">{defaultScheduleBanner}</span>
            <button
              onClick={() => {
                setDefaultScheduleBanner(null);
                try { localStorage.setItem(`default_schedule_banner_dismissed_${currentWeekKey}`, "1"); } catch {}
              }}
              aria-label="סגור"
              className="w-6 h-6 grid place-items-center rounded-full hover:bg-blue-100 text-blue-700 shrink-0">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        {viewMode === "display" ? (
          <>
            {/* Today's breaks — who picked which slot (read-only for the manager) */}
            <BreakBar />

            {/* Cross-fade container — skeleton fades out, real data fades in */}
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
                    displayShifts={nonManagerShifts}
                    employees={nonManagerEmployees}
                    selectedEmployeeId={selectedEmployeeId}
                    onEmployeeSelect={setSelectedEmployeeId}
                    onExport={handleExport}
                    exporting={exporting}
                    onPrevWeek={() => navigateWeek(-1)}
                    onNextWeek={() => navigateWeek(1)}
                    onSwitchToEdit={() => setViewMode("edit")}
                    tableStyle={tableStyle}
                    weekStart={weekStart}
                    onCopyPrevWeek={async () => {
                      try {
                        const prevKey = weekKeyFromDate(addWeeks(weekStart, -1));
                        const res = await fetch(`/api/schedule?weekKey=${prevKey}`);
                        if (!res.ok) { alert("טעינת השבוע הקודם נכשלה — נסה שוב"); return; }
                        const { shifts: prevShifts } = await res.json();
                        // Skip shifts of archived employees — they're no longer scheduled —
                        // and shifts that already exist in this week (double-click protection)
                        const activeIds = new Set(employees.map((e) => e.id));
                        const existing = new Set(shifts.map((s) => `${s.employeeId}|${s.dayOfWeek}|${s.startHour}`));
                        const toCopy = (prevShifts ?? []).filter((s: Shift) =>
                          activeIds.has(s.employeeId) && !existing.has(`${s.employeeId}|${s.dayOfWeek}|${s.startHour}`));
                        if (!toCopy.length) {
                          alert(!prevShifts?.length
                            ? "אין משמרות בשבוע הקודם להעתקה"
                            : prevShifts.some((s: Shift) => activeIds.has(s.employeeId))
                              ? "המשמרות מהשבוע הקודם כבר קיימות בשבוע הזה"
                              : "בשבוע הקודם יש משמרות רק לעובדים בארכיון — אין מה להעתיק");
                          return;
                        }
                        // Sequential: each day-off / unavailability conflict gets the same
                        // ConflictWarning modal as a manual drop, one at a time.
                        let copied = 0, skipped = 0, failed = 0;
                        for (const s of toCopy as Shift[]) {
                          const dateStr = shiftDate(weekStart, s.dayOfWeek);
                          const reason = checkConflict(s.employeeId, s.dayOfWeek, s.startHour, s.durationHours, dateStr, approvedLeave, ptSlots);
                          if (reason) {
                            const employeeName = employees.find((e) => e.id === s.employeeId)?.name ?? s.employee?.name ?? "";
                            const keep = await new Promise<boolean>((resolve) =>
                              setPendingConflict({ shift: s, reason, employeeName, resolve }));
                            if (!keep) { skipped++; continue; }
                          }
                          const r = await fetch("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ employeeId: s.employeeId, dayOfWeek: s.dayOfWeek, startHour: s.startHour, durationHours: s.durationHours, weekKey: currentWeekKey }) });
                          if (r.ok) copied++; else failed++;
                        }
                        if (failed > 0) alert("חלק מהמשמרות לא הועתקו — בדוק את הלוח");
                        await fetchAll(currentWeekKey);
                        showCopyToast(`✓ ${copied} משמרות הועתקו מהשבוע הקודם${skipped ? ` · ${skipped} דולגו` : ""}`);
                      } catch {
                        alert("ההעתקה נכשלה — בדוק את החיבור ונסה שוב");
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={toggleTableStyle}
                style={{
                  fontSize: 11, fontWeight: 500, color: "#6B7280",
                  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6,
                  padding: "4px 10px", cursor: "pointer",
                }}
              >
                {tableStyle === "old" ? "↩ עבור לתצוגה החדשה" : "↩ עבור לתצוגה הקודמת"}
              </button>
            </div>
            <WeeklyGrid
              shifts={shifts}
              weekStart={weekStart}
              draggingEmployee={draggingEmployee}
              copiedShiftId={copiedShiftId}
              onDrop={handleDrop}
              onCellClick={handleCellClick}
              onShiftSelect={handleShiftSelect}
              onShiftDelete={handleShiftDelete}
              onShiftResize={handleShiftResize}
              onShiftResizeTop={handleShiftResizeTop}
              onShiftResizeEnd={handleShiftResizeEnd}
              onShiftMove={handleShiftMove}
              dayNotes={dayNotes}
              onDayNoteSave={handleDayNoteSave}
              dayOffByDay={dayOffByDay}
            />
            <EmployeeManager
              employees={employees}
              onAdd={handleAddEmployee}
              onDelete={handleDeleteEmployee}
              onRename={handleRenameEmployee}
              onUpdate={handleUpdateEmployee}
              onRestore={handleRestoreEmployee}
              onDragStart={setDraggingEmployee}
            />

            {/* Time-off requests inline bar */}
            <TimeOffRequestsBar onDecision={refreshNotifications} />

            {/* Save / Discard bar */}
            <div className="mt-5 flex items-center gap-3 justify-end border-t border-gray-100 pt-4">
              {isDirty && (
                <span className="text-xs text-amber-600 ml-auto">יש שינויים שלא נשמרו</span>
              )}
              <button
                onClick={handleDiscard}
                disabled={!isDirty || isSaving}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              >
                בטל שינויים
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-30 transition-colors"
              >
                {isSaving ? "שומר..." : "שמור שינויים"}
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              גרור עובד לתוך משבצת זמן · גרור בלוק להזזה · משוך את הידית התחתונה לשינוי משך
            </p>
          </>
        )}
      </div>

      {/* Copy-prev-week success toast */}
      {copyToast && (
        <div dir="rtl" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-full text-[13px] font-semibold"
          style={{
            background: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC",
            boxShadow: "0 8px 24px -6px rgba(22,163,74,0.35), 0 2px 8px rgba(0,0,0,0.08)",
            animation: "copy-toast-in 0.25s ease-out",
          }}>
          {copyToast}
          <style>{`@keyframes copy-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
        </div>
      )}

      {/* Conflict warning modal */}
      {pendingConflict && (
        <ConflictWarning
          employeeName={pendingConflict.employeeName}
          reason={pendingConflict.reason}
          onConfirm={() => {
            if (pendingConflict.resolve) { pendingConflict.resolve(true); setPendingConflict(null); return; }
            const s = pendingConflict.shift;
            if (pendingConflict.revert) {
              // Resize — already applied live, keeping it means doing nothing
            } else if (s.id < 0) {
              // New drop / paste — add to list
              setShifts(prev => [...prev, s]);
            } else {
              // Move — update existing shift's position
              setShifts(prev => prev.map(x => x.id === s.id
                ? { ...x, dayOfWeek: s.dayOfWeek, startHour: s.startHour }
                : x));
            }
            setPendingConflict(null);
          }}
          onCancel={() => {
            if (pendingConflict.resolve) { pendingConflict.resolve(false); setPendingConflict(null); return; }
            const { shift: s, revert } = pendingConflict;
            if (revert) {
              // Resize — undo the live-applied change
              setShifts(prev => prev.map(x => x.id === s.id
                ? { ...x, startHour: revert.startHour, durationHours: revert.durationHours }
                : x));
            }
            setPendingConflict(null);
          }}
        />
      )}

      {/* Hours side panel */}
      {hoursOpen && (
        <HoursPanel
          employees={employees}
          shifts={shifts}
          weekStart={weekStart}
          onClose={() => setHoursOpen(false)}
        />
      )}

      {/* Kanban side panel */}
      {kanbanOpen && (
        <KanbanBoard
          employees={employees}
          weekStart={weekStart}
          onClose={() => setKanbanOpen(false)}
        />
      )}

      {/* Campus dashboard panel */}
      {campusOpen && <CampusDashboard onClose={() => setCampusOpen(false)} />}

      {/* לוח בקרה — attendance control panel */}
      {loachBakaraOpen && (
        <AttendanceControlPanel
          focusEmployeeId={loachBakaraFocusId}
          onClose={() => { setLoachBakaraOpen(false); setLoachBakaraFocusId(null); }}
        />
      )}

      {/* Mounjaro leaflet panel */}
      {leafletOpen && managerEmpId && (
        <MounjaroLeafletPanel
          employeeId={managerEmpId}
          onClose={() => setLeafletOpen(false)}
        />
      )}
    </div>
  );
}
