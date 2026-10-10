"use client";

import { useState } from "react";

interface Props {
  onSubmit: (date: string, type: string, notes: string) => Promise<void>;
  onClose: () => void;
}

const TYPES = [
  { value: "FULL_DAY", label: "יום שלם" },
  { value: "HALF_DAY", label: "חצי יום" },
  { value: "PART_TIME", label: "חלקי" },
];

export default function TimeOffModal({ onSubmit, onClose }: Props) {
  const [date, setDate] = useState("");
  const [type, setType] = useState("FULL_DAY");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    await onSubmit(date, type, notes);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]" dir="rtl">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative overflow-hidden"
        style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.1)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">בקשת היעדרות</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">תאריך</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              onFocus={e => e.target.style.boxShadow = "0 0 0 2px #E5252A"}
              onBlur={e => e.target.style.boxShadow = ""} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">סוג היעדרות</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setType(t.value)}
                  className="flex-1 py-2 text-sm rounded-xl border transition-all font-medium"
                  style={{
                    background: type === t.value ? "#D7252F" : "#fff",
                    color: type === t.value ? "#fff" : "#6B7280",
                    borderColor: type === t.value ? "#D7252F" : "#E5E7EB",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות (אופציונלי)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="סיבה / פרטים נוספים..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
              onFocus={e => e.target.style.boxShadow = "0 0 0 2px #E5252A"}
              onBlur={e => e.target.style.boxShadow = ""} />
          </div>

          <button type="submit" disabled={saving || !date}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50"
            style={{ background: "#D7252F" }}
            onMouseEnter={e => !saving && (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
            {saving ? "שולח..." : "שלח בקשה"}
          </button>
        </form>
      </div>
    </div>
  );
}
