"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BlankOption, ReportExerciseData, ReportSection } from "./types";
import { blankSections } from "./types";

interface Props {
  data: ReportExerciseData;
  onSubmit: (answeredCorrectly: boolean, selected: Set<string>, blankAttempts?: Record<string, number>) => void;
}

// ── Palette (extends the Lilly red palette used by CampusQuestionCard) ────────
const P = {
  accent:           "#D7252F",
  dark:             "#C81E13",
  formBg:           "#1F3864",
  scenarioBg:       "#FFEBEC",
  scenarioBorder:   "#D7252F",
  blankBg:          "#FFFBEB",
  blankBorder:      "#FBBF24",
  blankLocked:      "#F3F4F6",
  blankLockedBorder:"#E5E7EB",
  green:            "#16A34A",
  greenBg:          "#F0FDF4",
  greenBrd:         "#86EFAC",
  red:              "#DC2626",
  redBg:            "#FEF2F2",
  redBrd:           "#FCA5A5",
  border:           "#E5E7EB",
};

const LETTERS = ["A", "B", "C", "D", "E"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function circled(n: number): string {
  return String.fromCodePoint(0x2460 + (n - 1)); // ① ② ③ ...
}

// ── Filled sections ────────────────────────────────────────────────────────
function FieldsSectionView({ section }: { section: Extract<ReportSection, { type: "fields" }> }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: P.formBg, margin: "0 0 6px" }}>{section.header}</p>
      {section.fields.map((f, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", gap: 8,
          padding: "4px 0", borderTop: i > 0 ? "1px solid #F1F5F9" : "none", fontSize: 12,
        }}>
          <span style={{ color: "#6B7280" }}>{f.label}</span>
          <span style={{ fontWeight: 700, color: "#111827", textAlign: "left" }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function TextSectionView({ section }: { section: Extract<ReportSection, { type: "text" }> }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: P.formBg, margin: "0 0 6px" }}>{section.header}</p>
      <p style={{ fontSize: 12, lineHeight: 1.65, color: "#374151", margin: 0 }}>{section.text}</p>
    </div>
  );
}

// ── Blank drop zone ────────────────────────────────────────────────────────
function BlankSectionView({
  section, blankNumber, state, shaking, feedbackText, answeredText, setRef, onDragOver, onDrop,
}: {
  section: Extract<ReportSection, { type: "blank" }>;
  blankNumber: number;
  state: "locked" | "active" | "done";
  shaking: boolean;
  feedbackText: string | null;
  answeredText?: string;
  setRef: (el: HTMLDivElement | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  let bg = P.blankLocked, border = P.blankLockedBorder, labelColor = "#9CA3AF";
  if (state === "active") { bg = P.blankBg; border = P.blankBorder; labelColor = "#92400E"; }
  if (state === "done")   { bg = P.greenBg; border = P.greenBrd;    labelColor = "#15803D"; }

  return (
    <div
      ref={setRef}
      data-blank-id={state === "active" ? section.id : undefined}
      onDragOver={state === "active" ? onDragOver : undefined}
      onDrop={state === "active" ? onDrop : undefined}
      style={{
        position: "relative", background: bg, border: `1.5px dashed ${border}`, borderRadius: 10,
        padding: "10px 12px", minHeight: 44, display: "flex", flexDirection: "column", gap: 4,
        opacity: state === "locked" ? 0.6 : 1,
        animation: shaking ? "campus-shake 0.45s ease-in-out" : undefined,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 800, color: labelColor, margin: 0 }}>
        {circled(blankNumber)} {section.header}
      </p>
      {state === "done" ? (
        <p style={{ fontSize: 12, fontWeight: 600, color: "#15803D", margin: 0, lineHeight: 1.5 }}>
          ✓ {answeredText}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: state === "active" ? "#B45309" : "#9CA3AF", margin: 0 }}>
          {state === "active" ? "גררי ניסוח לכאן" : "ממתין למילוי השדה הקודם"}
        </p>
      )}

      {feedbackText && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 5,
          background: P.redBg, border: `1px solid ${P.redBrd}`, color: P.red,
          borderRadius: 8, padding: "6px 10px", fontSize: 11, lineHeight: 1.5,
          maxWidth: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          animation: "campus-fade-in 200ms ease-out both",
        }}>
          {feedbackText}
        </div>
      )}
    </div>
  );
}

// ── Draggable option card ─────────────────────────────────────────────────
function OptionCard({
  option, letter, onDragStart, onTouchStart,
}: {
  option: BlankOption; letter: string;
  onDragStart: (e: React.DragEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onTouchStart={onTouchStart}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12,
        background: "#fff", border: `1.5px solid ${P.border}`, cursor: "grab",
        touchAction: "none", userSelect: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: P.accent, color: "#fff",
        display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800,
      }}>{letter}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.4, textAlign: "right" }}>
        {option.text}
      </span>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────
export default function ReportExerciseCard({ data, onSubmit }: Props) {
  const blanks = useMemo(() => blankSections(data), [data]);

  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [activeBlankIdx, setActiveBlankIdx] = useState(0);
  const bankOptions = useMemo(() => {
    const blank = blanks[activeBlankIdx];
    return blank ? shuffle(blank.options) : [];
  }, [activeBlankIdx, blanks]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ blankId: string; text: string } | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ optionId: string; text: string; letter: string; x: number; y: number } | null>(null);

  const blankRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll the newly-active blank into view.
  useEffect(() => {
    const blank = blanks[activeBlankIdx];
    if (!blank) return;
    blankRefs.current[blank.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeBlankIdx, blanks]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  if (!data || blanks.length === 0) return null;

  const allAnswered = blanks.every(b => answered[b.id]);

  function handleDrop(blankId: string, optionId: string) {
    const activeBlank = blanks[activeBlankIdx];
    if (!activeBlank || activeBlank.id !== blankId || answered[blankId]) return;

    const option = bankOptions.find(o => o.id === optionId);
    if (!option) return;

    setAttempts(prev => ({ ...prev, [blankId]: (prev[blankId] ?? 0) + 1 }));

    if (option.correct) {
      setFeedback(null);
      setAnswered(prev => ({ ...prev, [blankId]: optionId }));
      if (activeBlankIdx < blanks.length - 1) setActiveBlankIdx(i => i + 1);
    } else {
      setShakeId(blankId);
      setFeedback({ blankId, text: option.feedback ?? "" });
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShakeId(id => (id === blankId ? null : id)), 450);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(f => (f?.blankId === blankId ? null : f)), 2500);
    }
  }

  function handleContinue() {
    const allFirstTry = blanks.every(b => (attempts[b.id] ?? 0) === 1);
    onSubmit(allFirstTry, new Set(), attempts);
  }

  // ── Desktop HTML5 drag-and-drop ──
  function onOptionDragStart(e: React.DragEvent, optionId: string) {
    e.dataTransfer.setData("text/plain", optionId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onBlankDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onBlankDrop(e: React.DragEvent, blankId: string) {
    e.preventDefault();
    const optionId = e.dataTransfer.getData("text/plain");
    if (optionId) handleDrop(blankId, optionId);
  }

  // ── Touch drag-and-drop ──
  function onOptionTouchStart(e: React.TouchEvent, option: BlankOption, letter: string) {
    const t = e.touches[0];
    setTouchDrag({ optionId: option.id, text: option.text, letter, x: t.clientX, y: t.clientY });
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touchDrag) return;
    const t = e.touches[0];
    setTouchDrag(prev => (prev ? { ...prev, x: t.clientX, y: t.clientY } : null));
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchDrag) return;
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const blankEl = el?.closest("[data-blank-id]") as HTMLElement | null;
    if (blankEl?.dataset.blankId) handleDrop(blankEl.dataset.blankId, touchDrag.optionId);
    setTouchDrag(null);
  }

  return (
    <div dir="rtl" onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Header */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>
        השלמת משפטים
      </h2>

      {/* Scenario card */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", margin: "0 0 4px" }}>
        תרחיש:
      </p>
      <div style={{
        background: P.scenarioBg, borderRight: `4px solid ${P.scenarioBorder}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 14,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: "#7C2D12", margin: 0, fontWeight: 500 }}>
          {data.scenario}
        </p>
      </div>

      {/* Report form */}
      <div style={{ background: P.formBg, borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <h3 style={{ color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", margin: "0 0 10px" }}>
          {data.formTitle ?? "טופס דיווח"}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.sections.map(section => {
            if (section.type === "fields") return <FieldsSectionView key={section.id} section={section} />;
            if (section.type === "text")   return <TextSectionView key={section.id} section={section} />;
            return null;
          })}

          {/* Answers — framed like the fields/text sections above */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: P.formBg, margin: "0 0 6px" }}>תיאור התלונה:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {blanks.map((section, idx) => {
                const state: "locked" | "active" | "done" =
                  idx < activeBlankIdx || answered[section.id] ? "done" : idx === activeBlankIdx ? "active" : "locked";

                return (
                  <BlankSectionView
                    key={section.id}
                    section={section}
                    blankNumber={idx + 1}
                    state={state}
                    shaking={shakeId === section.id}
                    feedbackText={feedback?.blankId === section.id ? feedback.text : null}
                    answeredText={answered[section.id] ? section.options.find(o => o.id === answered[section.id])?.text : undefined}
                    setRef={el => { blankRefs.current[section.id] = el; }}
                    onDragOver={onBlankDragOver}
                    onDrop={e => onBlankDrop(e, section.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Options bank */}
      {!allAnswered ? (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          padding: 12, borderRadius: 14, background: "#FAFAFA", border: `1px solid ${P.border}`,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", margin: "0 0 2px" }}>
            גררי את הניסוח המתאים לתוך השדה המסומן
          </p>
          {bankOptions.map((option, i) => (
            <OptionCard
              key={option.id}
              option={option}
              letter={LETTERS[i]}
              onDragStart={e => onOptionDragStart(e, option.id)}
              onTouchStart={e => onOptionTouchStart(e, option, LETTERS[i])}
            />
          ))}
        </div>
      ) : (
        <button onClick={handleContinue} style={{
          width: "100%", padding: "12px 0", borderRadius: 12,
          background: P.dark, color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
          boxShadow: "0 6px 16px -4px rgba(215,37,47,0.4)",
        }}>
          הבנתי, המשך →
        </button>
      )}

      {/* Floating drag clone (touch only) */}
      {touchDrag && (
        <div style={{
          position: "fixed", left: touchDrag.x, top: touchDrag.y,
          transform: "translate(-50%, -120%) rotate(-2deg)",
          zIndex: 9999, pointerEvents: "none", maxWidth: 220,
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12,
          background: "#fff", border: `1.5px solid ${P.accent}`, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: P.accent, color: "#fff",
            display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800,
          }}>{touchDrag.letter}</span>
          <span style={{ fontSize: 13, fontWeight: 500, textAlign: "right" }}>{touchDrag.text}</span>
        </div>
      )}
    </div>
  );
}
