export interface ApprovedLeave { employeeId: number; date: string; toDate?: string | null }
export interface PtSlot { employeeId: number; dayOfWeek: number; startHour: number; endHour: number; available: boolean }

/** Returns the local date string ("YYYY-MM-DD") for weekStart + dayOfWeek days.
 *  Must format in local time — time-off dates are stored as local "YYYY-MM-DD"
 *  strings, and toISOString() shifts local midnight back to the previous day
 *  in UTC+ timezones like Israel. setDate handles DST transitions correctly
 *  because it normalizes in local time. */
export function shiftDate(weekStart: Date, dayOfWeek: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOfWeek);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ConflictReason = "time-off" | "unavailable";

export function checkConflict(
  empId: number,
  dayOfWeek: number,
  startHour: number,
  durationHours: number,
  dateStr: string,
  approvedLeave: ApprovedLeave[],
  ptSlots: PtSlot[],
): ConflictReason | null {
  // Day-level: approved time-off covering that calendar date.
  // "YYYY-MM-DD" strings compare correctly lexicographically.
  if (approvedLeave.some(r =>
    r.employeeId === empId &&
    r.date <= dateStr &&
    dateStr <= (r.toDate ?? r.date)
  )) {
    return "time-off";
  }

  // Hour-level: any unavailable slot that overlaps [startHour, startHour + durationHours)
  const shiftEnd = startHour + durationHours;
  const hasOverlap = ptSlots.some(
    s => s.employeeId === empId &&
         s.dayOfWeek === dayOfWeek &&
         !s.available &&
         s.startHour < shiftEnd &&
         s.endHour > startHour
  );
  if (hasOverlap) return "unavailable";

  return null;
}
