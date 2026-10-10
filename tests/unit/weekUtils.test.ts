import { describe, it, expect } from "vitest";
import { getWeekStart, weekKeyFromDate, addWeeks, formatWeekRange } from "@/types/index";

// ── getWeekStart ──────────────────────────────────────────────────────────────
describe("getWeekStart", () => {
  it("returns the same Sunday when given a Sunday", () => {
    const d = new Date("2026-05-17T12:00:00"); // Sunday
    const ws = getWeekStart(d);
    expect(ws.getDay()).toBe(0);
    expect(ws.getDate()).toBe(17);
    expect(ws.getMonth()).toBe(4); // May
  });

  it("rolls back to Sunday when given a Thursday", () => {
    const d = new Date("2026-05-21T10:00:00"); // Thursday
    const ws = getWeekStart(d);
    expect(ws.getDay()).toBe(0);
    expect(ws.getDate()).toBe(17);
  });

  it("rolls back to Sunday when given a Saturday", () => {
    const d = new Date("2026-05-23T08:00:00"); // Saturday
    const ws = getWeekStart(d);
    expect(ws.getDay()).toBe(0);
    expect(ws.getDate()).toBe(17);
  });

  it("normalises to midnight", () => {
    const ws = getWeekStart(new Date("2026-05-20T15:30:00"));
    expect(ws.getHours()).toBe(0);
    expect(ws.getMinutes()).toBe(0);
    expect(ws.getSeconds()).toBe(0);
  });
});

// ── weekKeyFromDate ───────────────────────────────────────────────────────────
describe("weekKeyFromDate", () => {
  it("returns the Sunday date string for a Sunday", () => {
    expect(weekKeyFromDate(new Date("2026-05-17T10:00:00"))).toBe("2026-05-17");
  });

  it("returns the Sunday date string for a mid-week day", () => {
    expect(weekKeyFromDate(new Date("2026-05-21T10:00:00"))).toBe("2026-05-17");
  });

  it("returns the Sunday date string for a Saturday", () => {
    expect(weekKeyFromDate(new Date("2026-05-23T10:00:00"))).toBe("2026-05-17");
  });

  it("correctly handles month boundaries", () => {
    // Fri May 29 2026 → Sunday May 24 2026 (getDay=5, so subtract 5 days)
    expect(weekKeyFromDate(new Date("2026-05-29T10:00:00"))).toBe("2026-05-24");
  });

  it("correctly handles year boundaries", () => {
    // Tue Jan 1 2030 → Sunday Dec 30 2029 (getDay=2, so subtract 2 days)
    const key = weekKeyFromDate(new Date("2030-01-01T10:00:00"));
    expect(key).toBe("2029-12-30");
  });

  it("format is YYYY-MM-DD with zero-padded month and day", () => {
    const key = weekKeyFromDate(new Date("2026-01-05T10:00:00")); // Monday Jan 5
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key).toBe("2026-01-04"); // Sunday Jan 4
  });
});

// ── addWeeks ──────────────────────────────────────────────────────────────────
describe("addWeeks", () => {
  const base = new Date("2026-05-17T10:00:00"); // Sunday

  it("adds 1 week correctly", () => {
    const result = addWeeks(base, 1);
    expect(result.getDate()).toBe(24);
    expect(result.getMonth()).toBe(4);
  });

  it("subtracts 1 week correctly", () => {
    const result = addWeeks(base, -1);
    expect(result.getDate()).toBe(10);
    expect(result.getMonth()).toBe(4);
  });

  it("adding 0 returns the same date", () => {
    const result = addWeeks(base, 0);
    expect(result.getTime()).toBe(base.getTime());
  });

  it("does not mutate the input date", () => {
    const before = base.getTime();
    addWeeks(base, 3);
    expect(base.getTime()).toBe(before);
  });

  it("handles month crossings", () => {
    const endOfMonth = new Date("2026-05-31T10:00:00");
    const result = addWeeks(endOfMonth, 1);
    expect(result.getMonth()).toBe(5); // June
    expect(result.getDate()).toBe(7);
  });
});

// ── formatWeekRange ───────────────────────────────────────────────────────────
describe("formatWeekRange", () => {
  it("formats a same-month week correctly", () => {
    const ws = new Date("2026-05-17T00:00:00");
    expect(formatWeekRange(ws)).toBe("17–21 מאי 2026");
  });

  it("formats a cross-month week correctly", () => {
    const ws = new Date("2026-05-31T00:00:00"); // Sun May 31 → Thu Jun 4
    const result = formatWeekRange(ws);
    expect(result).toContain("מאי");
    expect(result).toContain("יוני");
    expect(result).toContain("31");
    expect(result).toContain("4");
  });

  it("formats a January week with year", () => {
    const ws = new Date("2027-01-03T00:00:00"); // Sunday Jan 3 2027
    const result = formatWeekRange(ws);
    expect(result).toContain("2027");
    expect(result).toContain("ינואר");
  });
});
