"use client";

/**
 * Shared break-slot grid — used both as the last step of the daily checklist
 * and as the editor popover in the display-mode break bar. First-come-first-
 * served: picking an already-taken slot 409s and the UI shows who has it.
 */

import { useEffect, useState } from "react";

export interface BreakSlotsResponse {
  config: { startHour: number; endHour: number };
  taken: { startHour: number; employeeId: number; employeeName: string; employeeColor: string }[];
  mine: number | null;
  checkedIn: { id: number; name: string; color: string }[]; // clocked in on that date
}

export function fmtHM(h: number) {
  const hh = Math.floor(h);
  const mm = h % 1 === 0.5 ? "30" : "00";
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

export function slotsFromConfig(config: { startHour: number; endHour: number }): number[] {
  const out: number[] = [];
  for (let h = config.startHour; h < config.endHour - 1e-9; h += 0.5) out.push(Math.round(h * 2) / 2);
  return out;
}

interface Props {
  date: string;
  onPicked?: (startHour: number) => void;
  onCleared?: () => void;
  showClear?: boolean; // allow un-picking (used in the edit popover, not the first-time checklist step)
}

export default function BreakSlotPicker({ date, onPicked, onCleared, showClear }: Props) {
  const [data, setData] = useState<BreakSlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/break-slots?date=${date}`)
      .then(r => r.json())
      .then((d: BreakSlotsResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); load(); }, [date]);

  async function pick(h: number) {
    setSaving(h); setError(null);
    const res = await fetch("/api/break-slots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startHour: h }),
    });
    setSaving(null);
    if (res.ok) {
      onPicked?.(h);
      load();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.takenByName ? `${body.takenByName} כבר בחרה את השעה הזו` : "השעה הזו כבר תפוסה");
      load();
    }
  }

  async function clear() {
    setSaving("clear"); setError(null);
    await fetch(`/api/break-slots?date=${date}`, { method: "DELETE" });
    setSaving(null);
    onCleared?.();
    load();
  }

  if (loading || !data) {
    return <div className="text-sm text-gray-400 animate-pulse py-4 text-center">טוען שעות...</div>;
  }

  const slots = slotsFromConfig(data.config);
  const takenByHour = new Map(data.taken.map(t => [t.startHour, t]));

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {slots.map(h => {
          const takenBy = takenByHour.get(h);
          const isMine = data.mine === h;
          const isOther = !!takenBy && !isMine;
          const isSaving = saving === h;
          return (
            <button
              key={h}
              type="button"
              disabled={isOther || saving !== null}
              onClick={() => pick(h)}
              title={isOther ? `תפוס על ידי ${takenBy!.employeeName}` : undefined}
              className="py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:cursor-not-allowed"
              style={{
                background: isMine ? "#D7252F" : isOther ? "#F1F5F9" : "#fff",
                color: isMine ? "#fff" : isOther ? "#94A3B8" : "#374151",
                borderColor: isMine ? "#D7252F" : isOther ? "#E2E8F0" : "#E5E7EB",
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {fmtHM(h)}
              {isOther && (
                <span className="block text-[9px] font-normal truncate mt-0.5">{takenBy!.employeeName}</span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600 font-medium text-center">{error}</p>}
      {showClear && data.mine !== null && (
        <button type="button" onClick={clear} disabled={saving !== null}
          className="text-xs text-gray-400 hover:text-gray-700 underline self-center disabled:opacity-50">
          בטל בחירה
        </button>
      )}
    </div>
  );
}
