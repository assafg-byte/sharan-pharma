import type { Shift } from "@/types";
import { DEFAULT_THRESHOLDS, paletteFor, type TrafficLightThresholds } from "@/lib/trafficLight";

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
const FIRST_H = 8;
const LAST_H = 16;
const HOURS = LAST_H - FIRST_H;

const SCALE   = 2;
const COL_W   = 140;
const TIME_W  = 60;
const ROW_H   = 78;
const HDR_H   = 40;
const FOOTER_H = 28;

// Same traffic light as the on-screen table, same thresholds.
function segColors(thresholds: TrafficLightThresholds, count: number) {
  const { bg, nameColor } = paletteFor(count, thresholds);
  return { bg, text: nameColor };
}

function fmt(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface Seg {
  start: number; end: number;
  employeeIds: number[]; finishing: number[];
}

function buildSegs(shifts: Shift[], dayIdx: number): Seg[] {
  const segs: (Seg & { key: string })[] = [];
  let cur: (Seg & { key: string }) | null = null;

  for (let h = FIRST_H; h < LAST_H; h++) {
    const working = shifts.filter(
      s => s.dayOfWeek === dayIdx && s.startHour < h + 1 && s.startHour + s.durationHours > h
    );
    const ids = [...new Set(working.map(s => s.employeeId))].sort((a, b) => a - b);
    const key = ids.join(",");
    if (cur && cur.key === key) {
      cur.end = h + 1;
    } else {
      if (cur) segs.push(cur);
      cur = { start: h, end: h + 1, key, employeeIds: ids, finishing: [] };
    }
  }
  if (cur) segs.push(cur);

  return segs.map(seg => ({
    ...seg,
    finishing: [...new Set(
      shifts
        .filter(s => s.dayOfWeek === dayIdx && s.startHour + s.durationHours === seg.end)
        .map(s => s.employeeId)
    )],
  }));
}

function getName(shifts: Shift[], id: number): string {
  return shifts.find(s => s.employeeId === id)?.employee.name ?? String(id);
}

export function buildExportCanvas(shifts: Shift[], thresholds: TrafficLightThresholds = DEFAULT_THRESHOLDS): HTMLCanvasElement {
  const totalW = TIME_W + 5 * COL_W;
  const totalH = HDR_H + HOURS * ROW_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width  = totalW * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalW, totalH);

  // RTL visual order: חמישי(4)…ראשון(0) left→right, then time gutter on far right
  // dayIdx 0 (ראשון) → canvas col 4, dayIdx 4 (חמישי) → canvas col 0
  const dayX = (dayIdx: number) => (4 - dayIdx) * COL_W;
  const timeX = 5 * COL_W;

  // ── Segment cells ──────────────────────────────────────────────────────────
  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    const segs = buildSegs(shifts, dayIdx);
    const x = dayX(dayIdx);

    for (const seg of segs) {
      const y = HDR_H + (seg.start - FIRST_H) * ROW_H;
      const h = (seg.end - seg.start) * ROW_H;
      const count = seg.employeeIds.length;
      const { bg, text } = segColors(thresholds, count);

      // Cell background
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, COL_W, h);

      // Cell border
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, COL_W - 1, h - 1);

      // Employee names, vertically centred
      const names = count === 0 ? ["אין עובד"] : seg.employeeIds.map(id => getName(shifts, id));
      const lineH = 22;
      const blockH = names.length * lineH;
      const nameStartY = y + h / 2 - blockH / 2 + lineH / 2;

      ctx.font = `bold 15px Rubik, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = text;
      names.forEach((name, i) => {
        ctx.fillText(name, x + COL_W / 2, nameStartY + i * lineH, COL_W - 12);
      });

      // "Finishing" italic line at bottom of cell (not last row)
      if (seg.end !== LAST_H && seg.finishing.length > 0) {
        const finishNames = seg.finishing.map(id => getName(shifts, id));
        const suffix = finishNames.length > 1 ? "ות" : "ת";
        const label = `- ${finishNames.join(", ")} מסיימ${suffix}`;
        ctx.save();
        ctx.direction = "rtl";
        ctx.font = `italic 10px Rubik, Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = text;
        ctx.globalAlpha = 0.75;
        ctx.fillText(label, x + COL_W / 2, y + h - 6, COL_W - 8);
        ctx.restore();
      }

      // Warning emoji (no worker)
      if (count === 0) {
        ctx.font = "14px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.globalAlpha = 1;
        ctx.fillText("⚠️", x + COL_W - 6, y + 5);
      }
    }
  }

  // ── Header row ─────────────────────────────────────────────────────────────
  ctx.fillStyle = "#f9fafb";
  ctx.fillRect(0, 0, totalW, HDR_H);

  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    const x = dayX(dayIdx);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 0.5, COL_W - 1, HDR_H - 1);

    ctx.font = "bold 14px Rubik, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#374151";
    ctx.fillText(DAYS_HE[dayIdx], x + COL_W / 2, HDR_H / 2);
  }

  // ── Time gutter ────────────────────────────────────────────────────────────
  for (let i = 0; i <= HOURS; i++) {
    const isFooter = i === HOURS;
    const y = HDR_H + i * ROW_H;
    const rowH = isFooter ? FOOTER_H : ROW_H;

    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(timeX, y, TIME_W, rowH);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(timeX + 0.5, y + 0.5, TIME_W - 1, rowH - 1);

    ctx.font = "600 11px Rubik, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = isFooter ? "#9ca3af" : "#6b7280";
    ctx.fillText(fmt(FIRST_H + i), timeX + 6, y + 5);
  }

  // ── Outer border ───────────────────────────────────────────────────────────
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, totalW - 1, totalH - 1);

  return canvas;
}
