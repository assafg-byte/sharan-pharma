export interface Employee {
  id: number;
  name: string;
  color: string;
  role?: string;
  gender?: string;
  dateOfBirth?: string;
  employeeType?: string;
  phone4?: string;
  archived?: boolean;
}

export interface Shift {
  id: number;
  employeeId: number;
  employee: Employee;
  dayOfWeek: number;   // 0=Sun .. 4=Thu
  startHour: number;   // 8.0, 8.5, 9.0 ... 15.5
  durationHours: number; // multiples of 0.5
  weekKey: string;     // "YYYY-MM-DD" of that week's Sunday
}

// ── Week utilities ────────────────────────────────────────────────────────────

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekKeyFromDate(date: Date): string {
  const d = getWeekStart(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

const MONTHS_HE = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

export function formatWeekRange(weekStart: Date): string {
  const sun = new Date(weekStart);
  const thu = new Date(weekStart);
  thu.setDate(sun.getDate() + 4);
  const month = MONTHS_HE[thu.getMonth()];
  const year = thu.getFullYear();
  if (sun.getMonth() === thu.getMonth()) {
    return `${sun.getDate()}–${thu.getDate()} ${month} ${year}`;
  }
  return `${sun.getDate()} ${MONTHS_HE[sun.getMonth()]}–${thu.getDate()} ${month} ${year}`;
}

// Days in Hebrew, order is right-to-left visually (Sun=right in RTL)
export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];

// Half-hour slots: 8.0, 8.5 ... 16.5  (18 slots, last 2 are "after hours")
export const SLOTS = Array.from({ length: 18 }, (_, i) => 8 + i * 0.5);
export const AFTER_HOURS_START = 16; // 16:00–17:00 shown in gray

// Manager day-note (top row of the edit grid) — soft character cap
export const DAY_NOTE_MAX_LENGTH = 100;
// Counter only appears once the note gets this long, to stay out of the way
// for short notes.
export const DAY_NOTE_COUNTER_THRESHOLD = 30;

export const SLOT_HEIGHT = 36; // px per 30-min slot
export const HOUR_HEIGHT = SLOT_HEIGHT * 2; // 72px per hour

export function formatTime(hour: number) {
  const h = Math.floor(hour);
  const m = hour % 1 === 0.5 ? "30" : "00";
  return `${h}:${m}`;
}

export const DEFAULT_COLORS = [
  "#2563EB", // vivid blue
  "#DC2626", // vivid red
  "#16A34A", // vivid green
  "#D97706", // vivid amber
  "#7C3AED", // vivid violet
  "#0891B2", // vivid cyan
  // Extra swatches — all dark enough for the white text on employee cards
  "#DB2777", // pink
  "#EA580C", // orange
  "#0D9488", // teal
  "#4F46E5", // indigo
  "#65A30D", // lime
  "#9333EA", // purple
  "#E11D48", // rose
  "#0284C7", // sky
  "#A16207", // mustard
  "#1E3A8A", // navy
  "#92400E", // brown
  "#57534E", // stone
];
