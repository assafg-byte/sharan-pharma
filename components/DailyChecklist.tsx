"use client";

import { useEffect, useState } from "react";
import BreakSlotPicker from "./BreakSlotPicker";

// DB row shape from /api/checklist — managed in the Campus dashboard
export interface ChecklistItemData {
  id: number;
  order: number;
  text: string;
  delaySec: number;
  pendingLabel: string;
  confirmedLabel: string;
  confirmedOptions: string; // newline-separated
  countOnYes: boolean; // plain yes/no only: "yes" reveals an inline count field first
}

// Fallback when the API is unreachable — mirrors the seeded defaults
const FALLBACK_ITEMS: ChecklistItemData[] = [
  {
    id: -1, order: 0, delaySec: 0, pendingLabel: "", confirmedLabel: "", confirmedOptions: "", countOnYes: false,
    text: "שלום {name}! האם {אתה נכנס|את נכנסת} למשמרת?",
  },
  {
    id: -2, order: 1, delaySec: 10, confirmedOptions: "", countOnYes: false,
    text: "האם ה-Avaya פועל וניתן לקבל שיחות?",
    pendingLabel: "רגע, אני {בודק|בודקת}",
    confirmedLabel: "כן, התוכנה פועלת ✓",
  },
  {
    id: -3, order: 2, delaySec: 10, confirmedOptions: "", countOnYes: true,
    text: "האם יש מטופלים שצריך לחזור אליהם מטבלת ההשלמות/משיבון?",
    pendingLabel: "רגע, אני {בודק|בודקת}",
    confirmedLabel: "כן, יש מטופלים לחזור אליהם ✓",
  },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Render {name} and {male|female} placeholders in manager-authored text.
 *  Gender pairs contain a pipe: {אתה נכנס|את נכנסת} → first form for M, second for F. */
export function renderTemplate(text: string, name: string, gender: string): string {
  return text
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (gender === "F" ? f : m))
    .replace(/\{name\}/g, name);
}

function optionsOf(item: ChecklistItemData): string[] {
  return item.confirmedOptions.split("\n").map(s => s.trim()).filter(Boolean);
}

interface Props { name: string; gender: string; onComplete: () => void; }

export default function DailyChecklist({ name, gender, onComplete }: Props) {
  const [items, setItems] = useState<ChecklistItemData[] | null>(null);
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  // "Yes" on a countOnYes item reveals this inline stepper before advancing
  const [awaitingCount, setAwaitingCount] = useState(false);
  const [countValue, setCountValue] = useState(1);
  const [countSubmitting, setCountSubmitting] = useState(false);
  // Last step: break-time picker (always appended, skippable, not manager-orderable)
  const [pickedBreak, setPickedBreak] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checklist")
      .then(r => r.json())
      .then((data: ChecklistItemData[]) => {
        if (cancelled) return;
        // Empty list = manager removed all questions → checklist is skipped.
        // Fallback questions are only for fetch/parse failures.
        setItems(Array.isArray(data) ? data : FALLBACK_ITEMS);
      })
      .catch(() => { if (!cancelled) setItems(FALLBACK_ITEMS); });
    return () => { cancelled = true; };
  }, []);

  const q = items?.[step];
  const isEmpty = items !== null && items.length === 0;
  const isBreakStep = items !== null && !isEmpty && step === items.length;

  // Empty checklist — nothing to ask; complete via effect (not during render)
  useEffect(() => {
    if (isEmpty) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmpty]);

  // Reset the countdown + count-stepper when the question changes (render-time, not in an effect)
  const [prevQ, setPrevQ] = useState<ChecklistItemData | undefined>(undefined);
  if (prevQ !== q) {
    setPrevQ(q);
    setCountdown(q?.delaySec ?? 0);
    setAwaitingCount(false);
    setCountValue(1);
  }

  useEffect(() => {
    if (!q?.delaySec) return;
    const id = setInterval(() => setCountdown(c => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [q]);

  if (!items || (!q && !isBreakStep)) return null; // loading, or empty (completed via effect above)

  function answer(yes: boolean) {
    if (!items) return;
    // "Yes" on a count-tracked item reveals the stepper first — advancing
    // happens via confirmCount() once she's entered a number.
    if (yes && q?.countOnYes && !awaitingCount) {
      setAwaitingCount(true);
      setCountValue(1);
      return;
    }
    // "No" on the first question = not entering a shift — skip the rest
    if (step === 0 && !yes) { onComplete(); return; }
    setStep(s => s + 1); // may land on the break-picker step (index === items.length)
  }

  // Advance without ever opening the count field (first option of a multi-option item)
  function answerNoCount() {
    if (!items) return;
    setStep(s => s + 1);
  }

  async function confirmCount() {
    setCountSubmitting(true);
    try {
      await fetch("/api/checklist/callback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: countValue }),
      });
    } catch { /* best-effort — don't block check-in over a notification */ }
    setCountSubmitting(false);
    setAwaitingCount(false);
    setStep(s => s + 1);
  }

  if (isBreakStep) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
          <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
        </div>
        <div className="relative w-full max-w-sm" dir="rtl" style={{ zIndex: 1 }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: items.length + 1 }).map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all"
                style={{ width: i === step ? 32 : 16, background: i <= step ? "#E5252A" : "#E5E7EB" }} />
            ))}
          </div>
          <div className="bg-white rounded-3xl p-8 relative overflow-hidden"
            style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />
            <div className="text-center mb-6">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                שאלה {items.length + 1} מתוך {items.length + 1}
              </p>
              <h2 className="text-xl font-bold text-gray-900 leading-relaxed">
                מתי {gender === "F" ? "תרצי" : "תרצה"} הפסקה?
              </h2>
            </div>
            {pickedBreak === null ? (
              <>
                <BreakSlotPicker date={todayStr()} onPicked={h => setPickedBreak(h)} />
                <button onClick={onComplete}
                  className="w-full mt-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors">
                  אחליט מאוחר יותר
                </button>
              </>
            ) : (
              <div className="text-center flex flex-col gap-4">
                <p className="text-emerald-600 font-semibold">✓ ההפסקה שלך נקבעה</p>
                <button onClick={onComplete}
                  className="w-full py-3 rounded-xl font-semibold text-white text-[15px] transition-all"
                  style={{ background: "#D7252F" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
                  סיום
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const locked = countdown > 0;
  const opts = optionsOf(q!);
  const pendingLabel = renderTemplate(q!.pendingLabel, name, gender);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}>

      {/* Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm" dir="rtl" style={{ zIndex: 1 }}>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: items.length + 1 }).map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all"
              style={{ width: i === step ? 32 : 16, background: i <= step ? "#E5252A" : "#E5E7EB" }} />
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 relative overflow-hidden"
          style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)" }}>
          <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

          <div className="text-center mb-8">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              שאלה {step + 1} מתוך {items.length + 1}
            </p>
            <h2 className="text-xl font-bold text-gray-900 leading-relaxed">
              {renderTemplate(q!.text, name, gender)}
            </h2>
          </div>

          {/* "Yes" on a count-tracked item — inline stepper instead of advancing immediately */}
          {awaitingCount && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-5">
                <button type="button" onClick={() => setCountValue(v => Math.max(1, v - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 transition-colors">
                  −
                </button>
                <span className="text-3xl font-bold text-gray-900 w-14 text-center tabular-nums">{countValue}</span>
                <button type="button" onClick={() => setCountValue(v => Math.min(50, v + 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 text-gray-600 text-lg font-bold hover:bg-gray-50 transition-colors">
                  +
                </button>
              </div>
              <p className="text-center text-sm text-gray-500">כמה מטופלים?</p>
              <button onClick={confirmCount} disabled={countSubmitting}
                className="w-full py-3 rounded-xl font-semibold text-white text-[15px] transition-all disabled:opacity-60"
                style={{ background: "#D7252F" }}
                onMouseEnter={e => !countSubmitting && (e.currentTarget.style.background = "#B91C1C")}
                onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
                {countSubmitting ? "שולח..." : "אישור"}
              </button>
            </div>
          )}

          {/* No delay — standard Yes / No */}
          {!awaitingCount && !q!.delaySec && (
            <div className="flex gap-3">
              <button onClick={() => answer(true)}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-[15px] transition-all"
                style={{ background: "#D7252F" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
                onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
                כן ✓
              </button>
              <button onClick={() => answer(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 text-[15px] border border-gray-200 hover:bg-gray-50 transition-colors">
                לא
              </button>
            </div>
          )}

          {/* Has delay — single confirmed label (e.g. Avaya) */}
          {!awaitingCount && q!.delaySec > 0 && opts.length === 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => !locked && answer(true)}
                disabled={locked}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-[15px] transition-all"
                style={{
                  background: locked ? "#F4A0A0" : "#D7252F",
                  cursor: locked ? "not-allowed" : "pointer",
                }}
                onMouseEnter={e => { if (!locked) e.currentTarget.style.background = "#B91C1C"; }}
                onMouseLeave={e => { if (!locked) e.currentTarget.style.background = "#D7252F"; }}>
                {locked ? `${pendingLabel} (${countdown})` : renderTemplate(q!.confirmedLabel, name, gender)}
              </button>
              <button onClick={() => answer(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 text-[15px] border border-gray-200 hover:bg-gray-50 transition-colors">
                לא
              </button>
            </div>
          )}

          {/* Has delay + multiple confirmed options (e.g. callback) */}
          {!awaitingCount && q!.delaySec > 0 && opts.length > 0 && (
            <div className="flex flex-col gap-3">
              {locked ? (
                /* Single disabled placeholder during countdown */
                <button
                  disabled
                  className="w-full py-3 rounded-xl font-semibold text-white text-[15px]"
                  style={{ background: "#F4A0A0", cursor: "not-allowed" }}>
                  {pendingLabel} ({countdown})
                </button>
              ) : (
                /* Confirmed options after countdown */
                opts.map((label, i) => (
                  // Option 0 is the "nothing to do" answer; any other option on a
                  // count-tracked item opens the count field (e.g. "I'll return
                  // calls during the day" → how many patients?).
                  <button key={i} onClick={() => (i > 0 ? answer(true) : answerNoCount())}
                    className="w-full py-3 rounded-xl font-semibold text-white text-[14px] transition-all leading-snug"
                    style={{ background: "#D7252F" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
                    {renderTemplate(label, name, gender)}
                  </button>
                ))
              )}
              {/* "No" only shown during countdown — hidden once options appear */}
              {locked && (
                <button onClick={() => answer(false)}
                  className="w-full py-3 rounded-xl font-semibold text-gray-600 text-[15px] border border-gray-200 hover:bg-gray-50 transition-colors">
                  לא
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
