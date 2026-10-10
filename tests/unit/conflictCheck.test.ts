import { describe, it, expect } from "vitest";
import { shiftDate, checkConflict, type ApprovedLeave, type PtSlot } from "@/lib/conflictCheck";

describe("shiftDate", () => {
  // Regression: toISOString() shifted local midnight to the previous UTC day
  // in UTC+ timezones (Israel), making time-off warnings fire a day early.
  it("returns the local calendar date for the week start itself", () => {
    const weekStart = new Date(2026, 5, 28); // Sunday 2026-06-28, local midnight
    expect(shiftDate(weekStart, 0)).toBe("2026-06-28");
  });

  it("adds dayOfWeek days in local time", () => {
    const weekStart = new Date(2026, 5, 28);
    expect(shiftDate(weekStart, 1)).toBe("2026-06-29");
    expect(shiftDate(weekStart, 4)).toBe("2026-07-02");
  });

  it("crosses month boundaries correctly", () => {
    const weekStart = new Date(2026, 6, 26); // Sunday 2026-07-26
    expect(shiftDate(weekStart, 4)).toBe("2026-07-30");
    const weekStart2 = new Date(2026, 6, 29);
    expect(shiftDate(weekStart2, 3)).toBe("2026-08-01");
  });

  it("is stable across Israel DST transitions", () => {
    // Israel leaves DST on 2026-10-25 (Sunday); the week spans the change
    const weekStart = new Date(2026, 9, 25);
    expect(shiftDate(weekStart, 0)).toBe("2026-10-25");
    expect(shiftDate(weekStart, 1)).toBe("2026-10-26");
    expect(shiftDate(weekStart, 4)).toBe("2026-10-29");
  });
});

describe("checkConflict — time-off", () => {
  const noSlots: PtSlot[] = [];

  it("flags a single-day leave on its exact date", () => {
    const leave: ApprovedLeave[] = [{ employeeId: 1, date: "2026-06-29" }];
    expect(checkConflict(1, 1, 9, 1, "2026-06-29", leave, noSlots)).toBe("time-off");
    expect(checkConflict(1, 0, 9, 1, "2026-06-28", leave, noSlots)).toBeNull();
    expect(checkConflict(1, 2, 9, 1, "2026-06-30", leave, noSlots)).toBeNull();
  });

  // Regression: only the start date of a multi-day request used to conflict.
  it("flags every day of a multi-day leave range", () => {
    const leave: ApprovedLeave[] = [{ employeeId: 1, date: "2026-06-29", toDate: "2026-07-01" }];
    expect(checkConflict(1, 1, 9, 1, "2026-06-29", leave, noSlots)).toBe("time-off");
    expect(checkConflict(1, 2, 9, 1, "2026-06-30", leave, noSlots)).toBe("time-off");
    expect(checkConflict(1, 3, 9, 1, "2026-07-01", leave, noSlots)).toBe("time-off");
    expect(checkConflict(1, 0, 9, 1, "2026-06-28", leave, noSlots)).toBeNull();
    expect(checkConflict(1, 4, 9, 1, "2026-07-02", leave, noSlots)).toBeNull();
  });

  it("ignores other employees' leave", () => {
    const leave: ApprovedLeave[] = [{ employeeId: 2, date: "2026-06-29", toDate: "2026-07-01" }];
    expect(checkConflict(1, 1, 9, 1, "2026-06-30", leave, noSlots)).toBeNull();
  });
});

describe("checkConflict — part-time availability", () => {
  const noLeave: ApprovedLeave[] = [];
  const slots: PtSlot[] = [
    { employeeId: 1, dayOfWeek: 2, startHour: 12, endHour: 14, available: false },
  ];

  it("flags a shift overlapping an unavailable window", () => {
    expect(checkConflict(1, 2, 11, 2, "2026-06-30", noLeave, slots)).toBe("unavailable");
    expect(checkConflict(1, 2, 13.5, 1, "2026-06-30", noLeave, slots)).toBe("unavailable");
  });

  it("allows a shift touching but not overlapping the window", () => {
    expect(checkConflict(1, 2, 10, 2, "2026-06-30", noLeave, slots)).toBeNull();
    expect(checkConflict(1, 2, 14, 2, "2026-06-30", noLeave, slots)).toBeNull();
  });

  it("ignores unavailable windows on other days", () => {
    expect(checkConflict(1, 3, 12, 2, "2026-07-01", noLeave, slots)).toBeNull();
  });
});
