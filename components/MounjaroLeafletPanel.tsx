"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { TOPICS, DEFAULT_ORDER, type LeafletTopic, type IntroScreen, type LeafletStep } from "@/lib/mounjaroContent";

interface Props {
  employeeId: number;
  onClose: () => void;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function stripNiqqud(str: string): string {
  return str.replace(/[֑-ׇ]/g, "");
}
function normalize(str: string): string {
  return stripNiqqud(str).toLowerCase();
}
function matches(query: string, ...texts: string[]): boolean {
  if (!query) return true;
  const q = normalize(query);
  return texts.some(t => normalize(t).includes(q));
}

// ── Wizard ────────────────────────────────────────────────────────────────────
interface WizardScreen {
  title: string;
  body: string;
  imageFile?: string;
  sectionBadge?: string; // e.g. "לאחר השימוש"
  stepNumber?: number;
}

function buildWizardScreens(
  topic: LeafletTopic,
  guideType: "before-use" | "after-use"
): WizardScreen[] {
  const steps = topic.steps ?? [];
  const afterFrom = topic.afterUseFromStep ?? Infinity;

  if (guideType === "before-use") {
    const introScreens: WizardScreen[] = (topic.introScreens ?? []).map((s: IntroScreen) => ({
      title: s.title,
      body: s.content,
    }));
    const stepScreens: WizardScreen[] = steps.map((s: LeafletStep) => ({
      title: s.title,
      body: s.description,
      imageFile: s.imageFile,
      stepNumber: s.number,
      sectionBadge: s.number >= afterFrom ? "לאחר השימוש" : undefined,
    }));
    return [...introScreens, ...stepScreens];
  }

  // after-use: start from afterUseFromStep
  return steps
    .filter((s: LeafletStep) => s.number >= afterFrom)
    .map((s: LeafletStep) => ({
      title: s.title,
      body: s.description,
      imageFile: s.imageFile,
      stepNumber: s.number,
      sectionBadge: "לאחר השימוש",
    }));
}

// milestone = completing step 13; finale = completing the last screen
const MILESTONE_CONFETTI = Array.from({ length: 45 }, (_, i) => ({
  x: 3 + (i * 13 + 7) % 94,
  color: ["#E5252A","#F59E0B","#10B981","#3B82F6","#8B5CF6","#EC4899","#FBBF24","#34D399"][i % 8],
  delay: ((i * 0.028) % 0.55).toFixed(3),
  size: 8 + (i % 4) * 3,
  duration: (1.0 + (i % 3) * 0.15).toFixed(2),
  circle: i % 3 === 0,
}));

const FINALE_CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37 + 11) % 97,
  color: ["#D7252F","#FBBF24","#34D399","#60A5FA","#A78BFA","#F472B6"][i % 6],
  delay: ((i * 0.06) % 0.45).toFixed(2),
  size: 8 + (i % 3) * 3,
  duration: "2.2",
  circle: false,
}));

function StepWizard({
  screens, onClose,
}: {
  screens: WizardScreen[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [confettiType, setConfettiType] = useState<"milestone" | "finale" | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screen = screens[idx];
  const isFirst = idx === 0;
  const isLast = idx === screens.length - 1;

  // Reset to the first screen when a different guide is opened
  const [prevScreens, setPrevScreens] = useState(screens);
  if (prevScreens !== screens) {
    setPrevScreens(screens);
    setIdx(0);
  }

  useEffect(() => () => { if (confettiTimer.current) clearTimeout(confettiTimer.current); }, []);

  const fireConfetti = useCallback((type: "milestone" | "finale", duration: number) => {
    setConfettiType(type);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setConfettiType(null), duration);
  }, []);

  const handleNext = useCallback(() => {
    if (screen?.stepNumber === 13) fireConfetti("milestone", 1400);
    setIdx(i => i + 1);
  }, [screen?.stepNumber, fireConfetti]);

  const handleFinish = useCallback(() => {
    fireConfetti("finale", 2200);
    confettiTimer.current = setTimeout(() => {
      setConfettiType(null);
      onClose();
    }, 2200);
  }, [fireConfetti, onClose]);

  const confettiParticles = confettiType === "finale" ? FINALE_CONFETTI
    : confettiType === "milestone" ? MILESTONE_CONFETTI : null;

  if (!screen) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Wizard header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          חזרה
        </button>
        <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
          {idx + 1} / {screens.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-gray-100 mb-5 shrink-0 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((idx + 1) / screens.length) * 100}%`, background: "#E5252A" }} />
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-y-auto">
        {screen.sectionBadge && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
            style={{ background: "#FFF7ED", color: "#92400E" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {screen.sectionBadge}
          </div>
        )}

        <div className="flex items-start gap-3 mb-4">
          {screen.stepNumber != null && (
            <span className="flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold shrink-0 mt-0.5"
              style={{ background: "#E5252A" }}>
              {screen.stepNumber}
            </span>
          )}
          <h3 className="text-[17px] font-bold text-gray-900 leading-snug">{screen.title}</h3>
        </div>

        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line mb-4">
          {screen.body}
        </p>

        {screen.imageFile && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/mounjaro/${screen.imageFile}`}
            alt={screen.title}
            loading="lazy"
            className="w-full rounded-xl border border-gray-100"
            style={{ maxHeight: 260, objectFit: "contain", display: "block" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 shrink-0">
        <button
          onClick={() => setIdx(i => i - 1)}
          disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30"
          style={{ borderColor: "#F5D5D2", color: "#6B7280" }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          הקודם
        </button>

        <div className="flex gap-1">
          {screens.length <= 20 && screens.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 20 : 6,
                height: 6,
                background: i === idx ? "#E5252A" : "#E5E7EB",
              }} />
          ))}
        </div>

        {isLast ? (
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "#E5252A" }}>
            סיום ✓
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "#E5252A" }}>
            הבא
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Confetti — milestone on step 13, finale on completion */}
      {confettiParticles && confettiParticles.map((c, i) => (
        <span key={i} className="fixed pointer-events-none rounded-sm z-[80]" style={{
          width: c.size, height: c.size,
          left: `${c.x}%`,
          bottom: confettiType === "finale" ? "0%" : 70,
          background: c.color,
          animation: `confetti-fly ${c.duration}s ${c.delay}s ease-out forwards`,
        }} />
      ))}
    </div>
  );
}

// ── WizardModal ───────────────────────────────────────────────────────────────
function WizardModal({ screens, onClose }: { screens: WizardScreen[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 70 }}
      dir="rtl"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative w-full max-w-xl flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxHeight: "90vh",
          background: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
          border: "1px solid #F5D5D2",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* accent strip */}
        <div className="h-[3px] shrink-0"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0"
          style={{ background: "#FFF8F6" }}>
          <h3 className="text-[15px] font-bold text-gray-900">הדרכת שימוש</h3>
          <button onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
        {/* wizard fills remaining height — must be a flex column so the
            wizard can size itself with flex-1 (h-full can't resolve against
            a max-height-constrained auto-height parent, which left the nav
            buttons clipped when a screen's content was tall) */}
        <div className="flex-1 min-h-0 px-5 py-4 flex flex-col">
          <StepWizard screens={screens} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// ── TopicGrid ─────────────────────────────────────────────────────────────────
function TopicGrid({
  topicOrder, searchQuery, onSelectTopic, onDrop, locked,
}: {
  topicOrder: string[];
  searchQuery: string;
  onSelectTopic: (key: string) => void;
  onDrop: (from: string, to: string) => void;
  locked?: boolean;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const orderedTopics = topicOrder
    .map(k => TOPICS.find(t => t.key === k))
    .filter((t): t is LeafletTopic => t != null);

  const visibleTopics = searchQuery
    ? orderedTopics.filter(t =>
        matches(searchQuery, t.title, ...t.subtopics.map(s => s.title + " " + s.content))
      )
    : orderedTopics;

  return (
    <div className="grid grid-cols-2 gap-3">
      {visibleTopics.map(topic => {
        const isDragging = draggedKey === topic.key;
        const isOver = dragOverKey === topic.key && draggedKey !== topic.key;
        return (
          <div
            key={topic.key}
            draggable={!searchQuery && !locked}
            onDragStart={() => !locked && setDraggedKey(topic.key)}
            onDragOver={e => { e.preventDefault(); if (!locked) setDragOverKey(topic.key); }}
            onDrop={e => { e.preventDefault(); if (!locked && draggedKey && draggedKey !== topic.key) onDrop(draggedKey, topic.key); setDraggedKey(null); setDragOverKey(null); }}
            onDragEnd={() => { setDraggedKey(null); setDragOverKey(null); }}
            onClick={() => onSelectTopic(topic.key)}
            className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all select-none"
            style={{
              background: isOver ? "#FFF1F0" : "#FFFBFA",
              borderColor: isOver ? "#E5252A" : "#F5D5D2",
              opacity: isDragging ? 0.4 : 1,
              boxShadow: isOver ? "0 0 0 2px #E5252A" : undefined,
              cursor: locked ? "default" : "pointer",
            }}
          >
            {!searchQuery && !locked && (
              <span className="absolute top-2 right-2 text-gray-300 text-xs select-none">⠿</span>
            )}
            {locked && (
              <span className="absolute top-2 right-2 text-gray-300 text-xs select-none">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
            )}
            {topic.key === "instructions" && (
              <span className="absolute top-1.5 left-2 text-[11px] select-none" title="מומלץ מאוד">⭐</span>
            )}
            <span style={{ fontSize: 32 }}>{topic.emoji}</span>
            <span className="text-[13px] font-semibold text-gray-800 text-center leading-snug">{topic.title}</span>
            <span className="text-[10px] text-gray-400">{topic.subtopics.length} נושאים</span>
          </div>
        );
      })}
      {visibleTopics.length === 0 && (
        <div className="col-span-2 text-center text-gray-400 text-sm py-8">
          אין תוצאות עבור &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}

// ── TopicDetail ───────────────────────────────────────────────────────────────
function TopicDetail({
  topic, searchQuery, onBack, onOpenWizard,
}: {
  topic: LeafletTopic;
  searchQuery: string;
  onBack: () => void;
  onOpenWizard: (screens: WizardScreen[]) => void;
}) {
  const regularSubtopics = topic.subtopics.filter(s => !s.guideType);
  const guideSubtopics = topic.subtopics.filter(s => s.guideType);

  const allRegularKeys = regularSubtopics.map(s => s.key);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(searchQuery ? allRegularKeys : [])
  );
  const allOpen = allRegularKeys.length > 0 && allRegularKeys.every(k => expanded.has(k));

  function toggleSubtopic(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleRegular = searchQuery
    ? regularSubtopics.filter(s => matches(searchQuery, s.title, s.content))
    : regularSubtopics;

  return (
    <div className="flex flex-col gap-2">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          חזרה
        </button>
        {visibleRegular.length > 0 && (
          <button onClick={() => allOpen ? setExpanded(new Set()) : setExpanded(new Set(allRegularKeys))}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            {allOpen ? "סגירת הכל" : "פתיחת הכל"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 24 }}>{topic.emoji}</span>
        <h3 className="text-[16px] font-bold text-gray-900">{topic.title}</h3>
      </div>

      {/* Guide buttons (wizard launchers) */}
      {guideSubtopics.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {guideSubtopics.map(sub => {
            const screens = buildWizardScreens(topic, sub.guideType!);
            return (
              <button
                key={sub.key}
                onClick={() => onOpenWizard(screens)}
                className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border text-right transition-all hover:shadow-sm"
                style={{ background: "#FFFBFA", borderColor: "#F5D5D2" }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-gray-900">{sub.title}</span>
                  <span className="text-[11px] text-gray-400">{screens.length} שלבים</span>
                </div>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#E5252A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {/* Accordion subtopics */}
      {visibleRegular.map(sub => {
        const isOpen = expanded.has(sub.key);
        return (
          <div key={sub.key} className="rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleSubtopic(sub.key)}
              className="w-full flex items-center justify-between px-4 py-3 text-right bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-[13px] font-semibold text-gray-800">{sub.title}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {isOpen && (
              <div className="px-4 py-3 text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">
                {sub.content}
              </div>
            )}
          </div>
        );
      })}

      {visibleRegular.length === 0 && guideSubtopics.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-6">אין תוצאות</p>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function MounjaroLeafletPanel({ employeeId, onClose }: Props) {
  const [topicOrder, setTopicOrder] = useState<string[]>(DEFAULT_ORDER);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [wizard, setWizard] = useState<WizardScreen[] | null>(null);
  const [lockedToast, setLockedToast] = useState(false);
  // Manager toggle (Campus → Settings): topics stay visible, content is hidden.
  // Starts locked so the content never flashes open before settings load.
  const [contentLocked, setContentLocked] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSelectTopic(key: string) {
    if (contentLocked) {
      setLockedToast(true);
      if (lockedToastTimer.current) clearTimeout(lockedToastTimer.current);
      lockedToastTimer.current = setTimeout(() => setLockedToast(false), 2500);
      return;
    }
    setSelectedTopic(key);
    setSearchQuery("");
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (lockedToastTimer.current) clearTimeout(lockedToastTimer.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/campus/settings")
      .then(r => r.json())
      .then(d => setContentLocked(d.leafletLocked !== false))
      .catch(() => { /* stay locked */ });
  }, []);

  // Load saved order
  useEffect(() => {
    fetch(`/api/leaflet/order?employeeId=${employeeId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.orders) && d.orders.length > 0) {
          const sorted = [...d.orders].sort((a: { order: number }, b: { order: number }) => a.order - b.order);
          const keys = sorted.map((o: { topicKey: string }) => o.topicKey);
          const missing = DEFAULT_ORDER.filter(k => !keys.includes(k));
          setTopicOrder([...keys, ...missing]);
        }
      })
      .catch(() => {});
  }, [employeeId]);

  function handleDrop(fromKey: string, toKey: string) {
    setTopicOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromKey);
      const toIdx = next.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromKey);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetch("/api/leaflet/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            orders: next.map((key, i) => ({ topicKey: key, order: i })),
          }),
        }).catch(() => {});
      }, 300);
      return next;
    });
  }

  const currentTopic = selectedTopic ? TOPICS.find(t => t.key === selectedTopic) ?? null : null;
  // Search matches inside the content too, so it's hidden while locked
  const showSearch = !selectedTopic && !contentLocked;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className="fixed top-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden"
        dir="rtl"
        style={{
          width: 520,
          maxWidth: "95vw",
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          background: "#FFFFFF",
          border: "1px solid #F5D5D2",
          boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)",
        }}
      >
        {/* Red accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">עלון מוּנגָ׳רוֹ</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">מדריך מהיר לנציגה</p>
          </div>
          <span className="text-[10px] font-mono text-gray-400 tracking-wide mr-auto ml-4 select-none">I MOUNKPN FS 07</span>
          <button onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search — hidden during wizard or topic detail */}
        {showSearch && (
          <div className="px-6 py-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש בעלון..."
                className="w-full pr-9 pl-8 py-2 text-[13px] rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-300 text-right"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {currentTopic ? (
            <TopicDetail
              topic={currentTopic}
              searchQuery={searchQuery}
              onBack={() => setSelectedTopic(null)}
              onOpenWizard={screens => setWizard(screens)}
            />
          ) : (
            <>
              {searchQuery && (
                <p className="text-[11px] text-gray-400 mb-3">
                  תוצאות עבור &quot;{searchQuery}&quot; — לחצי על נושא לפרטים
                </p>
              )}
              {lockedToast && (
                <div className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-center justify-center"
                  style={{ background: "#FFF7ED", color: "#92400E", border: "1px solid #FDE68A" }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  התוכן יפתח בקרוב
                </div>
              )}
              <TopicGrid
                topicOrder={topicOrder}
                searchQuery={searchQuery}
                onSelectTopic={handleSelectTopic}
                onDrop={handleDrop}
                locked={contentLocked}
              />
              {!searchQuery && !contentLocked && (
                <p className="text-[10px] text-gray-300 text-center mt-4">גרירת הנושאים לשינוי סדר</p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Wizard as centered modal overlay */}
      {wizard && <WizardModal screens={wizard} onClose={() => setWizard(null)} />}
    </>
  );
}
