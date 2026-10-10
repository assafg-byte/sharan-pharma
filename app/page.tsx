import Link from "next/link";

/** Platform chooser — the app's main link. */
export default function PlatformChooser() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      dir="rtl"
      style={{ background: "linear-gradient(160deg, #EFF9FE 0%, #F7FCFF 55%, #FFFFFF 100%)" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #BFE7F8 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #9ED9F2 0%, transparent 70%)" }} />
      </div>

      <main className="relative w-full max-w-5xl" style={{ zIndex: 1 }}>
        <header className="flex flex-col items-center text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/psp/sharan.png" alt="שרן — רפואה עד הבית" className="h-24 w-auto object-contain mb-5" />
          <h1 className="text-[26px] font-bold text-[#1B3A6B]">חטיבת פארמה</h1>
          <p className="text-[15px] text-gray-500 mt-2">בחר/י תוכנית</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PlatformCard
            href="/mounjaro"
            title="מוקד צרכנים"
            desc="ניהול מוקד, קמפוס למידה."
            cta="התחברות"
            chips={["Mounjaro · מונג׳ארו"]}
            logo={<>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lilly-logo.png" alt="" className="h-12 w-12 rounded-xl object-contain" />
              <span className="w-px h-10 bg-gray-200 mx-4" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mounjaro/pen.png" alt="עט מונג׳ארו" className="h-14 w-14 rounded-xl object-cover" />
            </>}
          />
          <PlatformCard
            href="/psp"
            title="Lilly PSP"
            desc="תוכניות תמיכה: תרשים זרימה ושאלות ותשובות."
            cta="כניסה"
            chips={["Omvoh · אומבו", "Ebglyss · אבגליס"]}
            // eslint-disable-next-line @next/next/no-img-element
            logo={<img src="/psp/lilly.png" alt="" className="h-10 w-auto object-contain" />}
          />
          <PlatformCard
            href="/nucala"
            title="GSK"
            desc="תוכניות תמיכה: תסריט שיחה אינטראקטיבי."
            cta="כניסה"
            chips={["Nucala · נוקלה"]}
            // eslint-disable-next-line @next/next/no-img-element
            logo={<img src="/gsk/gsk.png" alt="" className="h-12 w-12 rounded-xl object-contain" />}
          />
        </div>
      </main>
    </div>
  );
}

function PlatformCard({ href, title, desc, cta, logo, chips }: {
  href: string; title: string; desc: string; cta: string;
  logo: React.ReactNode; chips?: string[];
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col bg-white rounded-3xl p-7 min-h-[260px] overflow-hidden transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
      style={{
        border: "1px solid #CDEBF7",
        boxShadow: "0 1px 3px rgba(34,169,223,0.08), 0 8px 24px rgba(34,169,223,0.10), 0 24px 48px rgba(27,58,107,0.05)",
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, #29B6E9 20%, #29B6E9 80%, transparent 100%)" }} />
      <div className="h-14 flex items-center">{logo}</div>
      <h2 className="text-2xl font-bold text-[#1B3A6B] mt-5">{title}</h2>
      <p className="text-[15px] leading-relaxed text-gray-500 mt-2">{desc}</p>
      {chips && (
        <div className="flex flex-wrap gap-2 mt-4">
          {chips.map(c => (
            <span key={c} className="text-[12.5px] font-semibold rounded-full px-3 py-1" style={{ background: "#E3F4FC", color: "#1B6E99" }}>{c}</span>
          ))}
        </div>
      )}
      <div className="mt-auto pt-6 flex items-center justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[14.5px] font-semibold text-white transition-colors bg-[#22A9DF] group-hover:bg-[#168DBE]">
          {cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="transition-transform group-hover:-translate-x-0.5"><path d="M15 6l-6 6 6 6" /></svg>
        </span>
      </div>
    </Link>
  );
}
