"use client";

import { useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: number;
  type: string;
  description: string;
  entityId: number | null;
  subjectEmployeeId: number | null;
  read: boolean;
  createdAt: string;
}

// Per-type presentation: label chip + tint. Unknown types fall back to neutral.
const TYPE_META: Record<string, { label: string; tint: string; accent: string; icon: string }> = {
  TIME_OFF_PENDING:     { label: "בקשת חופש",       tint: "#FEF3C7", accent: "#92400E", icon: "🏖️" },
  AVAILABILITY_UPDATED: { label: "עדכון זמינות",     tint: "#DBEAFE", accent: "#1E40AF", icon: "📅" },
  SESSION_ABANDONED:    { label: "לימוד לא הושלם",   tint: "#EEF2FF", accent: "#4F46E5", icon: "📚" },
  TASK_DUE_UNVIEWED:    { label: "משימה לא נצפתה",   tint: "#FEE2E2", accent: "#B91C1C", icon: "⏰" },
  TASK_VIEWED:          { label: "משימה נצפתה",      tint: "#DCFCE7", accent: "#166534", icon: "👀" },
  TASK_COMPLETED:       { label: "משימה הושלמה",     tint: "#DCFCE7", accent: "#15803D", icon: "✅" },
  PATIENT_CALLBACK:     { label: "מטופלים לחזרה",     tint: "#FCE7F3", accent: "#9D174D", icon: "📞" },
  QUESTION_STRUGGLE:    { label: "התקשות בשאלה",      tint: "#FEF3C7", accent: "#92400E", icon: "🧠" },
};
const FALLBACK_META = { label: "התראה", tint: "#F1F5F9", accent: "#475569", icon: "🔔" };

function relativeTime(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

interface Props {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  onOpen?: () => void; // refresh hook when the dropdown opens
  onClearHistory?: () => void; // wipes the whole list, not just marks read
}

export default function NotificationBell({ notifications, onMarkRead, onOpen, onClearHistory }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  function toggle() {
    setOpen(o => {
      if (!o) onOpen?.();
      return !o;
    });
  }

  // Unread first, then newest first
  const sorted = [...notifications].sort((a, b) =>
    (a.read === b.read ? 0 : a.read ? 1 : -1) || (b.createdAt > a.createdAt ? 1 : -1));

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="התראות"
        className={`relative inline-flex items-center justify-center rounded-lg border transition-colors ${open ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
        style={{ width: 36, height: 36 }}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" dir="rtl" className="absolute z-30 mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ left: 0, width: 340, maxWidth: "90vw", maxHeight: 440, boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08)" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
            <span className="text-[13px] font-bold text-gray-900">התראות</span>
            <div className="flex items-center gap-2.5">
              {unread.length > 0 && (
                <button onClick={() => unread.forEach(n => onMarkRead(n.id))}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800">
                  סמן הכל כנקרא
                </button>
              )}
              {notifications.length > 0 && onClearHistory && (
                <button
                  onClick={() => { if (window.confirm("למחוק את כל ההתראות לצמיתות?")) onClearHistory(); }}
                  className="text-[11px] font-medium text-gray-400 hover:text-red-600">
                  נקה היסטוריה
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto">
            {sorted.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-gray-400">אין התראות</div>
            )}
            {sorted.map(n => {
              const meta = TYPE_META[n.type] ?? FALLBACK_META;
              return (
                <div key={n.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-gray-50 ${n.read ? "opacity-60" : "bg-red-50/30"}`}>
                  <span className="grid place-items-center rounded-md shrink-0 text-[13px]" style={{ width: 28, height: 28, background: meta.tint }}>
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: meta.tint, color: meta.accent }}>{meta.label}</span>
                      <span className="text-[10px] text-gray-400">{relativeTime(n.createdAt)}</span>
                    </div>
                    <p className="text-[12px] text-gray-800 leading-snug">{n.description}</p>
                  </div>
                  {!n.read && (
                    <button onClick={() => onMarkRead(n.id)} title="סמן כנקרא" aria-label="סמן כנקרא"
                      className="w-6 h-6 grid place-items-center rounded-md text-gray-400 hover:text-green-700 hover:bg-green-50 shrink-0">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
