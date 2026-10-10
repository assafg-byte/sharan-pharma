"use client";

/**
 * Employee Kanban — identical to the manager's KanbanBoard but:
 *  • shows only tasks assigned to this employee
 *  • when creating a task, assigneeIds is auto-set to their own ID
 *  • no assignee picker (employees can't assign to others)
 */

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { formatWeekRange } from "@/types";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Status   = "TODO" | "IN_PROGRESS" | "DONE";

interface Task {
  id: number; title: string; description: string;
  dueDate: string; priority: Priority; status: Status; order: number; assigneeIds: string;
}

const COLUMNS: { status: Status; label: string; accent: string; bg: string; border: string }[] = [
  { status: "TODO",        label: "לביצוע", accent: "#3B82F6", bg: "#EFF6FF", border: "#DBEAFE" },
  { status: "IN_PROGRESS", label: "בביצוע", accent: "#7C3AED", bg: "#F5F3FF", border: "#E9D5FF" },
  { status: "DONE",        label: "הושלם",  accent: "#16A34A", bg: "#F0FDF4", border: "#DCFCE7" },
];

const PRI: Record<Priority, { label: string; bg: string; text: string; strip: string }> = {
  LOW:    { label: "נמוכה",   bg: "#F1F5F9", text: "#475569", strip: "#94A3B8" },
  MEDIUM: { label: "בינונית", bg: "#DBEAFE", text: "#1E40AF", strip: "#3B82F6" },
  HIGH:   { label: "גבוהה",   bg: "#FEE2E2", text: "#B91C1C", strip: "#EF4444" },
};

const EMPTY_FORM = { title: "", description: "", dueDate: "", priority: "MEDIUM" as Priority };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function TaskModal({ editing, initialStatus, onSave, onDelete, onClose }: {
  editing: Task | null; initialStatus: Status;
  onSave: (form: typeof EMPTY_FORM, status: Status) => Promise<void>;
  onDelete: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState(editing
    ? { title: editing.title, description: editing.description, dueDate: editing.dueDate, priority: editing.priority }
    : EMPTY_FORM);
  const [status, setStatus] = useState<Status>(editing?.status ?? initialStatus);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="מה צריך לעשות?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
            <textarea value={form.description} rows={2} placeholder="פרטים נוספים…"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך יעד</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="LOW">נמוכה</option><option value="MEDIUM">בינונית</option><option value="HIGH">גבוהה</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">עמודה</label>
            <select value={status} onChange={e => setStatus(e.target.value as Status)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving || !form.title.trim()}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {saving ? "שומר…" : editing ? "שמור שינויים" : "הוסף משימה"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">ביטול</button>
            {editing && (
              <button type="button" onClick={onDelete} className="mr-auto px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors">מחק</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

interface Props { employeeId: number; employeeName: string; weekStart: Date; onClose: () => void; onUnseenChange?: (n: number) => void; }

export default function EmployeeKanban({ employeeId, employeeName, weekStart, onClose, onUnseenChange }: Props) {
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<{ editing: Task | null; status: Status } | null>(null);
  const [draggingId, setDraggingId]         = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const today = todayStr();

  useEffect(() => {
    fetch("/api/tasks")
      .then(r => r.json())
      .then((all: Task[]) => {
        const mine = all.filter(t =>
          t.assigneeIds?.split(",").filter(Boolean).includes(String(employeeId))
        );
        setTasks(mine);
        setLoading(false);
        // Mark seen (badge)
        localStorage.setItem(`seen_tasks_${employeeId}`, JSON.stringify(mine.map(t => t.id)));
        onUnseenChange?.(0);
        // Opening the board counts as viewing every open task — server-side,
        // idempotent, so repeat opens don't re-notify the manager.
        mine.filter(t => t.status !== "DONE").forEach(t =>
          fetch(`/api/tasks/${t.id}/view`, { method: "POST" }).catch(() => {})
        );
      });
  }, [employeeId, onUnseenChange]);

  const stats = useMemo(() => ({
    open:     tasks.filter(t => t.status !== "DONE").length,
    dueToday: tasks.filter(t => t.status !== "DONE" && t.dueDate === today).length,
    overdue:  tasks.filter(t => t.status !== "DONE" && !!t.dueDate && t.dueDate < today).length,
  }), [tasks, today]);

  async function handleSave(form: typeof EMPTY_FORM, status: Status) {
    if (modal?.editing) {
      const res = await fetch(`/api/tasks/${modal.editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      if (!res.ok) { alert("שמירה נכשלה"); return; }
      const updated: Task = await res.json();
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } else {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, status,
          assigneeIds: String(employeeId), // always assigned to self
          order: tasks.filter(t => t.status === status).length,
        }),
      });
      if (!res.ok) { alert("יצירה נכשלה"); return; }
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
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    const updated: Task = await res.json();
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  const fmtDate = (iso: string) => { const [,m,d] = iso.split("-"); return `${d}/${m}`; };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{ width: 880, maxWidth: "95vw", borderTopRightRadius: 24, borderBottomRightRadius: 24,
          background: "#FFFFFF", border: "1px solid #F5D5D2",
          boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
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
          </div>
          <div className="text-right">
            <h2 className="text-[18px] font-bold text-gray-900">המשימות שלי</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">{formatWeekRange(weekStart)}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-3 grid grid-cols-3 gap-3 border-b border-gray-100 shrink-0">
          {([["פתוחות", stats.open, "#0f172a"], ["היום", stats.dueToday, stats.dueToday > 0 ? "#7C3AED" : "#94a3b8"], ["באיחור", stats.overdue, stats.overdue > 0 ? "#DC2626" : "#94a3b8"]] as [string, number, string][])
            .map(([label, val, accent]) => (
              <div key={label} className="rounded-xl bg-gray-50 px-3 py-2 flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
                <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: accent }}>{val}</span>
              </div>
            ))}
        </div>

        {/* Board */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">טוען...</div>
          ) : (
            <div className="grid gap-4 h-full" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {COLUMNS.map(col => {
                const inCol = tasks.filter(t => t.status === col.status).sort((a,b) => a.order - b.order);
                const isOver = dragOverStatus === col.status;
                return (
                  <div key={col.status}
                    onDragOver={e => { e.preventDefault(); setDragOverStatus(col.status); }}
                    onDragLeave={() => setDragOverStatus(null)}
                    onDrop={() => { if (draggingId !== null) { const t = tasks.find(t => t.id === draggingId); if (t) moveTask(t, col.status); } setDraggingId(null); setDragOverStatus(null); }}
                    className="rounded-xl border flex flex-col"
                    style={{ background: col.bg, borderColor: isOver ? col.accent : col.border, minHeight: 400,
                      boxShadow: isOver ? `0 0 0 2px ${col.accent}33` : "none", transition: "box-shadow 0.15s, border-color 0.15s" }}>

                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: col.accent }}>
                        {col.label}
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold"
                          style={{ background: "#fff", color: col.accent, border: `1px solid ${col.border}` }}>
                          {inCol.length}
                        </span>
                      </span>
                    </div>

                    <div className="flex-1 px-2 pb-2 flex flex-col gap-2 overflow-y-auto">
                      {inCol.map(t => {
                        const pri = PRI[t.priority];
                        const isOverdue  = t.status !== "DONE" && !!t.dueDate && t.dueDate < today;
                        const isDueToday = t.status !== "DONE" && t.dueDate === today;
                        const isDone     = t.status === "DONE";
                        return (
                          <div key={t.id} draggable
                            onDragStart={e => { setDraggingId(t.id); e.dataTransfer.effectAllowed = "move"; }}
                            className="relative bg-white rounded-lg border border-gray-200 p-2.5 pr-3 cursor-grab active:cursor-grabbing select-none group transition-opacity"
                            style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)", opacity: draggingId === t.id ? 0.4 : 1 }}>
                            <span aria-hidden className="absolute top-2 bottom-2 right-1 w-[3px] rounded-full" style={{ background: pri.strip }} />

                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-[13px] font-semibold text-gray-900 leading-snug"
                                style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
                                {t.title}
                              </p>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => setModal({ editing: t, status: t.status })}
                                  className="w-6 h-6 grid place-items-center text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100">
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button onClick={() => handleDelete(t)}
                                  className="w-6 h-6 grid place-items-center text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-100">
                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {t.description && (
                              <p className="text-[12px] text-gray-500 leading-snug mb-2 line-clamp-2">{t.description}</p>
                            )}

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: pri.bg, color: pri.text }}>{pri.label}</span>
                              {t.dueDate && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{ background: isOverdue ? "#FEE2E2" : isDueToday ? "#FEF3C7" : "#F1F5F9", color: isOverdue ? "#B91C1C" : isDueToday ? "#92400E" : "#475569" }}>
                                  📅 {fmtDate(t.dueDate)}{isOverdue && " · באיחור"}{isDueToday && " · היום"}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                              {t.status !== "TODO"        && <button onClick={() => moveTask(t, "TODO")}        className="hover:text-gray-700">→ לביצוע</button>}
                              {t.status !== "IN_PROGRESS" && <button onClick={() => moveTask(t, "IN_PROGRESS")} className="hover:text-gray-700">→ בביצוע</button>}
                              {t.status !== "DONE"        && <button onClick={() => moveTask(t, "DONE")}         className="hover:text-green-700">→ הושלם ✓</button>}
                            </div>
                          </div>
                        );
                      })}
                      {inCol.length === 0 && (
                        <div className="flex items-center justify-center min-h-[100px] m-1 rounded-lg border-2 border-dashed text-[12px] text-gray-400"
                          style={{ borderColor: col.border }}>
                          גרור לכאן או לחץ +
                        </div>
                      )}
                    </div>

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

      {modal && (
        <TaskModal
          editing={modal.editing}
          initialStatus={modal.status}
          onSave={handleSave}
          onDelete={() => modal.editing && handleDelete(modal.editing)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
