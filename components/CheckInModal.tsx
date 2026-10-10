"use client";

interface Props {
  name: string;
  gender: string; // "M" | "F"
  onConfirm: () => void;
  onDismiss: () => void;
}

function greeting(gender: string): string {
  const h = new Date().getHours();
  const suffix = gender === "F" ? "מוכנה" : "מוכן";
  if (h < 12) return `בוקר טוב! ${suffix} להתחיל?`;
  if (h < 17) return `צהריים טובים! ${suffix} להתחיל?`;
  return `ערב טוב! ${suffix} להתחיל?`;
}

export default function CheckInModal({ name, gender, onConfirm, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]" dir="rtl">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center relative overflow-hidden"
        style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.1)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

        {/* Clock icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "#FFF0EF" }}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#D7252F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">{name}</h2>
        <p className="text-gray-500 mb-6">{greeting(gender)}</p>

        <div className="flex flex-col gap-3">
          <button onClick={onConfirm}
            className="w-full py-3 rounded-xl font-semibold text-white text-[15px] transition-all"
            style={{ background: "#D7252F" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
            ✓ כן, אני כאן
          </button>
          <button onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors border border-gray-200">
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}
