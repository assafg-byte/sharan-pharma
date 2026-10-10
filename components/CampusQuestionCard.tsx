"use client";

import { useState } from "react";
import ReportExerciseCard from "./reportExercise/ReportExerciseCard";
import type { ReportExerciseData } from "./reportExercise/types";

export interface Question {
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
  updatedDate?: string; // "YYYY-MM-DD" — shown to the employee; source is manager-only and never sent here
}

function fmtUpdatedDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

interface Props {
  question: Question;
  onSubmit: (answeredCorrectly: boolean, selected: Set<string>, blankAttempts?: Record<string, number>) => void;
}

// ── Lilly red palette ─────────────────────────────────────────────────────
const R = {
  accent:    "#D7252F",
  dark:      "#C81E13",
  deep:      "#9F1239",
  tint:      "#FFEBEC",
  border:    "#F5D5D2",
  green:     "#16A34A",
  greenBg:   "#F0FDF4",
  greenBrd:  "#86EFAC",
  greenText: "#15803D",
  red:       "#DC2626",
  redBg:     "#FEF2F2",
  redBrd:    "#FCA5A5",
};

// ── Confetti burst (Monday.com style) ─────────────────────────────────────
function CelebrationBurst() {
  const COLORS = ["#D7252F", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA", "#F472B6"];
  const COUNT = 14;
  const pieces = Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + (i % 2 ? 0.18 : -0.18);
    const dist  = 36 + (i % 3) * 10;
    return {
      dx:    Math.round(Math.cos(angle) * dist),
      dy:    Math.round(Math.sin(angle) * dist) + 8,
      rot:   `${(i * 47) % 360 + 200}deg`,
      color: COLORS[i % COLORS.length],
      size:  6 + (i % 2) * 2,
      delay: (i % 6) * 18,
    };
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Expanding ring */}
      <span style={{
        position: "absolute", left: 22, top: 22,
        width: 22, height: 22, marginLeft: -11, marginTop: -11,
        borderRadius: "50%", border: "2px solid #16A34A",
        animation: "campus-ring 700ms ease-out forwards",
      }} />
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: "absolute", left: 22, top: 22,
          width: p.size, height: p.size, borderRadius: 2,
          background: p.color,
          ["--dx" as string]: `${p.dx}px`,
          ["--dy" as string]: `${p.dy}px`,
          ["--rot" as string]: p.rot,
          animation: `campus-piece 1100ms cubic-bezier(.22,.61,.36,1) ${p.delay}ms forwards`,
          willChange: "transform, opacity",
        }} />
      ))}
    </div>
  );
}

// ── True / False big pair ─────────────────────────────────────────────────
function TFPair({
  selected, submitted, correctKey,
  onSelect,
}: {
  selected: Set<string>;
  submitted: boolean;
  correctKey: string;
  onSelect: (k: string) => void;
}) {
  const opts = [
    { key: "A", label: "נכון",    icon: "✓" },
    { key: "B", label: "לא נכון", icon: "✗" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }} dir="rtl">
      {opts.map(({ key, label, icon }) => {
        const isSel     = selected.has(key);
        const isCorrect = key === correctKey;
        let bg = "#fff", border = "#E5E7EB", color = "#374151", iconBg = key === "A" ? R.greenBg : R.redBg;
        if (submitted) {
          if (isCorrect) { bg = R.greenBg; border = R.greenBrd; color = R.greenText; iconBg = R.green; }
          else if (isSel) { bg = R.redBg; border = R.redBrd; color = R.red; iconBg = R.red; }
        } else if (isSel) {
          bg = R.tint; border = R.accent; color = R.deep; iconBg = R.accent;
        }
        return (
          <button key={key} type="button" disabled={submitted} onClick={() => onSelect(key)} style={{
            padding: "16px 12px", borderRadius: 14,
            border: `1.5px solid ${border}`, background: bg, color,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            fontSize: 14, fontWeight: 700,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, background: iconBg,
              display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800,
              color: submitted && (isCorrect || isSel) ? "#fff" : (isSel ? "#fff" : key === "A" ? R.green : R.red),
              transition: "background 0.15s",
            }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Option row (single / multi) ───────────────────────────────────────────
function OptionRow({
  letter, label, state, onSelect, onEliminate, submitted,
}: {
  letter: string; label: string;
  state: "idle" | "selected" | "eliminated" | "correct" | "wrong" | "missed";
  onSelect: () => void; onEliminate: (e: React.MouseEvent) => void;
  submitted: boolean;
}) {
  let bg = "#FFFFFF", border = "#E5E7EB", text = "#374151";
  let letterBg = "rgba(0,0,0,0.05)", letterFg = "#6B7280";
  let strike = false, dim = false;
  let trailing: React.ReactNode = null;

  if (state === "selected") {
    bg = R.tint; border = R.accent; text = R.deep;
    letterBg = R.accent; letterFg = "#fff";
  } else if (state === "eliminated") {
    bg = "#FAFAFA"; border = "#E5E7EB"; text = "#9CA3AF"; strike = true; dim = true;
  } else if (state === "correct") {
    bg = R.greenBg; border = R.greenBrd; text = R.greenText;
    letterBg = R.green; letterFg = "#fff";
    trailing = <CheckMark />;
  } else if (state === "wrong") {
    bg = R.redBg; border = R.redBrd; text = R.red;
    letterBg = R.red; letterFg = "#fff";
    trailing = <XMark />;
  } else if (state === "missed") {
    bg = R.greenBg; border = R.greenBrd; text = R.greenText;
    letterBg = R.green; letterFg = "#fff";
    trailing = <CheckMark />;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} dir="rtl">
      {/* Eliminate ghost button — 36×44 touch target */}
      <button type="button" onClick={onEliminate} disabled={submitted}
        aria-label={`דחה אפשרות ${letter}`}
        style={{
          width: 36, height: 44, flexShrink: 0,
          display: "grid", placeItems: "center",
          background: "transparent", border: "none",
          color: state === "eliminated" ? "#6B7280" : "#D1D5DB",
          borderRadius: 10,
          cursor: submitted ? "default" : "pointer",
        }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>

      {/* Option button */}
      <button type="button" disabled={submitted} onClick={onSelect} style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px", borderRadius: 14,
        background: bg, border: `1.5px solid ${border}`, color: text,
        opacity: dim ? 0.55 : 1, transition: "all 0.15s",
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: letterBg, color: letterFg,
          display: "grid", placeItems: "center",
          fontSize: 11, fontWeight: 800,
        }}>{letter}</span>
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 500, lineHeight: 1.4, textAlign: "right",
          textDecoration: strike ? "line-through" : "none",
        }}>{label}</span>
        {trailing && <span style={{ flexShrink: 0 }}>{trailing}</span>}
      </button>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#16A34A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 12 10 17 19 7"/>
    </svg>
  );
}
function XMark() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#DC2626" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
    </svg>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────
export default function CampusQuestionCard({ question, onSubmit }: Props) {
  if (question.type === "REPORT_DRAG_DROP" && question.reportData) {
    return <ReportExerciseCard data={question.reportData} onSubmit={onSubmit} />;
  }
  return <StandardQuestionCard question={question} onSubmit={onSubmit} />;
}

function StandardQuestionCard({ question, onSubmit }: Props) {
  // Bug 7: no useEffect reset needed — parent renders this with key={question.id},
  // so React unmounts and remounts on every question change. Initial useState
  // values are already correct; the effect was redundant and caused extra renders.
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [eliminated, setEliminated]   = useState<Set<string>>(new Set());
  const [submitted, setSubmitted]     = useState(false);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);

  const isTF   = question.type === "TRUE_FALSE";
  const isMulti = question.type === "MULTI_SELECT";
  const correctSet = new Set(question.correctAnswers.split(",").map(s => s.trim()));

  const options: { key: string; label: string }[] = isTF
    ? [{ key: "A", label: "נכון" }, { key: "B", label: "לא נכון" }]
    : [
        { key: "A", label: question.optionA },
        { key: "B", label: question.optionB },
        ...(question.optionC ? [{ key: "C", label: question.optionC }] : []),
        ...(question.optionD ? [{ key: "D", label: question.optionD }] : []),
      ];

  function handleSelect(key: string) {
    if (submitted) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (!isMulti) { next.clear(); next.add(key); } else {
        if (next.has(key)) next.delete(key); else next.add(key);
      }
      return next;
    });
    setEliminated(prev => { const n = new Set(prev); n.delete(key); return n; });
  }

  function handleEliminate(e: React.MouseEvent, key: string) {
    e.stopPropagation();
    if (submitted) return;
    setEliminated(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    setSelected(prev => { const n = new Set(prev); n.delete(key); return n; });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    const correct = selected.size === correctSet.size && [...selected].every(k => correctSet.has(k));
    setAnsweredCorrectly(correct);
    setSubmitted(true);
  }

  function handleContinue() { onSubmit(answeredCorrectly, selected); }

  const correctKey = [...correctSet][0]; // for TF

  return (
    <div dir="rtl">
      {/* Question text */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", lineHeight: 1.55, margin: question.updatedDate ? "0 0 6px" : "0 0 18px" }}>
        {question.text}
      </h2>
      {question.updatedDate && (
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 14px" }}>
          עודכן לאחרונה: {fmtUpdatedDate(question.updatedDate)}
        </p>
      )}

      {/* Multi-select hint */}
      {isMulti && !submitted && (
        <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10, textAlign: "right" }}>
          סמן/י את כל התשובות הנכונות
        </p>
      )}

      {/* Options — TFPair or OptionRows */}
      {isTF ? (
        <TFPair
          selected={selected}
          submitted={submitted}
          correctKey={correctKey}
          onSelect={k => handleSelect(k)}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {options.map(({ key, label }) => {
            const isSel  = selected.has(key);
            const isElim = eliminated.has(key);
            const isCrct = correctSet.has(key);

            let state: "idle" | "selected" | "eliminated" | "correct" | "wrong" | "missed" = "idle";
            if (submitted) {
              if (isCrct && isSel) state = "correct";
              else if (isCrct && !isSel) state = "missed";
              else if (!isCrct && isSel) state = "wrong";
            } else if (isSel) state = "selected";
            else if (isElim) state = "eliminated";

            return (
              <OptionRow key={key}
                letter={key} label={label} state={state} submitted={submitted}
                onSelect={() => handleSelect(key)}
                onEliminate={e => handleEliminate(e, key)}
              />
            );
          })}
        </div>
      )}

      {/* Feedback panel — fires after submit */}
      {submitted && (
        <div style={{
          position: "relative", overflow: "visible",
          borderRadius: 14, padding: "12px 14px", marginBottom: 14,
          background: answeredCorrectly ? R.greenBg : R.redBg,
          border: `1px solid ${answeredCorrectly ? R.greenBrd : R.redBrd}`,
          display: "flex", gap: 10, alignItems: "flex-start",
          animation: "campus-fade-in 320ms ease-out both",
        }}>
          {/* Celebration burst fires only on correct */}
          {answeredCorrectly && <CelebrationBurst />}

          {/* Check / X circle */}
          <span style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            background: answeredCorrectly ? R.green : R.red,
            display: "grid", placeItems: "center",
            position: "relative", zIndex: 2,
            animation: answeredCorrectly ? "campus-pop 420ms cubic-bezier(.34,1.56,.64,1) both" : undefined,
          }}>
            {answeredCorrectly ? (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 12 10 17 19 7"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            )}
          </span>

          <div style={{ position: "relative", zIndex: 2, flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0,
              color: answeredCorrectly ? R.greenText : R.red }}>
              {answeredCorrectly ? "תשובה נכונה!" : "תשובה שגויה"}
            </p>
            {!answeredCorrectly && (
              <p style={{ fontSize: 12, color: "#4B5563", margin: "4px 0 0", lineHeight: 1.55 }}>
                התשובה הנכונה:{" "}
                <strong>{[...correctSet].map(k => options.find(o => o.key === k)?.label).filter(Boolean).join(", ")}</strong>
              </p>
            )}
            {question.explanation && (
              <p style={{ fontSize: 12, color: "#4B5563", margin: "4px 0 0", lineHeight: 1.55 }}>
                {question.explanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!submitted ? (
        <button onClick={handleSubmit} disabled={selected.size === 0} style={{
          width: "100%", padding: "12px 0", borderRadius: 12,
          background: R.dark, color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
          opacity: selected.size === 0 ? 0.35 : 1, cursor: selected.size === 0 ? "not-allowed" : "pointer",
          boxShadow: selected.size > 0 ? "0 6px 16px -4px rgba(215,37,47,0.4)" : "none",
          transition: "all 0.15s",
        }}>
          שלח תשובה
        </button>
      ) : (
        <button onClick={handleContinue} style={{
          width: "100%", padding: "12px 0", borderRadius: 12,
          background: R.dark, color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
          boxShadow: "0 6px 16px -4px rgba(215,37,47,0.4)",
        }}>
          הבנתי, המשך →
        </button>
      )}
    </div>
  );
}
