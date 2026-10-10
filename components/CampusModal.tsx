"use client";

import { useEffect, useRef, useState } from "react";
import CampusQuestionCard, { type Question } from "./CampusQuestionCard";

interface Props {
  questionsPerSession: number;
  employeeId: number;
  onClose: () => void;
}

type Phase = "loading" | "quiz" | "complete" | "empty";

// Pre-computed confetti pieces — deterministic, no re-generation on renders
const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  x:     (i * 37 + 7)  % 97,
  color: ["#D7252F","#FBBF24","#34D399","#60A5FA","#A78BFA","#F472B6"][i % 6],
  delay: ((i * 0.07) % 0.5).toFixed(2),
  size:  8 + (i % 3) * 3,
}));

// Lilly red palette
const R = {
  bg:     "linear-gradient(160deg, #FFF6F4 0%, #FFFBFA 55%, #FFFFFF 100%)",
  accent: "#D7252F",
  dark:   "#C81E13",
  deep:   "#9F1239",
  tint:   "#FFEBEC",
  border: "#F5D5D2",
  shadow: "0 1px 3px rgba(215,37,47,0.06), 0 8px 24px rgba(215,37,47,0.10), 0 32px 64px rgba(0,0,0,0.06)",
  amber:  "#D97706",
  amberBg: "#FFFBEB",
  amberBrd: "#FCD34D",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function CampusModal({ questionsPerSession, employeeId, onClose }: Props) {
  const [phase, setPhase]           = useState<Phase>("loading");
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [sessionId, setSessionId]   = useState<number | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore]           = useState(0);
  const [elapsedStr, setElapsedStr] = useState("0:00");

  const startedAt = useRef(Date.now());
  const finalScore = useRef(0); // snapshot for completion screen

  useEffect(() => {
    async function init() {
      try {
        // Bug 2: fetch questions first — only create a session if there's something to ask.
        // Creating a session before checking for questions produces a false-DNF record
        // that inflates the manager's abandoned-session count after 24 h.
        const qRes = await fetch(
          `/api/campus/questions/due?employeeId=${employeeId}&n=${questionsPerSession}`
        ).then(r => r.json());

        if (!Array.isArray(qRes) || qRes.length === 0) {
          setPhase("empty");
          return;
        }

        const sessionRes = await fetch("/api/campus/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, date: todayStr() }),
        }).then(r => r.json());

        if (!sessionRes?.id) throw new Error("session creation failed");

        setSessionId(sessionRes.id);
        setQuestions(qRes);
        startedAt.current = Date.now();
        setPhase("quiz");
      } catch {
        // Bug 3: surface init errors — degrade to empty state so the employee
        // can always reach "התחל משמרת" rather than being stuck on the loader.
        setPhase("empty");
      }
    }
    init();
  }, [employeeId, questionsPerSession]);

  async function handleAnswer(answeredCorrectly: boolean, _selected: Set<string>, blankAttempts?: Record<string, number>) {
    if (!sessionId) return;
    const q = questions[currentIdx];

    await fetch(`/api/campus/sessions/${sessionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, employeeId, answeredCorrectly, blankAttempts }),
    });

    const newScore = score + (answeredCorrectly ? 1 : 0);
    if (answeredCorrectly) setScore(newScore);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      finalScore.current = newScore;
      setElapsedStr(formatElapsed(Date.now() - startedAt.current));
      await fetch(`/api/campus/sessions/${sessionId}/complete`, { method: "PATCH" });
      setPhase("complete");
    }
  }

  function handleAbort() { onClose(); }

  const current = questions[currentIdx];
  const totalQ  = questions.length;
  const wrongCount = totalQ - finalScore.current;
  const isPerfect  = finalScore.current === totalQ && totalQ > 0;
  const isGood     = finalScore.current >= totalQ / 2;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: R.bg }}>

      {/* Orbs — Lilly red */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ opacity: 0.35, background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full"
          style={{ opacity: 0.25, background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
      </div>

      {/* Confetti — fires on completion, pointer-events-none so it never blocks */}
      {phase === "complete" && CONFETTI.map((c, i) => (
        <span key={i} className="fixed pointer-events-none rounded-sm" style={{
          width: c.size, height: c.size, left: `${c.x}%`, bottom: "0%",
          background: c.color,
          animation: `confetti-fly 2.4s ${c.delay}s ease-out forwards`,
        }} />
      ))}

      {/* Skip pill — always reachable, glass morphism */}
      {phase !== "complete" && (
        <button onClick={handleAbort}
          className="fixed top-4 left-4 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
            border: `1px solid ${R.border}`, color: "#6B7280",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1F2937")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
          aria-label="דלג על שאלות הידע">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
          דלג
        </button>
      )}

      <div className="min-h-full flex items-center justify-center p-4">
      <div className="relative w-full max-w-md" style={{ zIndex: 1 }}>

        {/* ── Loading ── */}
        {phase === "loading" && (
          <div className="bg-white rounded-3xl p-10 text-center"
            style={{ border: `1px solid ${R.border}`, boxShadow: R.shadow }}>
            <div className="text-4xl mb-3 animate-pulse">📚</div>
            <p className="text-sm text-gray-400">טוען שאלות...</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {phase === "empty" && (
          <div className="bg-white rounded-3xl p-10 text-center"
            style={{ border: `1px solid ${R.border}`, boxShadow: R.shadow }} dir="rtl">
            <div style={{
              width: 80, height: 80, margin: "0 auto 18px", borderRadius: 20,
              background: R.tint, border: `1px solid ${R.border}`,
              display: "grid", placeItems: "center",
            }}>
              <span style={{ fontSize: 40 }}>🎓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">אין שאלות לעיון היום</h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              כל השאלות עודכנו לאחרונה. כל הכבוד!
            </p>
            <button onClick={onClose} style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              background: R.dark, color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
              boxShadow: "0 6px 16px -4px rgba(215,37,47,0.4)",
            }}>התחל משמרת ▶</button>
          </div>
        )}

        {/* ── Quiz ── */}
        {phase === "quiz" && current && (
          <div className="bg-white rounded-3xl relative overflow-hidden"
            style={{ border: `1px solid ${R.border}`, boxShadow: R.shadow }}>
            {/* Red accent strip */}
            <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${R.accent} 20%, ${R.accent} 80%, transparent 100%)` }} />

            <div className="px-6 pt-6 pb-5">
              {/* Eyebrow */}
              <div className="flex items-center justify-between mb-4" dir="rtl">
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
                    color: R.accent, textTransform: "uppercase", margin: 0 }}>
                    Lilly Campus · Mounjaro
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", margin: "2px 0 0" }}>
                    שאלה {currentIdx + 1} מתוך {totalQ}
                  </p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: R.tint, color: R.deep,
                }}>
                  {current.type === "TRUE_FALSE" ? "נ/לא"
                    : current.type === "MULTI_SELECT" ? "מרובה"
                    : current.type === "REPORT_DRAG_DROP" ? "דיווח"
                    : "יחידה"}
                </span>
              </div>

              {/* Segmented progress bar */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                {questions.map((_, i) => (
                  <div key={i} style={{
                    height: 6, flex: 1, borderRadius: 999, transition: "background 0.2s",
                    background: i < currentIdx ? R.accent : i === currentIdx ? R.dark : "#E5E7EB",
                  }} />
                ))}
              </div>

              <CampusQuestionCard key={current.id} question={current} onSubmit={handleAnswer} />

              {/* Ghost skip link */}
              <div className="text-center mt-3">
                <button onClick={handleAbort}
                  style={{ fontSize: 11, color: "#D1D5DB", textDecoration: "underline",
                    textUnderlineOffset: 2, background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#6B7280")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#D1D5DB")}>
                  דלג על שאלות הידע להיום
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Completion screen ── */}
        {phase === "complete" && (
          <div className="bg-white rounded-3xl relative overflow-hidden"
            style={{ border: `1px solid ${R.border}`, boxShadow: R.shadow }} dir="rtl">
            <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${R.accent} 20%, ${R.accent} 80%, transparent 100%)` }} />

            <div className="px-7 pt-8 pb-7 text-center">
              {/* Trophy / halo */}
              <div style={{
                width: 96, height: 96, margin: "0 auto 16px", borderRadius: "50%",
                display: "grid", placeItems: "center",
                background: isPerfect
                  ? `radial-gradient(circle, ${R.tint} 0%, #fff 70%)`
                  : isGood
                  ? `radial-gradient(circle, ${R.amberBg} 0%, #fff 70%)`
                  : "radial-gradient(circle, #F1F5F9 0%, #fff 70%)",
                border: `1px solid ${isPerfect ? R.border : isGood ? R.amberBrd : "#E2E8F0"}`,
              }}>
                <span style={{ fontSize: 56 }}>
                  {isPerfect ? "🏆" : isGood ? "✅" : "📖"}
                </span>
              </div>

              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
                color: R.accent, textTransform: "uppercase", margin: 0 }}>
                Lilly Campus · הושלם
              </p>
              <h2 style={{ fontSize: 36, fontWeight: 800, color: "#111827",
                margin: "8px 0 0", letterSpacing: "-0.02em" }}>
                {finalScore.current} / {totalQ}
              </h2>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", margin: "10px 0 4px" }}>
                {isPerfect ? "מושלם! ענית נכון על כל השאלות"
                  : isGood ? "כל הכבוד! ממשיכים להשתפר"
                  : "לא נורא, נשתפר ביחד"}
              </p>

              {/* Stats row */}
              <div style={{
                display: "flex", gap: 0, marginTop: 18, marginBottom: 22,
                borderRadius: 12, overflow: "hidden",
                background: R.tint, border: `1px solid ${R.border}`,
              }}>
                {[
                  { n: String(finalScore.current), label: "נכונות" },
                  { n: String(wrongCount),          label: "שגויות" },
                  { n: elapsedStr,                  label: "זמן" },
                ].map(({ n, label }, i) => (
                  <div key={i} style={{
                    flex: 1, padding: "10px 0", textAlign: "center",
                    borderLeft: i > 0 ? `1px solid ${R.border}` : "none",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: R.deep,
                      fontVariantNumeric: "tabular-nums" }}>{n}</div>
                    <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              <button onClick={onClose} style={{
                width: "100%", padding: "13px 0", borderRadius: 12,
                background: R.dark, color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
                boxShadow: "0 6px 16px -4px rgba(215,37,47,0.4)",
              }}>
                התחל משמרת ▶
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
