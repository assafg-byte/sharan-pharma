"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [phone4, setPhone4] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone4.length !== 4 || !/^\d{4}$/.test(phone4)) {
      setError("יש להזין 4 ספרות אחרונות של הנייד");
      return;
    }
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      phone4,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!res?.ok) {
      setError("פרטים שגויים — בדוק/י שוב");
      return;
    }
    // Fetch session to know role
    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();
    const role = session?.user?.role;
    if (role === "MANAGER") router.push("/manager");
    else router.push("/employee");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
      style={{ background: "linear-gradient(160deg, #FFF8F6 0%, #FFFBFA 55%, #FFFFFF 100%)" }}
    >
      {/* Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, #FECDCA 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #FCA5A5 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        {/* Card */}
        <div
          className="bg-white rounded-3xl p-8 relative overflow-hidden"
          style={{
            border: "1px solid #F5D5D2",
            boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.06)",
          }}
        >
          {/* Accent strip */}
          <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />

          {/* Logo + title */}
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lilly-logo.png" alt="Lilly" className="h-14 w-14 rounded-xl object-contain mb-4"
              onError={e => (e.currentTarget.style.display = "none")} />
            <h1 className="text-2xl font-bold text-gray-900">מוקד לילי</h1>
            <p className="text-sm text-gray-400 mt-1">התחבר/י כדי להמשיך</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                4 ספרות אחרונות של הנייד
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={phone4}
                onChange={e => setPhone4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ focusRingColor: "#E5252A" } as React.CSSProperties}
                onFocus={e => e.target.style.boxShadow = "0 0 0 2px #E5252A"}
                onBlur={e => e.target.style.boxShadow = ""}
                placeholder="_ _ _ _"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                onFocus={e => e.target.style.boxShadow = "0 0 0 2px #E5252A"}
                onBlur={e => e.target.style.boxShadow = ""}
                placeholder="הזן/י סיסמה"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-[15px] transition-all disabled:opacity-50"
              style={{ background: "#D7252F" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "#B91C1C")}
              onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}
            >
              {loading ? "מתחבר/ת..." : "כניסה"}
            </button>
          </form>
        </div>
        <Link href="/" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-5">
          חזרה לבחירת פלטפורמה
        </Link>
      </div>
    </div>
  );
}
