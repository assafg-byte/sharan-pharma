"use client";
import { useState } from "react";

const PT = {
  red: "#D7252F", redDark: "#C81E13", surfaceSoft: "#F8FAFC",
  divider: "#F1F5F9", textMute: "#94A3B8", textSoft: "#475569", text: "#0F172A",
  amberBg: "#FEF3C7", amberBorder: "#FCD34D", amberText: "#92400E",
};

const PRESETS = [15, 20, 30, 45];

function returnTimeStr(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BreakReturnModal({ onConfirm, onCancel }: {
  onConfirm: (expectedEnd: string | null) => void;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(30);

  function confirm() {
    const d = new Date(Date.now() + minutes * 60000);
    onConfirm(d.toISOString());
  }

  const returnAt = returnTimeStr(minutes);

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(15,23,42,0.15)" }} />
      <div dir="rtl" style={{
        position: "fixed", zIndex: 50,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 288, background: "#fff", border: "1px solid #F5D5D2", borderRadius: 18,
        padding: "20px 20px 16px",
        boxShadow: "0 8px 32px rgba(215,37,47,0.10), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* Red accent strip */}
        <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: 3, borderRadius: 999,
          background: `linear-gradient(90deg, transparent, ${PT.red}, ${PT.redDark}, transparent)` }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: PT.text, margin: 0 }}>⏸ יוצאת להפסקה</p>
          <button onClick={onCancel} style={{
            width: 24, height: 24, display: "grid", placeItems: "center",
            borderRadius: "50%", border: "none", background: PT.surfaceSoft,
            cursor: "pointer", color: PT.textMute, fontSize: 14,
          }}>✕</button>
        </div>

        {/* Question */}
        <p style={{ fontSize: 13, fontWeight: 600, color: PT.text, margin: "0 0 12px" }}>כמה דקות ההפסקה?</p>

        {/* Preset chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {PRESETS.map(p => (
            <button key={p} onClick={() => setMinutes(p)} style={{
              flex: 1, padding: "7px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: "pointer", transition: "all 0.12s",
              background: minutes === p ? PT.amberBg : PT.surfaceSoft,
              color: minutes === p ? PT.amberText : PT.textSoft,
              border: `1px solid ${minutes === p ? PT.amberBorder : PT.divider}`,
            }}>
              {p} דק׳
            </button>
          ))}
        </div>

        {/* Custom minutes stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
          padding: "8px 12px", borderRadius: 12, background: PT.surfaceSoft, border: `1px solid ${PT.divider}` }}>
          <button onClick={() => setMinutes(m => Math.max(5, m - 5))} style={{
            width: 28, height: 28, borderRadius: 8, border: `1px solid ${PT.divider}`,
            background: "#fff", color: PT.text, fontSize: 16, fontWeight: 700,
            cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
          }}>−</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: PT.text, fontVariantNumeric: "tabular-nums" }}>{minutes}</span>
            <span style={{ fontSize: 12, color: PT.textMute, marginInlineStart: 4 }}>דק׳</span>
          </div>
          <button onClick={() => setMinutes(m => Math.min(120, m + 5))} style={{
            width: 28, height: 28, borderRadius: 8, border: `1px solid ${PT.divider}`,
            background: "#fff", color: PT.text, fontSize: 16, fontWeight: 700,
            cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
          }}>+</button>
        </div>

        {/* Confirm */}
        <button onClick={confirm} style={{
          width: "100%", padding: "11px", borderRadius: 10, marginBottom: 8,
          background: PT.red, color: "#fff", border: "none",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>
          אחזור ב-{returnAt}
        </button>

        {/* Don't know */}
        <button onClick={() => onConfirm(null)} style={{
          width: "100%", padding: "10px", borderRadius: 10,
          background: PT.surfaceSoft, color: PT.textSoft,
          border: `1px solid ${PT.divider}`, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          אעדכן
        </button>
      </div>
    </>
  );
}
