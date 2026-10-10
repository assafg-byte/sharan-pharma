"use client";

import { useState } from "react";
import type { BlankOption, ReportExerciseData, ReportSection } from "./types";
import { blankSections, newId, validateReportExercise } from "./types";
import ReportExerciseCard from "./ReportExerciseCard";

const W = {
  accent: "#D7252F",
  dark:   "#C81E13",
  border: "#E2E8F0",
  tint:   "#FFEBEC",
};

const STEPS = ["תרחיש", "מבנה הדיווח", "אפשרויות לשדות הגרירה", "תצוגה מקדימה"];

interface Props {
  title: string;
  value: ReportExerciseData;
  onChange: (data: ReportExerciseData) => void;
}

export default function ReportExerciseWizard({ title, value, onChange }: Props) {
  const [step, setStep] = useState(0);
  const errors = validateReportExercise(title, value);

  function updateSection(id: string, patch: Partial<ReportSection>) {
    onChange({ ...value, sections: value.sections.map(s => (s.id === id ? ({ ...s, ...patch } as ReportSection) : s)) });
  }
  function removeSection(id: string) {
    onChange({ ...value, sections: value.sections.filter(s => s.id !== id) });
  }
  function moveSection(id: string, dir: -1 | 1) {
    const idx = value.sections.findIndex(s => s.id === id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= value.sections.length) return;
    const sections = [...value.sections];
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    onChange({ ...value, sections });
  }
  function addSection(type: ReportSection["type"]) {
    const base = { id: newId(), header: "" };
    const section: ReportSection =
      type === "fields" ? { ...base, type, fields: [] }
      : type === "text" ? { ...base, type, text: "" }
      : { ...base, type, options: [] };
    onChange({ ...value, sections: [...value.sections, section] });
  }

  return (
    <div className="space-y-4">
      {/* Step tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {STEPS.map((label, i) => (
          <button key={i} type="button" onClick={() => setStep(i)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
            border: `1.5px solid ${step === i ? W.dark : W.border}`,
            background: step === i ? W.dark : "#fff",
            color: step === i ? "#fff" : "#64748b",
          }}>{i + 1}. {label}</button>
        ))}
      </div>

      {step === 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">תיאור התרחיש (מה הלקוחה אמרה)</label>
          <textarea rows={5} value={value.scenario} onChange={e => onChange({ ...value, scenario: e.target.value })}
            className="w-full text-sm border rounded-xl px-3 py-2 resize-none focus:outline-none"
            style={{ borderColor: W.border }}
            placeholder="לדוגמה: הלקוחה התקשרה ודיווחה ש..." />
        </div>
      )}

      {step === 1 && (
        <SectionsStep value={value} updateSection={updateSection} removeSection={removeSection}
          moveSection={moveSection} addSection={addSection} />
      )}

      {step === 2 && <BlanksOptionsStep value={value} updateSection={updateSection} />}

      {step === 3 && (
        errors.length > 0 ? (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", margin: "0 0 6px" }}>יש להשלים לפני שמירה:</p>
            <ul style={{ fontSize: 12, color: "#B91C1C", margin: 0, paddingRight: 18, lineHeight: 1.7 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{ borderRadius: 16, border: "1px solid #F1F5F9", padding: 12, background: "#FAFAFA" }}>
            <ReportExerciseCard data={value} onSubmit={() => {}} />
          </div>
        )
      )}

      {/* Step nav */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={{ fontSize: 12, fontWeight: 600, color: step === 0 ? "#CBD5E1" : "#64748b", background: "none", border: "none" }}>
          → הקודם
        </button>
        <button type="button" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}
          style={{ fontSize: 12, fontWeight: 600, color: step === STEPS.length - 1 ? "#CBD5E1" : W.accent, background: "none", border: "none" }}>
          הבא ←
        </button>
      </div>
    </div>
  );
}

// ── Step 2: report sections ────────────────────────────────────────────────
const SECTION_TYPE_LABEL: Record<ReportSection["type"], string> = {
  fields: "טבלת פרטים (מולא)",
  text:   "טקסט (מולא)",
  blank:  "שדה לגרירה (ריק)",
};

function SectionsStep({ value, updateSection, removeSection, moveSection, addSection }: {
  value: ReportExerciseData;
  updateSection: (id: string, patch: Partial<ReportSection>) => void;
  removeSection: (id: string) => void;
  moveSection: (id: string, dir: -1 | 1) => void;
  addSection: (type: ReportSection["type"]) => void;
}) {
  return (
    <div className="space-y-3">
      {value.sections.map((s, i) => (
        <div key={s.id} style={{ border: `1px solid ${W.border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: W.accent, background: W.tint, padding: "2px 8px", borderRadius: 999 }}>
              {SECTION_TYPE_LABEL[s.type]}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => moveSection(s.id, -1)} disabled={i === 0}
                style={{ background: "none", border: "none", color: i === 0 ? "#E2E8F0" : "#64748b" }} title="הזז למעלה">▲</button>
              <button type="button" onClick={() => moveSection(s.id, 1)} disabled={i === value.sections.length - 1}
                style={{ background: "none", border: "none", color: i === value.sections.length - 1 ? "#E2E8F0" : "#64748b" }} title="הזז למטה">▼</button>
              <button type="button" onClick={() => removeSection(s.id)}
                style={{ background: "none", border: "none", color: "#DC2626" }} title="הסר סעיף">✕</button>
            </div>
          </div>

          <input value={s.header} onChange={e => updateSection(s.id, { header: e.target.value })}
            placeholder="כותרת הסעיף"
            className="w-full text-sm border rounded-lg px-3 py-1.5 mb-2 focus:outline-none"
            style={{ borderColor: W.border }} />

          {s.type === "fields" && <FieldsEditor section={s} onChange={patch => updateSection(s.id, patch)} />}
          {s.type === "text" && (
            <textarea rows={3} value={s.text} onChange={e => updateSection(s.id, { text: e.target.value })}
              className="w-full text-sm border rounded-lg px-3 py-1.5 resize-none focus:outline-none"
              style={{ borderColor: W.border }} placeholder="טקסט מולא..." />
          )}
          {s.type === "blank" && (
            <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
              {s.options.length} אפשרויות הוגדרו — ניתן לערוך בשלב הבא
            </p>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["fields", "text", "blank"] as const).map(t => (
          <button key={t} type="button" onClick={() => addSection(t)} style={{
            fontSize: 12, fontWeight: 600, color: W.accent, background: "#fff",
            border: `1px solid ${W.border}`, borderRadius: 10, padding: "6px 12px",
          }}>+ {SECTION_TYPE_LABEL[t]}</button>
        ))}
      </div>
    </div>
  );
}

function FieldsEditor({ section, onChange }: {
  section: Extract<ReportSection, { type: "fields" }>;
  onChange: (patch: Partial<ReportSection>) => void;
}) {
  function setField(i: number, key: "label" | "value", val: string) {
    onChange({ fields: section.fields.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)) });
  }
  function addField() {
    onChange({ fields: [...section.fields, { label: "", value: "" }] });
  }
  function removeField(i: number) {
    onChange({ fields: section.fields.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-1.5">
      {section.fields.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input value={f.label} onChange={e => setField(i, "label", e.target.value)} placeholder="שדה"
            className="flex-1 text-xs border rounded-lg px-2 py-1 focus:outline-none" style={{ borderColor: W.border }} />
          <input value={f.value} onChange={e => setField(i, "value", e.target.value)} placeholder="ערך"
            className="flex-1 text-xs border rounded-lg px-2 py-1 focus:outline-none" style={{ borderColor: W.border }} />
          <button type="button" onClick={() => removeField(i)} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 12 }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addField} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 600, color: W.accent }}>
        + הוסף שדה
      </button>
    </div>
  );
}

// ── Step 3: options per blank ──────────────────────────────────────────────
function BlanksOptionsStep({ value, updateSection }: {
  value: ReportExerciseData;
  updateSection: (id: string, patch: Partial<ReportSection>) => void;
}) {
  const blanks = blankSections(value);
  if (blanks.length === 0) {
    return <p style={{ fontSize: 13, color: "#94A3B8" }}>הוסיפי שדה לגרירה בשלב הקודם כדי להגדיר עבורו אפשרויות.</p>;
  }
  return (
    <div className="space-y-4">
      {blanks.map((b, bi) => (
        <div key={b.id} style={{ border: `1px solid ${W.border}`, borderRadius: 12, padding: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
            שדה גרירה {bi + 1}: {b.header || "(ללא כותרת)"}
          </p>
          <div className="space-y-2">
            {b.options.map((o, oi) => (
              <OptionEditor key={o.id} option={o}
                onChange={patch => updateSection(b.id, {
                  options: b.options.map((opt, idx) => (idx === oi ? { ...opt, ...patch } : opt)),
                })}
                onSetCorrect={() => updateSection(b.id, {
                  options: b.options.map((opt, idx) => ({ ...opt, correct: idx === oi })),
                })}
                onRemove={() => updateSection(b.id, { options: b.options.filter((_, idx) => idx !== oi) })}
              />
            ))}
          </div>
          {b.options.length < 5 && (
            <button type="button" onClick={() => updateSection(b.id, {
              options: [...b.options, { id: newId(), text: "", correct: b.options.length === 0, feedback: "" }],
            })} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 600, color: W.accent, marginTop: 6 }}>
              + הוסף אפשרות
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function OptionEditor({ option, onChange, onSetCorrect, onRemove }: {
  option: BlankOption;
  onChange: (patch: Partial<BlankOption>) => void;
  onSetCorrect: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${option.correct ? "#86EFAC" : W.border}`,
      background: option.correct ? "#F0FDF4" : "#fff", borderRadius: 10, padding: 8,
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <button type="button" onClick={onSetCorrect} title="סמן כתשובה נכונה" style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          border: `2px solid ${option.correct ? "#16A34A" : "#CBD5E1"}`,
          background: option.correct ? "#16A34A" : "#fff", color: "#fff",
          fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center",
        }}>{option.correct ? "✓" : ""}</button>
        <textarea rows={2} value={option.text} onChange={e => onChange({ text: e.target.value })}
          placeholder="ניסוח האפשרות..."
          className="flex-1 text-sm border rounded-lg px-2 py-1 resize-none focus:outline-none" style={{ borderColor: W.border }} />
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 12, marginTop: 2 }}>✕</button>
      </div>
      {!option.correct && (
        <input value={option.feedback ?? ""} onChange={e => onChange({ feedback: e.target.value })}
          placeholder="משוב לתשובה שגויה (חובה)..."
          className="w-full text-xs border rounded-lg px-2 py-1 mt-2 focus:outline-none"
          style={{ borderColor: W.border }} />
      )}
    </div>
  );
}
