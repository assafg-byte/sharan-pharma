"use client";

/**
 * "Today's breaks" strip — replaces the old LIVE presence bar. Shows every
 * employee on shift today, PLUS anyone who clocked in today or already picked
 * a break today even if she isn't on today's shift list (e.g. a full-timer
 * with no shift rows this week, or a schedule edited after she picked) —
 * finishing the entry flow must always give her a card to edit, and a pick
 * must never silently disappear from the bar. Only the viewer's own card is clickable, to pick or change her break;
 * everyone else's card is read-only — a break can't override someone else's
 * slot (enforced server-side). Self-contained: fetches today's shifts and
 * break picks itself, independent of which week the table below shows.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Shift, weekKeyFromDate } from "@/types";
import BreakSlotPicker, { fmtHM, type BreakSlotsResponse } from "./BreakSlotPicker";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Emp { id: number; name: string; color: string }

// refreshKey: bump to refetch (the page passes its check-in phase, so the bar
// picks up the viewer's own clock-in + checklist break pick when the flow ends).
export default function BreakBar({ refreshKey }: { refreshKey?: string } = {}) {
  const { data: session } = useSession();
  const myId = session?.user?.employeeId as number | undefined;
  const isF = session?.user?.gender === "F";
  const [scheduledToday, setScheduledToday] = useState<Emp[]>([]);
  const [breaks, setBreaks] = useState<Record<number, number>>({});
  const [breakEmployees, setBreakEmployees] = useState<Record<number, Emp>>({});
  const [checkedIn, setCheckedIn] = useState<Emp[]>([]);
  const [open, setOpen] = useState(false);

  const dateStr = todayStr();
  const todayIdx = new Date().getDay();
  const isWorkday = todayIdx >= 0 && todayIdx <= 4;

  function refreshBreaks() {
    fetch(`/api/break-slots?date=${dateStr}`)
      .then(r => r.json())
      .then((d: BreakSlotsResponse) => {
        setBreaks(Object.fromEntries(d.taken.map(t => [t.employeeId, t.startHour])));
        setBreakEmployees(Object.fromEntries(
          d.taken.map(t => [t.employeeId, { id: t.employeeId, name: t.employeeName, color: t.employeeColor }])
        ));
        setCheckedIn(d.checkedIn ?? []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!isWorkday) return;
    fetch(`/api/schedule?weekKey=${weekKeyFromDate(new Date())}`)
      .then(r => r.json())
      .then((d: { shifts: Shift[] }) => {
        const seen = new Map<number, Emp>();
        (d.shifts ?? [])
          .filter(s => s.dayOfWeek === todayIdx && s.employee?.role !== "MANAGER")
          .forEach(s => { if (!seen.has(s.employeeId)) seen.set(s.employeeId, s.employee); });
        setScheduledToday([...seen.values()].sort((a, b) => a.id - b.id));
      })
      .catch(() => {});
    refreshBreaks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, isWorkday, refreshKey]);

  if (!isWorkday) return null;

  // Union of "scheduled today", "clocked in today" and "already picked a break
  // today" — she must show up even if she's missing from today's shift list.
  const byId = new Map<number, Emp>(scheduledToday.map(e => [e.id, e]));
  for (const e of [...checkedIn, ...Object.values(breakEmployees)]) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const employees = [...byId.values()];
  if (employees.length === 0) return null;

  const mine = employees.filter(e => e.id === myId);
  const others = employees.filter(e => e.id !== myId);
  const cards = [...mine, ...others];

  return (
    <div dir="rtl" className="mb-5 pb-4 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">שעות הפסקה להיום</span>
        <span className="text-[11px] text-gray-300">{dateStr.split("-").reverse().join("/")}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {cards.map(e => {
          const self = e.id === myId;
          const h = breaks[e.id];
          const has = h != null;
          const card = (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-2.5 border transition-colors"
              style={{
                background: has ? "#F0FDF4" : (self ? "#FFF7ED" : "#F8FAFC"),
                borderColor: has ? (self ? "#86EFAC" : "#DCFCE7") : (self ? "#FDBA74" : "#E2E8F0"),
                cursor: self ? "pointer" : "default",
                minWidth: 150,
              }}>
              <span className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-bold shrink-0"
                style={{ background: e.color }}>
                {e.name.trim().charAt(0)}
              </span>
              <div className="min-w-0 text-right">
                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{e.name}</p>
                <p className="text-[12px] font-medium mt-0.5 leading-tight" dir="ltr"
                  style={{ color: has ? "#16A34A" : "#9CA3AF", textAlign: "right" }}>
                  {has ? `${fmtHM(h)}–${fmtHM(h + 0.5)}` : "–"}
                </p>
              </div>
              {self && (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0 mr-auto">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              )}
            </div>
          );
          if (!self) return <div key={e.id}>{card}</div>;
          return (
            <div key={e.id} className="relative">
              <button type="button" onClick={() => setOpen(o => !o)} className="text-right" aria-expanded={open}>
                {card}
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
                  <div className="absolute z-30 mt-2 bg-white rounded-xl border border-gray-200 p-3"
                    style={{ width: 280, boxShadow: "0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08)" }}>
                    <p className="text-[12px] font-semibold text-gray-700 mb-2">{isF ? "מתי תרצי הפסקה?" : "מתי תרצה הפסקה?"}</p>
                    <BreakSlotPicker
                      date={dateStr}
                      showClear
                      onPicked={() => { refreshBreaks(); setOpen(false); }}
                      onCleared={() => { refreshBreaks(); setOpen(false); }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
