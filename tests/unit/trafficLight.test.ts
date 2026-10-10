import { describe, it, expect } from "vitest";
import { levelFor, levelLabel, isValidThresholds, DEFAULT_THRESHOLDS } from "@/lib/trafficLight";

describe("traffic light levels", () => {
  it("defaults to 0 red / 1 orange / 2 yellow / 3+ green", () => {
    expect(levelFor(0, DEFAULT_THRESHOLDS)).toBe("none");
    expect(levelFor(1, DEFAULT_THRESHOLDS)).toBe("one");
    expect(levelFor(2, DEFAULT_THRESHOLDS)).toBe("two");
    expect(levelFor(3, DEFAULT_THRESHOLDS)).toBe("full");
    expect(levelFor(7, DEFAULT_THRESHOLDS)).toBe("full");
  });

  it("follows custom thresholds", () => {
    const t = { one: 2, two: 3, full: 5 };
    expect(levelFor(1, t)).toBe("none");
    expect(levelFor(2, t)).toBe("one");
    expect(levelFor(4, t)).toBe("two");
    expect(levelFor(5, t)).toBe("full");
  });

  it("labels ranges for the legend", () => {
    expect(levelLabel("none", DEFAULT_THRESHOLDS)).toBe("ללא איוש ⚠️");
    expect(levelLabel("one", DEFAULT_THRESHOLDS)).toBe("עובד יחיד");
    expect(levelLabel("two", DEFAULT_THRESHOLDS)).toBe("2 עובדים");
    expect(levelLabel("full", DEFAULT_THRESHOLDS)).toBe("3+ עובדים");
    const t = { one: 2, two: 3, full: 5 };
    expect(levelLabel("none", t)).toBe("עד 1 עובדים ⚠️");
    expect(levelLabel("two", t)).toBe("3–4 עובדים");
  });

  it("requires strictly ascending integers from 1 to 20", () => {
    expect(isValidThresholds({ one: 1, two: 2, full: 3 })).toBe(true);
    expect(isValidThresholds({ one: 0, two: 2, full: 3 })).toBe(false);
    expect(isValidThresholds({ one: 2, two: 2, full: 3 })).toBe(false);
    expect(isValidThresholds({ one: 1, two: 2, full: 21 })).toBe(false);
    expect(isValidThresholds({ one: 1.5, two: 2, full: 3 })).toBe(false);
    expect(isValidThresholds(null)).toBe(false);
  });
});
