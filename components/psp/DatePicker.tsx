"use client";

import { useEffect, useRef, useState } from "react";
import { fmt, midnight, parseDMY } from "@/lib/psp/format";
import { Icon } from "./icons";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** dd/mm/yyyy text field with a month-grid popover. `onChange` gets null while the text is invalid. */
export default function DatePicker({ value, onChange, max, onEnter, disabled }: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  max?: Date;
  onEnter?: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ? fmt(value) : "");
  const [open, setOpen] = useState(false);
  const base = value ?? midnight();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pick = (d: Date) => { setText(fmt(d)); onChange(d); setView({ y: d.getFullYear(), m: d.getMonth() }); setOpen(false); };
  const move = (step: number) => { const nd = new Date(view.y, view.m + step, 1); setView({ y: nd.getFullYear(), m: nd.getMonth() }); };

  const today = midnight();
  const { y, m } = view;
  const lead = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const tail = (7 - ((lead + dim) % 7)) % 7;

  return (
    <div className="dp" ref={root}>
      <div className={`dp-box${disabled ? " off" : ""}`}>
        <input
          className="dp-in" inputMode="numeric" maxLength={10} placeholder="dd/mm/yyyy" autoComplete="off"
          aria-label="תאריך בפורמט יום/חודש/שנה" value={text}
          onFocus={e => e.target.select()}
          onKeyDown={e => { if (e.key === "Enter") { setOpen(false); onEnter?.(); } }}
          onChange={e => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
            let out = raw.slice(0, 2);
            if (raw.length > 2) out += "/" + raw.slice(2, 4);
            if (raw.length > 4) out += "/" + raw.slice(4, 8);
            setText(out);
            const d = parseDMY(out);
            onChange(d);
            if (d) setView({ y: d.getFullYear(), m: d.getMonth() });
          }}
        />
        <button type="button" className="dp-cal" aria-label="פתיחת לוח שנה" onClick={() => setOpen(o => !o)}>
          <Icon.cal />
        </button>
      </div>
      {open && (
        <div className="dp-pop">
          <div className="dp-nav">
            <button type="button" aria-label="שנה קודמת" onClick={() => move(-12)}><Icon.prev2 /></button>
            <button type="button" aria-label="חודש קודם" onClick={() => move(-1)}><Icon.prev /></button>
            <span className="lbl">{MONTHS[m]} {y}</span>
            <button type="button" aria-label="חודש הבא" onClick={() => move(1)}><Icon.next /></button>
            <button type="button" aria-label="שנה הבאה" onClick={() => move(12)}><Icon.next2 /></button>
          </div>
          <div className="dp-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
          <div className="dp-grid">
            {Array.from({ length: lead }, (_, i) => <button key={"l" + i} type="button" className="out" disabled />)}
            {Array.from({ length: dim }, (_, i) => {
              const dt = new Date(y, m, i + 1);
              const cls = [
                dt.getDay() >= 5 ? "we" : "",
                dt.getTime() === today.getTime() ? "today" : "",
                value && dt.getTime() === value.getTime() ? "sel" : "",
              ].filter(Boolean).join(" ");
              return (
                <button key={i} type="button" className={cls} disabled={!!max && dt > max} onClick={() => pick(dt)}>{i + 1}</button>
              );
            })}
            {Array.from({ length: tail }, (_, i) => <button key={"t" + i} type="button" className="out" disabled />)}
          </div>
          <div className="dp-foot">
            <button type="button" onClick={() => pick(midnight())}>היום</button>
            <button type="button" onClick={() => setOpen(false)}>סגור</button>
          </div>
        </div>
      )}
    </div>
  );
}
