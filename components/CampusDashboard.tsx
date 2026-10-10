"use client";

import { useEffect, useState } from "react";
import ReportExerciseWizard from "./reportExercise/ReportExerciseWizard";
import { EMPTY_REPORT_DATA, validateReportExercise, type ReportExerciseData } from "./reportExercise/types";
import { DEFAULT_THRESHOLDS, MAX_THRESHOLD, levelLabel, paletteForLevel, type TrafficLightThresholds } from "@/lib/trafficLight";
import { setTrafficLightThresholds, useTrafficLightThresholds } from "@/lib/useTrafficLight";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampusSettingsData {
  enabled: boolean;
  questionsPerSession: number;
  leafletLocked: boolean;
}

interface CampusQuestion {
  id: number;
  text: string;
  type: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswers: string;
  explanation: string;
  reportData?: ReportExerciseData | null;
  updatedDate: string; // "YYYY-MM-DD" — shown to employees on the question card
  source: string;      // free text — manager-only, never shown to employees
}

interface Attempt {
  id: number;
  answeredCorrectly: boolean;
  answeredAt: string;
  question: { id: number; text: string };
}

interface Session {
  id: number;
  date: string;
  startedAt: string;
  completedAt: string | null;
  employee: { id: number; name: string; color: string };
  attempts: Attempt[];
}

type Tab = "settings" | "questions" | "checklist" | "import" | "reports";
type QuestionType = "SINGLE_CHOICE" | "TRUE_FALSE" | "MULTI_SELECT" | "REPORT_DRAG_DROP";

// ── Lilly red palette ─────────────────────────────────────────────────────────
const R = {
  accent:    "#D7252F",
  dark:      "#C81E13",
  deep:      "#9F1239",
  tint:      "#FFEBEC",
  border:    "#F5D5D2",
  shadow:    "0 1px 3px rgba(215,37,47,0.06), 0 8px 24px rgba(215,37,47,0.10), 0 32px 64px rgba(0,0,0,0.06)",
  green:     "#16A34A",
  greenBg:   "#F0FDF4",
  greenBrd:  "#86EFAC",
  amber:     "#D97706",
  amberBg:   "#FFFBEB",
  amberBrd:  "#FCD34D",
  amberText: "#92400E",
};

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE:    "בחירה יחידה",
  TRUE_FALSE:       "נכון / לא נכון",
  MULTI_SELECT:     "בחירה מרובה",
  REPORT_DRAG_DROP: "טופס דיווח – גרירה",
};

const TYPE_PALETTE: Record<string, { bg: string; fg: string }> = {
  SINGLE_CHOICE:    { bg: R.tint,    fg: R.deep },
  TRUE_FALSE:       { bg: R.greenBg, fg: R.green },
  MULTI_SELECT:     { bg: "#FCE7F3", fg: "#9D174D" },
  REPORT_DRAG_DROP: { bg: "#DBEAFE", fg: "#1F3864" },
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      position: "relative", width: 44, height: 24, borderRadius: 999, border: "none",
      background: on ? R.dark : "#CBD5E1", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        transition: "left 0.2s",
        left: on ? 22 : 2,
      }} />
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const p = TYPE_PALETTE[type] ?? TYPE_PALETTE.SINGLE_CHOICE;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
      background: p.bg, color: p.fg, whiteSpace: "nowrap",
    }}>{TYPE_LABELS[type] ?? type}</span>
  );
}

function IconBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 8, border: "none",
      background: "transparent", color: "#94A3B8", display: "grid", placeItems: "center", cursor: "pointer",
    }}
    onMouseEnter={e => (e.currentTarget.style.color = danger ? "#DC2626" : R.accent)}
    onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
      {children}
    </button>
  );
}

// ── Question form ─────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BLANK_FORM = {
  text: "", type: "SINGLE_CHOICE" as QuestionType,
  optionA: "", optionB: "", optionC: "", optionD: "",
  correctAnswers: "", explanation: "",
  reportData: null as ReportExerciseData | null,
  updatedDate: todayStr(),
  source: "",
};

function QuestionForm({
  initial, onSave, onCancel,
}: {
  initial: typeof BLANK_FORM & { id?: number };
  onSave: (data: typeof BLANK_FORM & { id?: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [correctSet, setCorrectSet] = useState<Set<string>>(
    new Set(initial.correctAnswers ? initial.correctAnswers.split(",") : [])
  );

  const isTF     = form.type === "TRUE_FALSE";
  const isMulti  = form.type === "MULTI_SELECT";
  const isReport = form.type === "REPORT_DRAG_DROP";

  function toggleCorrect(key: string) {
    setCorrectSet(prev => {
      const next = new Set(prev);
      if (!isMulti) { next.clear(); next.add(key); }
      else { if (next.has(key)) next.delete(key); else next.add(key); }
      return next;
    });
  }

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await onSave({ ...form, correctAnswers: [...correctSet].sort().join(",") });
    setSaving(false);
  }

  const options: { key: string; label: string }[] = isTF
    ? [{ key: "A", label: "נכון" }, { key: "B", label: "לא נכון" }]
    : [
        { key: "A", label: form.optionA || "A" },
        { key: "B", label: form.optionB || "B" },
        { key: "C", label: form.optionC || "C" },
        { key: "D", label: form.optionD || "D" },
      ];

  const reportInvalid = isReport && validateReportExercise(form.text, form.reportData ?? EMPTY_REPORT_DATA).length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)" }}>
      <form onSubmit={submit} dir="rtl" className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ border: `1px solid ${R.border}`, boxShadow: `0 24px 60px -12px rgba(215,37,47,0.28), 0 8px 24px -8px rgba(0,0,0,0.10)` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em",
              color: R.accent, textTransform: "uppercase", margin: 0 }}>
              {form.id ? "עריכת שאלה" : "שאלה חדשה"}
            </p>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "2px 0 0" }}>
              {form.id ? "עדכון שאלת ידע" : "הוספת שאלת ידע לבנק"}
            </h3>
          </div>
          <button type="button" onClick={onCancel}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Question text */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {isReport ? "כותרת התרגיל" : "טקסט השאלה"}
            </label>
            <textarea required rows={3} value={form.text} onChange={e => set("text", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none"
              style={{ borderColor: "#E2E8F0" }}
              onFocus={e => (e.target.style.borderColor = R.accent)}
              onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
              placeholder={isReport ? "כותרת קצרה לתרגיל..." : "הזן את השאלה כאן..."} />
          </div>

          {/* Type + correct answer on one row */}
          <div style={{ display: "grid", gridTemplateColumns: isReport ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">סוג שאלה</label>
              <select value={form.type} onChange={e => { set("type", e.target.value); setCorrectSet(new Set()); }}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white"
                style={{ borderColor: "#E2E8F0" }}>
                <option value="SINGLE_CHOICE">בחירה יחידה</option>
                <option value="TRUE_FALSE">נכון / לא נכון</option>
                <option value="MULTI_SELECT">בחירה מרובה</option>
                <option value="REPORT_DRAG_DROP">טופס דיווח – גרירה</option>
              </select>
            </div>
            {!isReport && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  {isMulti ? "תשובות נכונות" : "תשובה נכונה"}
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {options.map(({ key }) => (
                    <button key={key} type="button" onClick={() => toggleCorrect(key)} style={{
                      width: 36, height: 36, borderRadius: 10, fontWeight: 800, fontSize: 12,
                      border: `1.5px solid ${correctSet.has(key) ? R.dark : "#E2E8F0"}`,
                      background: correctSet.has(key) ? R.dark : "#fff",
                      color: correctSet.has(key) ? "#fff" : "#475569",
                    }}>{key}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Report exercise wizard */}
          {isReport && (
            <ReportExerciseWizard
              title={form.text}
              value={form.reportData ?? EMPTY_REPORT_DATA}
              onChange={data => setForm(f => ({ ...f, reportData: data }))}
            />
          )}

          {/* Options A–D */}
          {!isTF && !isReport && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500">אפשרויות תשובה</label>
              {(["A", "B", "C", "D"] as const).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: correctSet.has(k) ? R.dark : "rgba(0,0,0,0.05)",
                    color: correctSet.has(k) ? "#fff" : "#64748b",
                    display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800,
                  }}>{k}</span>
                  <input required={k === "A" || k === "B"} type="text"
                    value={form[`option${k}` as keyof typeof form] as string}
                    onChange={e => set(`option${k}`, e.target.value)}
                    className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none"
                    style={{ borderColor: "#E2E8F0" }}
                    onFocus={e => (e.target.style.borderColor = R.accent)}
                    onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
                    placeholder={k === "A" || k === "B" ? `אפשרות ${k} *` : `אפשרות ${k} (אופציונלי)`} />
                </div>
              ))}
            </div>
          )}

          {/* Explanation */}
          {!isReport && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">הסבר (מוצג לאחר התשובה)</label>
              <textarea rows={2} value={form.explanation} onChange={e => set("explanation", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none"
                style={{ borderColor: "#E2E8F0" }}
                onFocus={e => (e.target.style.borderColor = R.accent)}
                onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
                placeholder="הסבר מדוע התשובה נכונה..." />
            </div>
          )}

          {/* Update date + source — date shown to employees, source manager-only */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">תאריך עדכון</label>
              <input type="date" value={form.updatedDate} dir="ltr"
                onChange={e => set("updatedDate", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                style={{ borderColor: "#E2E8F0" }}
                onFocus={e => (e.target.style.borderColor = R.accent)}
                onBlur={e => (e.target.style.borderColor = "#E2E8F0")} />
              <p style={{ fontSize: 10, color: "#94A3B8", margin: "4px 0 0" }}>מוצג לעובדות</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">מקור</label>
              <input type="text" value={form.source}
                onChange={e => set("source", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                style={{ borderColor: "#E2E8F0" }}
                onFocus={e => (e.target.style.borderColor = R.accent)}
                onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
                placeholder="מאיפה המידע — לשימוש פנימי" />
              <p style={{ fontSize: 10, color: "#94A3B8", margin: "4px 0 0" }}>לשימוש פנימי בלבד — לא מוצג לעובדות</p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 24px", borderTop: "1px solid #F1F5F9", background: "#FCFCFD", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{
            padding: "9px 14px", borderRadius: 10,
            background: "#fff", border: "1px solid #E2E8F0", color: "#475569",
            fontSize: 13, fontWeight: 600,
          }}>ביטול</button>
          <button type="submit" disabled={saving || (isReport ? reportInvalid : correctSet.size === 0)} style={{
            padding: "9px 18px", borderRadius: 10,
            background: R.dark, color: "#fff", border: "none",
            fontSize: 13, fontWeight: 700, opacity: (isReport ? reportInvalid : correctSet.size === 0) ? 0.4 : 1,
            boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)",
          }}>{saving ? "שומר..." : "שמור שאלה"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<CampusSettingsData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/campus/settings").then(r => r.json()).then(setSettings);
  }, []);

  async function patch(updates: Partial<CampusSettingsData>) {
    if (!settings) return;
    const next = { ...settings, ...updates };
    setSettings(next);
    setSaving(true);
    await fetch("/api/campus/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
  }

  if (!settings) return <div className="text-sm text-gray-400 animate-pulse">טוען...</div>;

  const n = settings.questionsPerSession;
  const pct = ((n - 1) / 19) * 100;

  return (
    <div style={{ maxWidth: 540, display: "flex", flexDirection: "column", gap: 14 }} dir="rtl">

      {/* Toggle row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: 18, borderRadius: 16, background: "#fff",
        border: `1px solid ${R.border}`, boxShadow: "0 1px 0 rgba(215,37,47,0.04)",
      }}>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, background: R.tint,
            display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0,
          }}>📚</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>קמפוס לילי</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", lineHeight: 1.6 }}>
              הפעלת שאלות ידע Mounjaro בתחילת כל משמרת
            </p>
          </div>
        </div>
        <Toggle on={settings.enabled} onToggle={() => patch({ enabled: !settings.enabled })} />
      </div>

      {/* Stepper + visual slider */}
      <div style={{ padding: 18, borderRadius: 16, background: "#fff", border: `1px solid ${R.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>מס&apos; שאלות יומי</p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0" }}>1 עד 20 שאלות</p>
          </div>
          {/* Stepper */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden",
          }}>
            <button onClick={() => patch({ questionsPerSession: Math.max(1, n - 1) })} style={{
              width: 36, height: 36, border: "none", background: "#F8FAFC",
              color: "#64748b", fontSize: 18, cursor: "pointer", fontWeight: 700,
            }}>−</button>
            <span style={{
              width: 52, height: 36, display: "grid", placeItems: "center",
              fontSize: 17, fontWeight: 800, color: "#0F172A",
              fontVariantNumeric: "tabular-nums",
              background: "#fff", borderLeft: "1px solid #E2E8F0", borderRight: "1px solid #E2E8F0",
            }}>{n}</span>
            <button onClick={() => patch({ questionsPerSession: Math.min(20, n + 1) })} style={{
              width: 36, height: 36, border: "none", background: "#F8FAFC",
              color: "#64748b", fontSize: 18, cursor: "pointer", fontWeight: 700,
            }}>+</button>
          </div>
        </div>

        {/* Visual scale bar */}
        <div style={{ position: "relative", height: 6, marginBottom: 6 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#F1F5F9" }} />
          <div style={{
            position: "absolute", top: 0, right: 0, height: 6, borderRadius: 999,
            width: `${pct}%`, background: R.dark, transition: "width 0.2s",
          }} />
          <div style={{
            position: "absolute", right: `calc(${pct}% - 8px)`, top: -5,
            width: 16, height: 16, borderRadius: "50%",
            background: "#fff", border: `3px solid ${R.dark}`, transition: "right 0.2s",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8" }}>
          {["1", "5", "10", "15", "20"].map(v => <span key={v}>{v}</span>)}
        </div>
      </div>

      {/* SRS info card */}
      <div style={{
        padding: "14px 16px", borderRadius: 16,
        background: `linear-gradient(135deg, ${R.tint} 0%, #FFFFFF 100%)`,
        border: `1px solid ${R.border}`,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: R.deep, margin: 0 }}>
          ⏱ מערכת חזרה מרווחת
        </p>
        <p style={{ fontSize: 12, color: "#475569", margin: "6px 0 0", lineHeight: 1.65 }}>
          שאלות שנענו נכון יחזרו בעוד <strong>14 יום</strong>. שאלות שנכשלו יחזרו בעוד <strong>3 ימים</strong>, כדי לחזק ניסיון נוסף בקרוב.
        </p>
      </div>

      <TrafficLightEditor />

      {/* Mounjaro leaflet content visibility */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: 18, borderRadius: 16, background: "#fff",
        border: `1px solid ${R.border}`,
      }}>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, background: R.tint,
            display: "grid", placeItems: "center", fontSize: 20, flexShrink: 0,
          }}>📖</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>הסתרת תוכן עלון מוּנגָ׳רוֹ</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0", lineHeight: 1.6 }}>
              הפעלת הכפתור מסתירה את התוכן
            </p>
          </div>
        </div>
        {/* On = content hidden, matching the "turning it on hides" copy above */}
        <Toggle on={settings.leafletLocked} onToggle={() => patch({ leafletLocked: !settings.leafletLocked })} />
      </div>

      {saving && <p style={{ fontSize: 12, color: R.accent }} className="animate-pulse">שומר...</p>}
    </div>
  );
}

// ── Traffic-light thresholds ─────────────────────────────────────────────────
// The schedule table's colors are fixed; the manager sets from how many
// employees on shift a cell turns orange / yellow / green (fewer = red).
// Saving pushes the new thresholds to every open table on the page right away.

const THRESHOLD_ROWS: { key: keyof TrafficLightThresholds; level: "one" | "two" | "full"; name: string }[] = [
  { key: "full", level: "full", name: "ירוק" },
  { key: "two",  level: "two",  name: "צהוב" },
  { key: "one",  level: "one",  name: "כתום" },
];

function TrafficLightEditor() {
  const saved = useTrafficLightThresholds();
  const [draft, setDraft] = useState<TrafficLightThresholds>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the saved thresholds once they load (or after a save)
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) { setLastSaved(saved); setDraft(saved); }

  const same = (a: TrafficLightThresholds, b: TrafficLightThresholds) => a.one === b.one && a.two === b.two && a.full === b.full;
  const dirty = !same(draft, saved);
  const isDefault = same(draft, DEFAULT_THRESHOLDS);

  // Each threshold must stay strictly between its neighbours: 1 ≤ orange < yellow < green ≤ MAX
  const bounds: Record<keyof TrafficLightThresholds, [number, number]> = {
    one:  [1, draft.two - 1],
    two:  [draft.one + 1, draft.full - 1],
    full: [draft.two + 1, MAX_THRESHOLD],
  };

  async function send(body: TrafficLightThresholds | { reset: true }) {
    setSaving(true); setError(null);
    const res = await fetch("/api/traffic-light", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) setTrafficLightThresholds(await res.json());
    else setError("השמירה נכשלה");
  }

  const stepBtn = (disabled: boolean): React.CSSProperties => ({
    width: 30, height: 30, border: "none", background: "#F8FAFC",
    color: "#64748b", fontSize: 16, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
  });

  const red = paletteForLevel("none");

  return (
    <div dir="rtl" style={{ padding: 18, borderRadius: 16, background: "#fff", border: `1px solid ${R.border}` }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>🚦 מודל הרמזור</p>
      <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 14px" }}>
        מכמה עובדים במשמרת המשבצת בלוח השעות נצבעת בכל צבע
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {THRESHOLD_ROWS.map(({ key, level, name }) => {
          const { bg, accent, nameColor } = paletteForLevel(level);
          const [min, max] = bounds[key];
          const v = draft[key];
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "8px 12px", borderRadius: 10, background: bg, borderInlineStart: `3px solid ${accent}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: nameColor }}>
                {name} <span style={{ fontWeight: 500, opacity: 0.8 }}>· {levelLabel(level, draft)}</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: nameColor }}>החל מ-</span>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <button type="button" aria-label={`הפחת ${name}`} disabled={v <= min}
                    onClick={() => setDraft(d => ({ ...d, [key]: v - 1 }))} style={stepBtn(v <= min)}>−</button>
                  <span style={{
                    width: 36, height: 30, display: "grid", placeItems: "center",
                    fontSize: 15, fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums",
                    borderLeft: "1px solid #E2E8F0", borderRight: "1px solid #E2E8F0",
                  }}>{v}</span>
                  <button type="button" aria-label={`הוסף ${name}`} disabled={v >= max}
                    onClick={() => setDraft(d => ({ ...d, [key]: v + 1 }))} style={stepBtn(v >= max)}>+</button>
                </div>
                <span style={{ fontSize: 12, color: nameColor }}>עובדים</span>
              </div>
            </div>
          );
        })}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10,
          background: red.bg, borderInlineStart: `3px solid ${red.accent}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: red.nameColor }}>
            אדום <span style={{ fontWeight: 500, opacity: 0.8 }}>· {levelLabel("none", draft)}</span>
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <button onClick={() => send(draft)} disabled={!dirty || saving} style={{
          padding: "7px 14px", borderRadius: 10, border: "none",
          background: R.dark, color: "#fff", fontSize: 12, fontWeight: 700,
          opacity: (!dirty || saving) ? 0.4 : 1,
        }}>{saving ? "שומר..." : "שמור"}</button>
        {dirty && !saving && (
          <button onClick={() => setDraft(saved)} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none" }}>
            בטל שינויים
          </button>
        )}
        {!isDefault && !saving && (
          <button onClick={() => send({ reset: true })}
            style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", textDecoration: "underline", marginInlineStart: "auto" }}>
            שחזר ברירת מחדל
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: "#DC2626", margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

// ── Tab: Question Bank ─────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions, setQuestions]   = useState<CampusQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState<(typeof BLANK_FORM & { id?: number }) | null>(null);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/campus/questions").then(r => r.json());
    setQuestions(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleSave(data: typeof BLANK_FORM & { id?: number }) {
    if (data.id) {
      await fetch(`/api/campus/questions/${data.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/campus/questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setFormOpen(false); setEditing(null);
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק שאלה זו?")) return;
    await fetch(`/api/campus/questions/${id}`, { method: "DELETE" });
    await load();
  }

  const visible = questions.filter(q => {
    const matchType = !typeFilter || q.type === typeFilter;
    const matchSearch = !search || q.text.includes(search);
    return matchType && matchSearch;
  });

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }} dir="rtl">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
            borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", width: 200,
          }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} dir="rtl"
              placeholder="חיפוש שאלות..." style={{ background: "none", border: "none", fontSize: 12, color: "#0F172A", outline: "none", flex: 1 }} />
          </div>
          {/* Type filters */}
          {[null, "SINGLE_CHOICE", "TRUE_FALSE", "MULTI_SELECT", "REPORT_DRAG_DROP"].map(t => (
            <button key={t ?? "all"} onClick={() => setTypeFilter(t)}
              style={{
                padding: "7px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                border: `1px solid ${typeFilter === t ? R.accent : "#E2E8F0"}`,
                background: typeFilter === t ? R.tint : "#fff",
                color: typeFilter === t ? R.deep : "#475569",
              }}>
              {t ? TYPE_LABELS[t] : "הכל"}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing({ ...BLANK_FORM }); setFormOpen(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10, border: "none",
            background: R.dark, color: "#fff", fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)",
          }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          שאלה חדשה
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16" dir="rtl">
          <span style={{ fontSize: 40 }}>📚</span>
          <p className="mt-3 text-sm text-gray-400">{search || typeFilter ? "אין תוצאות לחיפוש זה" : "אין שאלות עדיין. הוסף את שאלת הידע הראשונה."}</p>
        </div>
      ) : (
        <div style={{ border: "1px solid #F1F5F9", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "120px 1fr 80px 80px",
            padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9",
            fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase",
          }} dir="rtl">
            <span>סוג</span><span style={{ paddingRight: 12 }}>שאלה</span>
            <span style={{ textAlign: "center" }}>תשובה</span>
            <span style={{ textAlign: "left" }}>פעולות</span>
          </div>
          {visible.map((q, i) => (
            <div key={q.id} style={{
              display: "grid", gridTemplateColumns: "120px 1fr 80px 80px",
              padding: "12px 16px", borderBottom: i === visible.length - 1 ? "none" : "1px solid #F8FAFC",
              alignItems: "center",
            }} dir="rtl">
              <span><TypeBadge type={q.type} /></span>
              <span style={{ fontSize: 13, color: "#0F172A", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{q.text}</span>
              <span style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: R.deep }}>{q.correctAnswers || "—"}</span>
              <span style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                <IconBtn onClick={() => { setEditing({ ...q, type: q.type as QuestionType, reportData: q.reportData ?? null }); setFormOpen(true); }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </IconBtn>
                <IconBtn danger onClick={() => handleDelete(q.id)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </IconBtn>
              </span>
            </div>
          ))}
        </div>
      )}

      {formOpen && editing && (
        <QuestionForm initial={editing} onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }} />
      )}
    </>
  );
}

// ── Tab: Check-in Checklist ───────────────────────────────────────────────────
// Manages the daily check-in questions shown to employees at shift start
// (rendered by DailyChecklist on the employee page).

interface ChecklistItem {
  id: number;
  order: number;
  text: string;
  delaySec: number;
  pendingLabel: string;
  confirmedLabel: string;
  confirmedOptions: string; // newline-separated
  countOnYes: boolean;
}

type ChecklistKind = "plain" | "single" | "options";

const CHECKLIST_KIND_LABELS: Record<ChecklistKind, string> = {
  plain:   "כן / לא",
  single:  "השהיה + כפתור אישור",
  options: "השהיה + מספר אפשרויות",
};

function checklistKindOf(item: { delaySec: number; confirmedOptions: string }): ChecklistKind {
  if (item.delaySec > 0 && item.confirmedOptions.trim()) return "options";
  if (item.delaySec > 0) return "single";
  return "plain";
}

const BLANK_CHECKLIST_FORM = {
  text: "", kind: "plain" as ChecklistKind, delaySec: 10,
  pendingLabel: "רגע, אני {בודק|בודקת}", confirmedLabel: "", confirmedOptions: "",
  countOnYes: false,
};

function ChecklistForm({
  initial, onSave, onCancel,
}: {
  initial: typeof BLANK_CHECKLIST_FORM & { id?: number };
  onSave: (data: typeof BLANK_CHECKLIST_FORM & { id?: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const hasDelay = form.kind !== "plain";
  const invalid =
    !form.text.trim() ||
    (hasDelay && (!form.pendingLabel.trim() || form.delaySec < 1)) ||
    (form.kind === "single" && !form.confirmedLabel.trim()) ||
    (form.kind === "options" && form.confirmedOptions.split("\n").filter(s => s.trim()).length < 2);

  function set(field: string, value: string | number) { setForm(f => ({ ...f, [field]: value })); }
  function toggleCountOnYes() { setForm(f => ({ ...f, countOnYes: !f.countOnYes })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || invalid) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const inputStyle = { borderColor: "#E2E8F0" };
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.target.style.borderColor = R.accent);
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.target.style.borderColor = "#E2E8F0");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)" }}>
      <form onSubmit={submit} dir="rtl" className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ border: `1px solid ${R.border}`, boxShadow: `0 24px 60px -12px rgba(215,37,47,0.28), 0 8px 24px -8px rgba(0,0,0,0.10)` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em",
              color: R.accent, textTransform: "uppercase", margin: 0 }}>
              {form.id ? "עריכת שלב" : "שלב חדש"}
            </p>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "2px 0 0" }}>
              {form.id ? "עדכון שלב בצ'קליסט הכניסה" : "הוספת שלב לצ'קליסט הכניסה"}
            </h3>
          </div>
          <button type="button" onClick={onCancel}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Question text */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">טקסט השאלה</label>
            <textarea required rows={3} value={form.text} onChange={e => set("text", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none"
              style={inputStyle} onFocus={focus} onBlur={blur}
              placeholder="הזן את השאלה כאן..." />
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "4px 0 0", lineHeight: 1.6 }}>
              אפשר להשתמש ב-<code dir="ltr">{"{name}"}</code> לשם העובד,
              וב-<code dir="ltr">{"{זכר|נקבה}"}</code> להטיה לפי מגדר.
              לדוגמה: <span dir="rtl">שלום {"{name}"}! האם {"{אתה נכנס|את נכנסת}"} למשמרת?</span>
            </p>
          </div>

          {/* Kind */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">סוג שלב</label>
            <select value={form.kind} onChange={e => set("kind", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white"
              style={inputStyle}>
              <option value="plain">כן / לא — מענה מיידי</option>
              <option value="single">השהיה + כפתור אישור אחד (כמו Avaya)</option>
              <option value="options">השהיה + מספר אפשרויות אישור (כמו משיבון)</option>
            </select>
          </div>

          {hasDelay && (
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12 }}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">השהיה (שניות)</label>
                <input type="number" min={1} max={120} value={form.delaySec}
                  onChange={e => set("delaySec", Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                  style={inputStyle} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">טקסט בזמן ההשהיה</label>
                <input type="text" value={form.pendingLabel}
                  onChange={e => set("pendingLabel", e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                  style={inputStyle} onFocus={focus} onBlur={blur}
                  placeholder="רגע, אני {בודק|בודקת}" />
              </div>
            </div>
          )}

          {form.kind === "single" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">טקסט כפתור האישור (לאחר ההשהיה)</label>
              <input type="text" value={form.confirmedLabel}
                onChange={e => set("confirmedLabel", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
                style={inputStyle} onFocus={focus} onBlur={blur}
                placeholder="כן, התוכנה פועלת ✓" />
            </div>
          )}

          {form.kind === "options" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">אפשרויות אישור — שורה לכל אפשרות (לפחות 2)</label>
              <textarea rows={3} value={form.confirmedOptions}
                onChange={e => set("confirmedOptions", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none"
                style={inputStyle} onFocus={focus} onBlur={blur}
                placeholder={"בדקתי ואין לי שיחות לחזור אליהן\nבדקתי, אחזור לשיחות במהלך היום"} />
            </div>
          )}

          {(
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0",
            }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: 0 }}>ספירה בתשובה חיובית</p>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0", lineHeight: 1.5 }}>
                  {form.kind === "options"
                    ? "כל אפשרות מלבד הראשונה תבקש מספר, ותודיע למנהל/ת כמה"
                    : "תשובת \"כן\"/אישור תבקש מספר, ותודיע למנהל/ת כמה"}
                </p>
              </div>
              <Toggle on={form.countOnYes} onToggle={toggleCountOnYes} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 24px", borderTop: "1px solid #F1F5F9", background: "#FCFCFD", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{
            padding: "9px 14px", borderRadius: 10,
            background: "#fff", border: "1px solid #E2E8F0", color: "#475569",
            fontSize: 13, fontWeight: 600,
          }}>ביטול</button>
          <button type="submit" disabled={saving || invalid} style={{
            padding: "9px 18px", borderRadius: 10,
            background: R.dark, color: "#fff", border: "none",
            fontSize: 13, fontWeight: 700, opacity: invalid ? 0.4 : 1,
            boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)",
          }}>{saving ? "שומר..." : "שמור שלב"}</button>
        </div>
      </form>
    </div>
  );
}

// ── Break window editor ──────────────────────────────────────────────────────
// Manager-configured start–end range for the checklist's final "when do you
// want a break?" step; slots are generated automatically at 30-min intervals.

function hourToTimeInput(h: number): string {
  const hh = Math.floor(h), mm = h % 1 === 0.5 ? 30 : 0;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function timeInputToHour(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return Math.round((h + (m >= 30 ? 0.5 : 0)) * 2) / 2;
}

function BreakWindowEditor() {
  const [range, setRange] = useState<{ startHour: number; endHour: number } | null>(null);
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/break-slots/config").then(r => r.json()).then(d => {
      setRange(d);
      setDraft({ start: hourToTimeInput(d.startHour), end: hourToTimeInput(d.endHour) });
    });
  }, []);

  const dirty = !!(range && draft && (hourToTimeInput(range.startHour) !== draft.start || hourToTimeInput(range.endHour) !== draft.end));

  async function save() {
    if (!draft) return;
    const startHour = timeInputToHour(draft.start);
    const endHour = timeInputToHour(draft.end);
    if (startHour >= endHour) { setError("שעת ההתחלה חייבת להיות לפני שעת הסיום"); return; }
    setError(null); setSaving(true);
    const res = await fetch("/api/break-slots/config", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startHour, endHour }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setRange(updated);
      setDraft({ start: hourToTimeInput(updated.startHour), end: hourToTimeInput(updated.endHour) });
    } else {
      setError("השמירה נכשלה");
    }
  }

  if (!draft) return null;

  return (
    <div dir="rtl" style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      padding: "14px 16px", borderRadius: 14, background: "#fff", border: `1px solid ${R.border}`, marginBottom: 14,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>⏱ חלון הפסקות</p>
        <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0" }}>
          טווח השעות לבחירת הפסקה בשלב האחרון של הצ&apos;קליסט — משבצות של חצי שעה
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <input type="time" step={1800} value={draft.start} dir="ltr"
          onChange={e => setDraft(d => d && { ...d, start: e.target.value })}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
        <span style={{ color: "#94A3B8", fontSize: 12 }}>עד</span>
        <input type="time" step={1800} value={draft.end} dir="ltr"
          onChange={e => setDraft(d => d && { ...d, end: e.target.value })}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
        <button onClick={save} disabled={!dirty || saving} style={{
          padding: "7px 14px", borderRadius: 10, border: "none",
          background: R.dark, color: "#fff", fontSize: 12, fontWeight: 700,
          opacity: (!dirty || saving) ? 0.4 : 1,
        }}>{saving ? "שומר..." : "שמור"}</button>
      </div>
      {error && <p style={{ fontSize: 11, color: "#DC2626", width: "100%", margin: 0 }}>{error}</p>}
    </div>
  );
}

function ChecklistTab() {
  // null = not yet loaded (skeleton); reloads after edits keep the current list
  const [items, setItems]       = useState<ChecklistItem[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<(typeof BLANK_CHECKLIST_FORM & { id?: number }) | null>(null);
  const [busy, setBusy]         = useState(false);
  const loading = items === null;

  async function load() {
    const data = await fetch("/api/checklist").then(r => r.json());
    setItems(Array.isArray(data) ? data : []);
  }
  useEffect(() => {
    fetch("/api/checklist").then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []));
  }, []);

  async function handleSave(data: typeof BLANK_CHECKLIST_FORM & { id?: number }) {
    const payload = {
      text: data.text,
      delaySec: data.kind === "plain" ? 0 : data.delaySec,
      pendingLabel: data.kind === "plain" ? "" : data.pendingLabel,
      confirmedLabel: data.kind === "single" ? data.confirmedLabel : "",
      confirmedOptions: data.kind === "options"
        ? data.confirmedOptions.split("\n").map(s => s.trim()).filter(Boolean).join("\n")
        : "",
      countOnYes: data.countOnYes,
    };
    if (data.id) {
      await fetch(`/api/checklist/${data.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/checklist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setFormOpen(false); setEditing(null);
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("למחוק שלב זה מהצ'קליסט?")) return;
    await fetch(`/api/checklist/${id}`, { method: "DELETE" });
    await load();
  }

  // Swap the `order` of adjacent items (list is already order-sorted)
  async function move(idx: number, dir: -1 | 1) {
    const other = idx + dir;
    if (busy || !items || other < 0 || other >= items.length) return;
    setBusy(true);
    const a = items[idx], b = items[other];
    await Promise.all([
      fetch(`/api/checklist/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: b.order }) }),
      fetch(`/api/checklist/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: a.order }) }),
    ]);
    await load();
    setBusy(false);
  }

  function openEdit(item: ChecklistItem) {
    setEditing({
      id: item.id,
      text: item.text,
      kind: checklistKindOf(item),
      delaySec: item.delaySec || 10,
      pendingLabel: item.pendingLabel || "רגע, אני {בודק|בודקת}",
      confirmedLabel: item.confirmedLabel,
      confirmedOptions: item.confirmedOptions,
      countOnYes: item.countOnYes,
    });
    setFormOpen(true);
  }

  return (
    <>
      <BreakWindowEditor />

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }} dir="rtl">
        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 420 }}>
          השאלות שמוצגות לעובדים בכניסה למשמרת, לפי הסדר.
          מענה &quot;לא&quot; על השאלה הראשונה מדלג על שאר השלבים.
          שלב &quot;מתי תרצי הפסקה?&quot; מתווסף תמיד בסוף (אפשר לדלג עליו).
        </p>
        <button onClick={() => { setEditing({ ...BLANK_CHECKLIST_FORM }); setFormOpen(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10, border: "none",
            background: R.dark, color: "#fff", fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)", flexShrink: 0,
          }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          שלב חדש
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16" dir="rtl">
          <span style={{ fontSize: 40 }}>✅</span>
          <p className="mt-3 text-sm text-gray-400">אין שלבים בצ&apos;קליסט — עובדים ייכנסו למשמרת ללא שאלות.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid #F1F5F9", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: "grid", gridTemplateColumns: "56px 32px 1fr 150px 90px",
              padding: "12px 16px", borderBottom: i === items.length - 1 ? "none" : "1px solid #F8FAFC",
              alignItems: "center", gap: 4,
            }} dir="rtl">
              {/* Reorder arrows */}
              <span style={{ display: "flex", gap: 2 }}>
                <IconBtn onClick={() => move(i, -1)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: i === 0 ? 0.25 : 1 }}>
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                </IconBtn>
                <IconBtn onClick={() => move(i, 1)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: i === items.length - 1 ? 0.25 : 1 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </IconBtn>
              </span>
              {/* Step number */}
              <span style={{
                width: 24, height: 24, borderRadius: "50%", background: R.tint, color: R.deep,
                display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800,
              }}>{i + 1}</span>
              {/* Text */}
              <span style={{ fontSize: 13, color: "#0F172A", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{item.text}</span>
              {/* Kind badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                background: R.tint, color: R.deep, whiteSpace: "nowrap", justifySelf: "start",
              }}>
                {CHECKLIST_KIND_LABELS[checklistKindOf(item)]}
                {item.delaySec > 0 ? ` · ${item.delaySec} שנ׳` : ""}
                {item.countOnYes ? " · #" : ""}
              </span>
              {/* Actions */}
              <span style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                <IconBtn onClick={() => openEdit(item)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </IconBtn>
                <IconBtn danger onClick={() => handleDelete(item.id)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </IconBtn>
              </span>
            </div>
          ))}
        </div>
      )}

      {formOpen && editing && (
        <ChecklistForm initial={editing} onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }} />
      )}
    </>
  );
}

// ── Tab: Import ───────────────────────────────────────────────────────────────

// Minimal CSV parser — handles quoted fields, commas and newlines inside quotes
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f.trim() !== "")) rows.push(row);
  return rows;
}

const IMPORT_TYPE_ALIASES: Record<string, QuestionType> = {
  "SINGLE_CHOICE": "SINGLE_CHOICE", "בחירה יחידה": "SINGLE_CHOICE",
  "TRUE_FALSE": "TRUE_FALSE", "נכון / לא נכון": "TRUE_FALSE", "נכון/לא נכון": "TRUE_FALSE",
  "MULTI_SELECT": "MULTI_SELECT", "בחירה מרובה": "MULTI_SELECT",
};

interface ImportRow {
  line: number;
  data: typeof BLANK_FORM;
  errors: string[];
}

// Columns: text, type, optionA, optionB, optionC, optionD, correctAnswers, explanation
function toImportRow(cells: string[], line: number): ImportRow {
  const [text = "", rawType = "", optionA = "", optionB = "", optionC = "", optionD = "", rawCorrect = "", explanation = ""] =
    cells.map(c => c.trim());
  const errors: string[] = [];
  const type = IMPORT_TYPE_ALIASES[rawType];

  if (!text) errors.push("חסר טקסט שאלה");
  if (!type) errors.push(`סוג לא מוכר: "${rawType}"`);

  const correct = rawCorrect.toUpperCase().split(/[,; ]+/).filter(Boolean);
  const validKeys = type === "TRUE_FALSE" ? ["A", "B"] : ["A", "B", "C", "D"];
  const provided = new Set(
    type === "TRUE_FALSE" ? ["A", "B"]
      : (["A", "B", "C", "D"] as const).filter((k, i) => [optionA, optionB, optionC, optionD][i] !== "")
  );

  if (type && type !== "TRUE_FALSE" && (!optionA || !optionB)) errors.push("חובה לפחות אפשרויות A ו-B");
  if (correct.length === 0) errors.push("חסרה תשובה נכונה");
  if (correct.some(k => !validKeys.includes(k) || !provided.has(k))) errors.push(`תשובה נכונה לא תקינה: ${rawCorrect}`);
  if (type && type !== "MULTI_SELECT" && correct.length > 1) errors.push("יותר מתשובה נכונה אחת בשאלה שאינה בחירה מרובה");

  return {
    line,
    errors,
    data: {
      text, type: type ?? "SINGLE_CHOICE",
      optionA: type === "TRUE_FALSE" ? "נכון" : optionA,
      optionB: type === "TRUE_FALSE" ? "לא נכון" : optionB,
      optionC, optionD,
      correctAnswers: [...correct].sort().join(","),
      explanation,
      reportData: null,
      updatedDate: todayStr(),
      source: "",
    },
  };
}

const CSV_TEMPLATE =
  "text,type,optionA,optionB,optionC,optionD,correctAnswers,explanation\n" +
  "\"מהו המינון ההתחלתי של מונג'רו?\",בחירה יחידה,2.5 מ\"\"ג,5 מ\"\"ג,7.5 מ\"\"ג,10 מ\"\"ג,A,\"המינון ההתחלתי הוא 2.5 מ\"\"ג אחת לשבוע\"\n" +
  "\"את העט יש לאחסן במקרר\",נכון / לא נכון,,,,,A,\"נכון — 2°C עד 8°C\"\n" +
  "\"אילו תופעות לוואי נפוצות? (בחרי כל מה שנכון)\",בחירה מרובה,בחילה,שלשול,נשירת שיער,כאבי ראש,\"A,B\",\"בחילה ושלשול הן תופעות הלוואי הנפוצות ביותר\"\n";

// Prompt the manager can paste into any LLM together with her raw material —
// the model returns a CSV in exactly the format the importer expects.
const LLM_PROMPT = `אני צריכה ליצור קובץ CSV לייבוא שאלות ידע למערכת הדרכה.

הפורמט הנדרש — שורת כותרת ואז שורה לכל שאלה:
text,type,optionA,optionB,optionC,optionD,correctAnswers,explanation

כללים:
- text: טקסט השאלה בעברית
- type: אחד מהערכים הבאים בדיוק: "בחירה יחידה" / "נכון / לא נכון" / "בחירה מרובה"
- optionA עד optionD: אפשרויות התשובה. בשאלות "נכון / לא נכון" השאירי את כולן ריקות. בשאר הסוגים חובה למלא לפחות את A ו-B.
- correctAnswers: האות של התשובה הנכונה (A/B/C/D). בשאלות "נכון / לא נכון": A = נכון, B = לא נכון. בשאלות "בחירה מרובה" אפשר כמה אותיות מופרדות בפסיק, למשל "A,C".
- explanation: הסבר קצר שמוצג לעובד אחרי המענה (אפשר להשאיר ריק)
- אם ערך מכיל פסיק, מרכאות או ירידת שורה — עטפי אותו במרכאות כפולות, ומרכאות בתוך הטקסט הכפילי ("").

צרי לי CSV תקין לפי החומר שאדביק למטה. החזירי אך ורק את תוכן ה-CSV בבלוק קוד, בלי הסברים.

החומר שלי:
[הדביקי כאן את השאלות או חומר הלימוד שלך, בכל פורמט]`;

function ImportTab() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function downloadTemplate() {
    // BOM so Excel opens Hebrew correctly
    const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "campus-questions-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(LLM_PROMPT).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }

  function loadCsvText(text: string, sourceName: string) {
    setDone(null);
    setFileName(sourceName);
    // Strip a markdown code fence if the text was copied from an LLM answer
    const cleaned = text.replace(/^\s*```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "");
    const parsed = parseCsv(cleaned);
    // Skip a header row if it looks like one
    const body = parsed.length > 0 && /^text$/i.test(parsed[0][0]?.trim() ?? "") ? parsed.slice(1) : parsed;
    setRows(body.map((cells, i) => toImportRow(cells, i + (body === parsed ? 1 : 2))));
  }

  function handleFile(file: File) {
    file.text().then(text => loadCsvText(text, file.name));
  }

  async function handleImport() {
    if (!rows || importing) return;
    const valid = rows.filter(r => r.errors.length === 0);
    setImporting(true);
    try {
      for (const r of valid) {
        await fetch("/api/campus/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r.data),
        });
      }
      setDone(valid.length);
      setRows(null);
      setFileName("");
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows?.filter(r => r.errors.length === 0).length ?? 0;
  const errorRows = rows?.filter(r => r.errors.length > 0) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} dir="rtl">
      {/* AI-assisted flow — the main path */}
      <div style={{ padding: "14px 16px", borderRadius: 14, background: `linear-gradient(135deg, ${R.tint} 0%, #FFFFFF 100%)`, border: `1px solid ${R.border}` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: R.deep, margin: 0 }}>✨ ייבוא שאלות בעזרת AI — הדרך הקלה</p>
        <p style={{ fontSize: 12, color: "#475569", margin: "6px 0 0", lineHeight: 1.7 }}>
          1. לחצי על <b>העתקת פרומפט</b> והדביקי אותו בכל צ&apos;אט AI (ChatGPT, Claude, Gemini...).<br/>
          2. הדביקי אחריו את חומר הלימוד או השאלות שלך — בכל פורמט, אפילו מבולגן.<br/>
          3. העתיקי את ה-CSV שה-AI מחזיר, והדביקי אותו בתיבה למטה — זהו.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={copyPrompt} style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            background: promptCopied ? R.green : R.dark, color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)", transition: "background 0.2s",
          }}>{promptCopied ? "✓ הועתק!" : "📋 העתקת פרומפט"}</button>
          <button onClick={() => setPasteOpen(o => !o)} style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            background: "#fff", border: `1px solid ${R.border}`, color: R.deep, cursor: "pointer",
          }}>{pasteOpen ? "סגירת תיבת ההדבקה" : "הדבקת התוצאה מה-AI"}</button>
        </div>
      </div>

      {/* Paste box for the LLM's CSV output */}
      {pasteOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea rows={6} value={pasteText} onChange={e => setPasteText(e.target.value)}
            dir="ltr"
            placeholder={"text,type,optionA,optionB,optionC,optionD,correctAnswers,explanation\n..."}
            style={{
              width: "100%", fontSize: 12, fontFamily: "monospace", border: "1px solid #E2E8F0",
              borderRadius: 12, padding: "10px 12px", resize: "vertical", outline: "none",
              background: "#FAFBFC",
            }} />
          <button onClick={() => { if (pasteText.trim()) loadCsvText(pasteText, "הדבקה"); }}
            disabled={!pasteText.trim()}
            style={{
              alignSelf: "flex-start", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: R.dark, color: "#fff", border: "none", cursor: "pointer",
              opacity: pasteText.trim() ? 1 : 0.4,
            }}>בדיקת התוכן ↓</button>
        </div>
      )}

      {/* Manual path — file upload, secondary */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "14px 16px", borderRadius: 14, border: "2px dashed #CBD5E1",
          background: "#FAFBFC", cursor: "pointer", textAlign: "center",
        }}>
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          <svg viewBox="0 0 48 48" width="20" height="20" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 28v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-8"/>
            <path d="M24 8v22"/><path d="M16 16l8-8 8 8"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            {fileName && fileName !== "הדבקה" ? `נבחר: ${fileName}` : "או העלאת קובץ CSV (שמור מ-Excel בפורמט CSV UTF-8)"}
          </span>
        </label>
        <button onClick={downloadTemplate} title="קובץ CSV לדוגמה למילוי ידני ב-Excel" style={{
          padding: "10px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
          background: "#fff", border: "1px solid #E2E8F0", color: "#64748b", cursor: "pointer",
        }}>⬇ תבנית</button>
      </div>

      {done !== null && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: R.greenBg, border: `1px solid ${R.greenBrd}`, fontSize: 13, fontWeight: 600, color: R.green }}>
          ✓ {done} שאלות נוספו לבנק השאלות
        </div>
      )}

      {/* Preview */}
      {rows && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
              <b>{validCount}</b> שאלות תקינות{errorRows.length > 0 && <> · <span style={{ color: "#DC2626" }}>{errorRows.length} שורות עם שגיאות (ידולגו)</span></>}
            </p>
            <button onClick={handleImport} disabled={validCount === 0 || importing} style={{
              padding: "9px 18px", borderRadius: 10, border: "none",
              background: R.dark, color: "#fff", fontSize: 13, fontWeight: 700,
              opacity: validCount === 0 || importing ? 0.4 : 1,
              boxShadow: "0 4px 12px -4px rgba(215,37,47,0.45)", cursor: "pointer",
            }}>{importing ? "מייבא..." : `ייבוא ${validCount} שאלות`}</button>
          </div>

          <div style={{ border: "1px solid #F1F5F9", borderRadius: 14, overflow: "hidden", background: "#fff", maxHeight: 320, overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "40px 110px 1fr",
                padding: "9px 14px", borderBottom: i === rows.length - 1 ? "none" : "1px solid #F8FAFC",
                alignItems: "center", gap: 8,
                background: r.errors.length > 0 ? "#FEF2F2" : "#fff",
              }}>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{r.line}</span>
                {r.errors.length > 0 ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>{r.errors[0]}</span>
                ) : (
                  <TypeBadge type={r.data.type} />
                )}
                <span style={{ fontSize: 12, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.data.text || "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Horizontal bar chart ─────────────────────────────────────────────────────
// Single-series magnitude ranking — one flat hue (bar length already encodes
// the value; color doesn't need to double-encode rank), 4px rounded data-ends,
// direct value labels instead of a legend (a single series needs none).

// Most-missed questions, broken down by who missed them — so the manager can
// tell a problem with the question (many different employees miss it) from a
// problem with one employee (the misses pile up on one name).

interface MissedQuestionRow {
  id: number;
  text: string;
  wrong: number;                 // total wrong attempts, whole team
  attemptedBy: number;           // distinct employees who answered it
  byEmployee: { id: number; name: string; color: string; wrong: number; total: number }[]; // wrong > 0, most wrong first
  alwaysRight: string[];         // answered it, never wrong
}

function buildMissedQuestions(sessions: Session[]): MissedQuestionRow[] {
  const byQ = new Map<number, { text: string; emps: Map<number, { id: number; name: string; color: string; wrong: number; total: number }> }>();
  sessions.forEach(s => s.attempts.forEach(a => {
    const q = byQ.get(a.question.id) ?? { text: a.question.text, emps: new Map() };
    const e = q.emps.get(s.employee.id) ?? { ...s.employee, wrong: 0, total: 0 };
    e.total += 1;
    if (!a.answeredCorrectly) e.wrong += 1;
    q.emps.set(s.employee.id, e);
    byQ.set(a.question.id, q);
  }));
  return [...byQ.entries()]
    .map(([id, q]) => {
      const emps = [...q.emps.values()];
      const byEmployee = emps.filter(e => e.wrong > 0).sort((a, b) => b.wrong - a.wrong || b.total - a.total);
      return {
        id, text: q.text,
        wrong: byEmployee.reduce((n, e) => n + e.wrong, 0),
        attemptedBy: emps.length,
        byEmployee,
        alwaysRight: emps.filter(e => e.wrong === 0).map(e => e.name),
      };
    })
    .filter(q => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.byEmployee.length - a.byEmployee.length);
}

// Rough diagnosis: widespread misses point at the question, misses piled on
// one employee point at her. Needs at least two employees to compare.
function diagnose(q: MissedQuestionRow): { text: string; tone: "question" | "employee" | "neutral" } {
  if (q.attemptedBy < 2) return { text: "רק עובדת אחת ענתה על השאלה — אין עדיין מספיק נתונים להשוואה", tone: "neutral" };
  const missedShare = q.byEmployee.length / q.attemptedBy;
  if (missedShare >= 0.5) return { text: "רוב העובדות שענו טעו — כדאי לבדוק את ניסוח השאלה או את התשובה הנכונה", tone: "question" };
  const top = q.byEmployee[0];
  if (top && top.wrong / q.wrong >= 0.6) return { text: `הטעויות מרוכזות אצל ${top.name} — כדאי לחזור איתה על הנושא`, tone: "employee" };
  return { text: "הטעויות מפוזרות בין כמה עובדות", tone: "neutral" };
}

const DIAG_STYLE = {
  question: { bg: "#FEF3C7", fg: "#92400E", icon: "❓" },
  employee: { bg: "#EDE9FE", fg: "#5B21B6", icon: "👤" },
  neutral:  { bg: "#F1F5F9", fg: "#475569", icon: "ℹ️" },
} as const;

const MISSED_PREVIEW = 6;

function MissedQuestionsBreakdown({ sessions }: { sessions: Session[] }) {
  const [showAll, setShowAll] = useState(false);
  const questions = buildMissedQuestions(sessions);
  const shown = showAll ? questions : questions.slice(0, MISSED_PREVIEW);

  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: "#fff", border: "1px solid #F1F5F9" }} dir="rtl">
      <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", margin: 0 }}>השאלות שהכי הרבה טעו בהן — ומי טעתה</p>
      <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 12px" }}>
        לכל שאלה: אילו עובדות טעו וכמה פעמים (טעויות / פעמים שענתה) — כדי להבין אם הבעיה בשאלה או אצל נציגה מסוימת
      </p>
      {questions.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "16px 0" }}>אין טעויות עדיין</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((q, i) => {
            const d = diagnose(q);
            const ds = DIAG_STYLE[d.tone];
            return (
              <div key={q.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #F1F5F9", background: "#FCFCFD" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#94A3B8", fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 16 }}>{i + 1}.</span>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0F172A", margin: 0, lineHeight: 1.5 }}>{q.text}</p>
                  <div style={{ textAlign: "left", flexShrink: 0 }}>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, fontWeight: 800 }}>
                      {q.wrong} טעויות
                    </span>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>
                      {q.byEmployee.length} מתוך {q.attemptedBy} עובדות טעו
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingInlineStart: 26 }}>
                  {q.byEmployee.map(e => (
                    <span key={e.id} title={`${e.name}: ${e.wrong} טעויות מתוך ${e.total} פעמים שענתה`} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999,
                      background: "#fff", border: "1px solid #FECACA", fontSize: 12,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color }} />
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{e.name}</span>
                      <span style={{ fontWeight: 800, color: "#B91C1C", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{e.wrong}/{e.total}</span>
                    </span>
                  ))}
                </div>
                {q.alwaysRight.length > 0 && (
                  <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 0", paddingInlineStart: 26 }}>
                    <span style={{ color: R.green, fontWeight: 700 }}>✓ ענו נכון:</span> {q.alwaysRight.join(", ")}
                  </p>
                )}
                <p style={{
                  display: "inline-block", fontSize: 11, fontWeight: 600, margin: "8px 0 0", marginInlineStart: 26,
                  padding: "3px 10px", borderRadius: 8, background: ds.bg, color: ds.fg,
                }}>{ds.icon} {d.text}</p>
              </div>
            );
          })}
          {questions.length > MISSED_PREVIEW && (
            <button onClick={() => setShowAll(v => !v)} style={{
              alignSelf: "center", fontSize: 12, fontWeight: 600, color: R.dark, background: "none", border: "none", cursor: "pointer",
            }}>
              {showAll ? "הצג פחות" : `הצג את כל ${questions.length} השאלות`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Reports ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [data, setData]           = useState<{ sessions: Session[]; abandonedCount: number } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [filterEmpId, setFilterEmpId] = useState<number | null>(null);
  const [onlyFailed, setOnlyFailed]   = useState(false);

  useEffect(() => {
    fetch("/api/campus/sessions").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-sm text-gray-400 animate-pulse">טוען...</div>;
  if (!data) return null;

  const { sessions, abandonedCount } = data;

  // Build employee map
  const employeeMap = new Map<number, { id: number; name: string; color: string }>();
  sessions.forEach(s => employeeMap.set(s.employee.id, s.employee));
  const employees = [...employeeMap.values()];

  // KPI calculations
  const allAttempts = sessions.flatMap(s => s.attempts);
  const correctAttempts = allAttempts.filter(a => a.answeredCorrectly).length;
  const accuracy = allAttempts.length > 0 ? Math.round(correctAttempts / allAttempts.length * 100) : 0;
  // Questions answered as part of a session that was actually finished —
  // distinct from "ניסיונות" below, which also counts attempts from
  // abandoned/incomplete sessions.
  const answeredQuestions = sessions
    .filter(s => s.completedAt)
    .reduce((sum, s) => sum + s.attempts.length, 0);

  // Flatten rows
  const rows = sessions
    .filter(s => !filterEmpId || s.employee.id === filterEmpId)
    .flatMap(s => s.attempts.map(a => ({
      employee: s.employee,
      date: s.date,
      questionText: a.question.text,
      answeredCorrectly: a.answeredCorrectly,
    })))
    .filter(r => !onlyFailed || !r.answeredCorrectly);

  return (
    // No fixed height here — this tab's content grows to its natural size and
    // the panel around it (CampusDashboard's tab body) scrolls. A fixed
    // height + flex:1 on the table below used to clip rows once the content
    // above it (KPIs, charts) got tall enough to fill the available space.
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }} dir="rtl">
        {[
          { label: "שאלות שנענו", value: String(answeredQuestions) },
          { label: "שיעור הצלחה", value: `${accuracy}%`, tint: true },
          { label: "ניסיונות", value: String(allAttempts.length) },
          { label: "שאלות נטושות", value: String(abandonedCount) },
        ].map(({ label, value, tint }) => (
          <div key={label} style={{
            padding: "12px 14px", borderRadius: 12,
            background: tint ? `linear-gradient(135deg, ${R.tint} 0%, #FFFFFF 100%)` : "#fff",
            border: `1px solid ${tint ? R.border : "#F1F5F9"}`,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", margin: 0,
              textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "4px 0 0",
              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Most-missed questions × who missed them — always across the whole
          team, regardless of the employee filter below, so a question's misses
          can be compared between employees. */}
      <MissedQuestionsBreakdown sessions={sessions} />

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }} dir="rtl">
        <button onClick={() => setFilterEmpId(null)} style={{
          padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: !filterEmpId ? R.dark : "#fff",
          color: !filterEmpId ? "#fff" : "#6B7280",
          border: `1px solid ${!filterEmpId ? R.dark : "#E2E8F0"}`,
        }}>כולם</button>
        {employees.map(e => (
          <button key={e.id} onClick={() => setFilterEmpId(e.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: filterEmpId === e.id ? e.color : "#fff",
            color: filterEmpId === e.id ? "#fff" : "#334155",
            border: `1px solid ${filterEmpId === e.id ? e.color : "#E2E8F0"}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%",
              background: filterEmpId === e.id ? "#fff" : e.color }} />
            {e.name}
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: "auto",
          cursor: "pointer", fontSize: 12, color: "#64748b" }}>
          <input type="checkbox" checked={onlyFailed} onChange={e => setOnlyFailed(e.target.checked)}
            style={{ accentColor: R.accent }} />
          הצג רק שאלות שנכשלו
        </label>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm" dir="rtl">אין נתונים להצגה</div>
      ) : (
        <div style={{ border: "1px solid #F1F5F9", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "110px 80px 1fr 80px",
            padding: "10px 16px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9",
            fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em",
            textTransform: "uppercase",
          }} dir="rtl">
            <span>עובד</span><span>תאריך</span><span>שאלה</span>
            <span style={{ textAlign: "center" }}>תוצאה</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "110px 80px 1fr 80px",
              padding: "10px 16px", borderBottom: i === rows.length - 1 ? "none" : "1px solid #F8FAFC",
              alignItems: "center",
            }} dir="rtl">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.employee.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{r.employee.name}</span>
              </span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{r.date}</span>
              <span style={{ fontSize: 12, color: "#475569", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{r.questionText}</span>
              <span style={{ textAlign: "center" }}>
                {r.answeredCorrectly ? (
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: R.greenBg,
                    display: "inline-grid", placeItems: "center",
                  }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={R.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12 10 17 19 7"/>
                    </svg>
                  </span>
                ) : (
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: "#FEF2F2",
                    display: "inline-grid", placeItems: "center",
                  }}>
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                    </svg>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard Panel ──────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "settings",  label: "הגדרות" },
  { id: "questions", label: "בנק שאלות" },
  { id: "checklist", label: "צ'קליסט כניסה" },
  { id: "import",    label: "ייבוא" },
  { id: "reports",   label: "דוחות" },
];

export default function CampusDashboard({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("settings");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden" dir="rtl"
        style={{
          width: 780, maxWidth: "95vw",
          borderTopRightRadius: 24, borderBottomRightRadius: 24,
          background: "#FFFFFF",
          border: `1px solid ${R.border}`,
          boxShadow: R.shadow,
        }}>

        {/* Red accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${R.accent} 20%, ${R.accent} 80%, transparent 100%)` }} />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 28px 14px", borderBottom: "1px solid #F1F5F9",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10, background: R.tint,
                display: "grid", placeItems: "center", fontSize: 18,
              }}>📚</span>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  לימוד קמפוס
                </h2>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0", fontWeight: 600, letterSpacing: "0.04em" }}>
                  Lilly Campus · Mounjaro Knowledge
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "0 28px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              position: "relative", padding: "10px 16px 14px",
              fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? R.deep : "#64748b",
              background: "transparent", border: "none", cursor: "pointer",
            }}>
              {t.label}
              {tab === t.id && (
                <span style={{
                  position: "absolute", bottom: 0, left: 8, right: 8, height: 2,
                  background: R.deep, borderRadius: 999,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>
          {tab === "settings"  && <SettingsTab />}
          {tab === "questions" && <QuestionsTab />}
          {tab === "checklist" && <ChecklistTab />}
          {tab === "import"    && <ImportTab />}
          {tab === "reports"   && <ReportsTab />}
        </div>
      </aside>
    </>
  );
}
