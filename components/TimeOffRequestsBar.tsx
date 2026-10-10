"use client";

import { useEffect, useState } from "react";

interface TimeOff {
  id: number; date: string; type: string; status: string; notes: string;
  employee: { id: number; name: string; color: string };
}

const TYPE_LABELS: Record<string, string> = { FULL_DAY: "יום שלם", HALF_DAY: "חצי יום", PART_TIME: "חלקי" };

// onDecision: fired after approve/reject so the caller can refresh the
// notification feed (the server marks the matching notification read).
export default function TimeOffRequestsBar({ onDecision }: { onDecision?: () => void }) {
  const [requests, setRequests] = useState<TimeOff[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch("/api/time-off?status=PENDING")
      .then(r => r.json())
      .then((data: TimeOff[]) => setRequests(data));
  }, []);

  async function handleDecision(id: number, status: "APPROVED" | "REJECTED") {
    await fetch(`/api/time-off/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setRequests(prev => prev.filter(r => r.id !== id));
    onDecision?.();
  }

  if (requests.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200 overflow-hidden" style={{ background: "#FFFBEB" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{requests.length > 9 ? "9+" : requests.length}</span>
          בקשות היעדרות ממתינות לאישור
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2" dir="rtl">
          {requests.map(req => (
            <div key={req.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-amber-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: req.employee.color }} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{req.employee.name}</p>
                  <p className="text-xs text-gray-400">{req.date.split("-").reverse().join("/")} · {TYPE_LABELS[req.type]}{req.notes ? ` · ${req.notes}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDecision(req.id, "APPROVED")}
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                  אשר
                </button>
                <button onClick={() => handleDecision(req.id, "REJECTED")}
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                  דחה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
