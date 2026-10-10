"use client";

/**
 * Daily task pop-up for employees — shown once per day, ~2s after the
 * check-in flow finishes, listing their open tasks.
 *  • "הבנתי" just dismisses.
 *  • "סיימתי" per task moves it to DONE (same PATCH the Kanban uses).
 */

import { useState } from "react";

type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface PopupTask {
  id: number; title: string; description: string;
  dueDate: string; priority: string; status: string;
}

const PRI: Record<Priority, { label: string; bg: string; text: string; strip: string }> = {
  LOW:    { label: "נמוכה",   bg: "#F1F5F9", text: "#475569", strip: "#94A3B8" },
  MEDIUM: { label: "בינונית", bg: "#DBEAFE", text: "#1E40AF", strip: "#3B82F6" },
  HIGH:   { label: "גבוהה",   bg: "#FEE2E2", text: "#B91C1C", strip: "#EF4444" },
};
const STATUS_LABEL: Record<string, string> = { TODO: "לביצוע", IN_PROGRESS: "בביצוע" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const fmtDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

interface Props {
  tasks: PopupTask[];
  onGotIt: () => void;
  onFinish: (taskId: number) => Promise<void>;
}

export default function TaskPopup({ tasks, onGotIt, onFinish }: Props) {
  const [finishing, setFinishing] = useState<number | null>(null);
  const today = todayStr();

  async function finish(id: number) {
    setFinishing(id);
    try { await onFinish(id); } finally { setFinishing(null); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 relative overflow-hidden flex flex-col"
        style={{ maxHeight: "85vh", border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.12)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        <div className="px-6 pt-6 pb-3 shrink-0">
          <h3 className="text-[18px] font-bold text-gray-900">המשימות שלך להיום</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {tasks.length === 1 ? "משימה פתוחה אחת" : `${tasks.length} משימות פתוחות`}
          </p>
        </div>

        <div className="px-6 pb-2 overflow-y-auto flex flex-col gap-2">
          {tasks.map(t => {
            const pri = PRI[(t.priority as Priority)] ?? PRI.MEDIUM;
            const isOverdue  = !!t.dueDate && t.dueDate < today;
            const isDueToday = t.dueDate === today;
            return (
              <div key={t.id} className="relative bg-white rounded-lg border border-gray-200 p-3 pr-4"
                style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
                <span aria-hidden className="absolute top-2 bottom-2 right-1.5 w-[3px] rounded-full" style={{ background: pri.strip }} />
                <p className="text-[13px] font-semibold text-gray-900 leading-snug">{t.title}</p>
                {t.description && (
                  <p className="text-[12px] text-gray-500 leading-snug mt-1 line-clamp-3">{t.description}</p>
                )}
                <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: pri.bg, color: pri.text }}>{pri.label}</span>
                    {STATUS_LABEL[t.status] && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{STATUS_LABEL[t.status]}</span>
                    )}
                    {t.dueDate && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: isOverdue ? "#FEE2E2" : isDueToday ? "#FEF3C7" : "#F1F5F9", color: isOverdue ? "#B91C1C" : isDueToday ? "#92400E" : "#475569" }}>
                        📅 {fmtDate(t.dueDate)}{isOverdue && " · באיחור"}{isDueToday && " · היום"}
                      </span>
                    )}
                  </div>
                  <button onClick={() => finish(t.id)} disabled={finishing !== null}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {finishing === t.id ? "מעדכן…" : "סיימתי ✓"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 pt-3 pb-5 shrink-0 border-t border-gray-100 mt-2">
          <button onClick={onGotIt}
            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
            style={{ background: "#D7252F" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
            הבנתי
          </button>
        </div>
      </div>
    </div>
  );
}
