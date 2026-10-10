"use client";

import type { ConflictReason } from "@/lib/conflictCheck";

interface Props {
  employeeName: string;
  reason: ConflictReason;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConflictWarning({ employeeName, reason, onConfirm, onCancel }: Props) {
  const message = reason === "time-off"
    ? `${employeeName} בחופש ביום זה — האם להמשיך?`
    : `${employeeName} לא זמין/ה בשעות אלו — האם להמשיך?`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" dir="rtl">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 relative overflow-hidden"
        style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.1)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        <div className="flex items-start gap-3 mb-5">
          <span className="text-2xl leading-none mt-0.5">⚠️</span>
          <p className="text-[15px] font-semibold text-gray-900 leading-snug">{message}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
            style={{ background: "#D7252F" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
            המשך בכל זאת
          </button>
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
