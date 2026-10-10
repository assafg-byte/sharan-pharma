/**
 * Traffic-light staffing colors for the weekly schedule table.
 * The four colors are fixed (red / orange / yellow / green); what the manager
 * configures in Campus → Settings is the minimum headcount at which each
 * color kicks in. Default: 0 = red, 1 = orange, 2 = yellow, 3+ = green.
 */

export type TrafficLevel = "none" | "one" | "two" | "full";

/** Minimum number of employees for orange / yellow / green. Below `one` = red. */
export interface TrafficLightThresholds { one: number; two: number; full: number }

export const DEFAULT_THRESHOLDS: TrafficLightThresholds = { one: 1, two: 2, full: 3 };

export const MAX_THRESHOLD = 20;

const PALETTE: Record<TrafficLevel, { accent: string; bg: string; nameColor: string }> = {
  none: { accent: "#E24B4A", bg: "#FCEBEB", nameColor: "#A32D2D" },
  one:  { accent: "#EF9F27", bg: "#FAEEDA", nameColor: "#854F0B" },
  two:  { accent: "#EAB308", bg: "#FEF7D6", nameColor: "#7A5A04" },
  full: { accent: "#16A34A", bg: "#E3F4E5", nameColor: "#1F6B36" },
};

export const TRAFFIC_LEVELS: TrafficLevel[] = ["full", "two", "one", "none"];

export function levelFor(count: number, t: TrafficLightThresholds): TrafficLevel {
  if (count >= t.full) return "full";
  if (count >= t.two) return "two";
  if (count >= t.one) return "one";
  return "none";
}

export function paletteFor(count: number, t: TrafficLightThresholds) {
  return PALETTE[levelFor(count, t)];
}

export function paletteForLevel(level: TrafficLevel) {
  return PALETTE[level];
}

/** Headcount range a level covers, e.g. { lo: 2, hi: 2 } or { lo: 3, hi: null } (open-ended). */
function rangeOf(level: TrafficLevel, t: TrafficLightThresholds): { lo: number; hi: number | null } {
  switch (level) {
    case "none": return { lo: 0, hi: t.one - 1 };
    case "one":  return { lo: t.one, hi: t.two - 1 };
    case "two":  return { lo: t.two, hi: t.full - 1 };
    case "full": return { lo: t.full, hi: null };
  }
}

/** Legend label for a level under the current thresholds ("3+ עובדים", "עובד יחיד", …). */
export function levelLabel(level: TrafficLevel, t: TrafficLightThresholds): string {
  const { lo, hi } = rangeOf(level, t);
  if (hi === null) return `${lo}+ עובדים`;
  if (lo === hi) {
    if (lo === 0) return "ללא איוש ⚠️";
    if (lo === 1) return "עובד יחיד";
    return `${lo} עובדים`;
  }
  return lo === 0 ? `עד ${hi} עובדים ⚠️` : `${lo}–${hi} עובדים`;
}

/** Integers, strictly ascending: 1 ≤ one < two < full ≤ MAX_THRESHOLD. */
export function isValidThresholds(t: unknown): t is TrafficLightThresholds {
  if (!t || typeof t !== "object") return false;
  const { one, two, full } = t as Record<string, unknown>;
  return [one, two, full].every(Number.isInteger)
    && (one as number) >= 1 && (one as number) < (two as number)
    && (two as number) < (full as number) && (full as number) <= MAX_THRESHOLD;
}
