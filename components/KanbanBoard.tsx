"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Employee, formatWeekRange } from "@/types";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Status   = "TODO" | "IN_PROGRESS" | "DONE";

interface Task {
  id: number; title: string; description: string;
  dueDate: string; priority: Priority; status: Status; order: number;
  assigneeIds: string;
}

interface Props {
  employees: Employee[];
  weekStart: Date;
  onClose: () => void;
}

// ── Column config ──────────────────────────────────────────────────────────────
const COLUMNS: { status: Status; label: string; accent: string; bg: string; border: string }[] = [
  { status: "TODO",        label: "לביצוע", accent: "#3B82F6", bg: "#EFF6FF", border: "#DBEAFE" },
  { status: "IN_PROGRESS", label: "בביצוע", accent: "#7C3AED", bg: "#F5F3FF", border: "#E9D5FF" },
  { status: "DONE",        label: "הושלם",  accent: "#16A34A", bg: "#F0FDF4", border: "#DCFCE7" },
];

// ── Priority config ────────────────────────────────────────────────────────────
const PRI: Record<Priority, { label: string; bg: string; text: string; strip: string }> = {
  LOW:    { label: "נמוכה",   bg: "#F1F5F9", text: "#475569", strip: "#94A3B8" },
  MEDIUM: { label: "בינונית", bg: "#DBEAFE", text: "#1E40AF", strip: "#3B82F6" },
  HIGH:   { label: "גבוהה",   bg: "#FEE2E2", text: "#B91C1C", strip: "#EF4444" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const fmtDate = (iso: string) => { const [,m,d] = iso.split("-"); return `${d}/${m}`; };

// ── Stat chip ──────────────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: accent }}>{value}</span>
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onMove, onDragStart, isDragging, todayStr }: {
  task: Task; onEdit: () => void; onDelete: () => void;
  onMove: (s: Status) => void; onDragStart: (e: React.DragEvent) => void;
  isDragging: boolean; todayStr: string;
}) {
  const pri = PRI[task.priority];
  const isOverdue  = task.status !== "DONE" && !!task.dueDate && task.dueDate < todayStr;
  const isDueToday = task.status !== "DONE" && task.dueDate === todayStr;
  const isDone     = task.status === "DONE";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="relative bg-white rounded-lg border border-gray-200 p-2.5 pr-3 cursor-grab active:cursor-grabbing select-none group transition-opacity"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)", opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Priority strip */}
      <span aria-hidden className="absolute top-2 bottom-2 right-1 w-[3px] rounded-full" style={{ background: pri.strip }} />

      {/* Title + actions */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[13px] font-semibold text-gray-900 leading-snug"
            style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
          {task.title}
        </h3>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="w-6 h-6 grid place-items-center text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={onDelete} className="w-6 h-6 grid place-items-center text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[12px] text-gray-500 leading-snug mb-2 line-clamp-2" style={{ opacity: isDone ? 0.6 : 1 }}>
          {task.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: pri.bg, color: pri.text }}>
          {pri.label}
        </span>
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums"
            style={{
              background: isOverdue ? "#FEE2E2" : isDueToday ? "#FEF3C7" : "#F1F5F9",
              color:      isOverdue ? "#B91C1C" : isDueToday ? "#92400E" : "#475569",
            }}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="16" y1="2.5" x2="16" y2="6.5"/>
              <line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {fmtDate(task.dueDate)}
            {isOverdue  && <span> · באיחור</span>}
            {isDueToday && <span> · היום</span>}
          </span>
        )}
      </div>

      {/* Quick-move */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
        {task.status !== "TODO"        && <button onClick={() => onMove("TODO")}        className="hover:text-gray-700">→ לביצוע</button>}
        {task.status !== "IN_PROGRESS" && <button onClick={() => onMove("IN_PROGRESS")} className="hover:text-gray-700">→ בביצוע</button>}
        {task.status !== "DONE"        && <button onClick={() => onMove("DONE")}         className="hover:text-green-700">→ הושלם</button>}
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
const EMPTY_FORM = { title: "", description: "", dueDate: "", priority: "MEDIUM" as Priority, assigneeIds: "" };

function TaskModal({ editing, initialStatus, onSave, onDelete, onClose, employees }: {
  editing: Task | null; initialStatus: Status;
  onSave: (form: typeof EMPTY_FORM, status: Status) => Promise<void>;
  onDelete: () => void; onClose: () => void;
  employees: Employee[];
}) {
  const [form, setForm]       = useState(editing ? { title: editing.title, description: editing.description, dueDate: editing.dueDate, priority: editing.priority, assigneeIds: editing.assigneeIds ?? "" } : EMPTY_FORM);
  const [status, setStatus]   = useState<Status>(editing?.status ?? initialStatus);
  const [saving, setSaving]   = useState(false);
  const titleRef              = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50); }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" dir="rtl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{editing ? "עריכת משימה" : "משימה חדשה"}</h3>
        <form onSubmit={async e => { e.preventDefault(); if (!form.title.trim()) return; setSaving(true); await onSave(form, status); setSaving(false); }} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת *</label>
            <input ref={titleRef} type="text" required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="מה צריך לעשות?" />
          </div>
          {/* Assignee selector — shown first so it's always above the fold */}
          {employees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שיבוץ לעובד/ים
                {form.assigneeIds && (
                  <span className="mr-2 text-[11px] text-emerald-600 font-semibold">
                    ✓ {form.assigneeIds.split(",").filter(Boolean).length} נבחר/ו
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                {employees.filter(e => e.role !== "MANAGER").map(emp => {
                  const ids = form.assigneeIds ? form.assigneeIds.split(",").filter(Boolean) : [];
                  const selected = ids.includes(String(emp.id));
                  return (
                    <button key={emp.id} type="button"
                      onClick={() => {
                        const cur = form.assigneeIds ? form.assigneeIds.split(",").filter(Boolean) : [];
                        const next = selected ? cur.filter(x => x !== String(emp.id)) : [...cur, String(emp.id)];
                        setForm(f => ({ ...f, assigneeIds: next.join(",") }));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        background: selected ? emp.color : "#fff",
                        color: selected ? "#fff" : "#374151",
                        borderColor: selected ? emp.color : "#E5E7EB",
                        boxShadow: selected ? `0 0 0 2px ${emp.color}40` : "none",
                      }}>
                      {selected ? "✓" : "○"} {emp.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
            <textarea value={form.description} rows={3} placeholder="פרטים נוספים…"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך יעד</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="LOW">נמוכה</option><option value="MEDIUM">בינונית</option><option value="HIGH">גבוהה</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">עמודה</label>
            <select value={status} onChange={e => setStatus(e.target.value as Status)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving || !form.title.trim()}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? "שומר…" : editing ? "שמור שינויים" : "הוסף משימה"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">ביטול</button>
            {editing && (
              <button type="button" onClick={onDelete}
                className="mr-auto px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">מחק</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function KanbanBoard({ employees, weekStart, onClose }: Props) {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<{ editing: Task | null; status: Status } | null>(null);
  const [filterPri, setFilterPri] = useState<"all" | Priority>("all");
  const [draggingId, setDraggingId]     = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const [mirrorEmployeeId, setMirrorEmployeeId] = useState<number | null>(null);
  const todayStr = today();

  useEffect(() => {
    fetch("/api/tasks").then(r => r.json()).then((d: Task[]) => { setTasks(d); setLoading(false); });
  }, []);

  const mirrorEmployee = mirrorEmployeeId !== null
    ? employees.find(e => e.id === mirrorEmployeeId) ?? null
    : null;

  const visible = useMemo(() => {
    let result = tasks;
    if (mirrorEmployeeId !== null) {
      result = result.filter(t => t.assigneeIds?.split(",").filter(Boolean).includes(String(mirrorEmployeeId)));
    }
    if (filterPri !== "all") result = result.filter(t => t.priority === filterPri);
    return result;
  }, [tasks, filterPri, mirrorEmployeeId]);

  const stats = useMemo(() => ({
    open:     tasks.filter(t => t.status !== "DONE").length,
    dueToday: tasks.filter(t => t.status !== "DONE" && t.dueDate === todayStr).length,
    overdue:  tasks.filter(t => t.status !== "DONE" && !!t.dueDate && t.dueDate < todayStr).length,
  }), [tasks, todayStr]);

  async function handleSave(form: typeof EMPTY_FORM, status: Status) {
    if (modal?.editing) {
      const res = await fetch(`/api/tasks/${modal.editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      if (!res.ok) { alert("שמירה נכשלה — נסה שוב"); return; }
      const updated: Task = await res.json();
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status, order: tasks.filter(t => t.status === status).length }),
      });
      if (!res.ok) { alert("יצירת משימה נכשלה — נסה שוב"); return; }
      const created: Task = await res.json();
      setTasks(prev => [...prev, created]);
    }
    setModal(null);
  }

  async function handleDelete(task: Task) {
    if (!confirm(`למחוק את "${task.title}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setModal(null);
  }

  async function moveTask(task: Task, newStatus: Status) {
    if (task.status === newStatus) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    const updated: Task = await res.json();
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel — slides from LEFT */}
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{
          width: 880, maxWidth: "95vw",
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          background: "#FFFFFF",
          border: "1px solid #F5D5D2",
          boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)",
        }}>

        {/* Lilly-red accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none z-10"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Soft red orbs */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          {/* Right: title */}
          <div className="text-right">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-gray-900">לוח משימות</h2>
              {mirrorEmployee && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${mirrorEmployee.color}20`, color: mirrorEmployee.color, border: `1px solid ${mirrorEmployee.color}40` }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: mirrorEmployee.color }} />
                  מראה: {mirrorEmployee.name}
                  <button onClick={() => setMirrorEmployeeId(null)} className="opacity-60 hover:opacity-100 mr-0.5">✕</button>
                </span>
              )}
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
          </div>

          {/* Left: actions */}
          <div className="flex items-center gap-3">
            {!mirrorEmployee && (
              <button onClick={() => setModal({ editing: null, status: "TODO" })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg text-white transition-colors"
                style={{ background: "#D7252F" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
                onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                משימה חדשה
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-3 grid grid-cols-3 gap-3 border-b border-gray-100 shrink-0">
          <Stat label="פתוחות"  value={stats.open}     accent="#0f172a" />
          <Stat label="היום"    value={stats.dueToday} accent={stats.dueToday > 0 ? "#7C3AED" : "#94a3b8"} />
          <Stat label="באיחור" value={stats.overdue}  accent={stats.overdue  > 0 ? "#DC2626" : "#94a3b8"} />
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 flex items-center gap-3 flex-wrap border-b border-gray-100 shrink-0">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">סינון</span>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
            {([["all","הכל"], ["HIGH","גבוהה"], ["MEDIUM","בינונית"], ["LOW","נמוכה"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilterPri(id as "all" | Priority)}
                className={`px-2.5 py-1 text-[12px] rounded-md transition ${filterPri === id ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Employee mirror chips */}
          {employees.filter(e => e.role !== "MANAGER").length > 0 && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
              {employees.filter(e => e.role !== "MANAGER").map(emp => {
                const active = mirrorEmployeeId === emp.id;
                return (
                  <button key={emp.id}
                    onClick={() => setMirrorEmployeeId(active ? null : emp.id)}
                    title={active ? "חזור לתצוגה מלאה" : `מראה: ${emp.name}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-md transition-all font-medium"
                    style={{
                      background: active ? emp.color : "transparent",
                      color: active ? "#fff" : "#6B7280",
                    }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: active ? "#fff" : emp.color }} />
                    {emp.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Board */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">טוען משימות…</div>
          ) : (
            <div className="grid gap-4 h-full" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {COLUMNS.map(col => {
                const inCol = visible.filter(t => t.status === col.status).sort((a, b) => a.order - b.order);
                const isOver = dragOverStatus === col.status;
                return (
                  <div key={col.status}
                    onDragOver={e => { e.preventDefault(); setDragOverStatus(col.status); }}
                    onDragLeave={() => setDragOverStatus(null)}
                    onDrop={() => { if (draggingId !== null) { const t = tasks.find(t => t.id === draggingId); if (t) moveTask(t, col.status); } setDraggingId(null); setDragOverStatus(null); }}
                    className="rounded-xl border flex flex-col"
                    style={{ background: col.bg, borderColor: isOver ? col.accent : col.border, minHeight: 400, boxShadow: isOver ? `0 0 0 2px ${col.accent}33` : "none", transition: "box-shadow 0.15s, border-color 0.15s" }}>

                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: col.accent }}>
                        {col.label}
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold"
                          style={{ background: "#fff", color: col.accent, border: `1px solid ${col.border}` }}>
                          {inCol.length}
                        </span>
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 px-2 pb-2 flex flex-col gap-2 overflow-y-auto">
                      {inCol.map(t => (
                        <TaskCard key={t.id} task={t} todayStr={todayStr} isDragging={draggingId === t.id}
                          onDragStart={e => { setDraggingId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                          onEdit={() => setModal({ editing: t, status: t.status })}
                          onDelete={() => handleDelete(t)}
                          onMove={s => moveTask(t, s)} />
                      ))}
                      {inCol.length === 0 && (
                        <div className="flex-1 flex items-center justify-center min-h-[120px] m-1 rounded-lg border-2 border-dashed text-[12px] text-gray-400"
                          style={{ borderColor: col.border }}>
                          גרור לכאן או לחץ +
                        </div>
                      )}
                    </div>

                    {/* Col footer */}
                    <button onClick={() => setModal({ editing: null, status: col.status })}
                      className="mx-2 mb-2 py-1.5 rounded-md text-[12px] text-gray-500 hover:text-gray-700 hover:bg-white/70 transition-colors">
                      + הוסף משימה
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Modal */}
      {modal && (
        <TaskModal
          editing={modal.editing}
          initialStatus={modal.status}
          onSave={handleSave}
          onDelete={() => modal.editing && handleDelete(modal.editing)}
          onClose={() => setModal(null)}
          employees={employees}
        />
      )}
    </>
  );
}
