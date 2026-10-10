import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/components/DailyChecklist";

describe("renderTemplate", () => {
  it("replaces {name} with the employee name", () => {
    expect(renderTemplate("שלום {name}!", "נועה", "F")).toBe("שלום נועה!");
  });

  it("picks the male form from {male|female} pairs", () => {
    expect(renderTemplate("האם {אתה נכנס|את נכנסת} למשמרת?", "דן", "M"))
      .toBe("האם אתה נכנס למשמרת?");
  });

  it("picks the female form from {male|female} pairs", () => {
    expect(renderTemplate("האם {אתה נכנס|את נכנסת} למשמרת?", "נועה", "F"))
      .toBe("האם את נכנסת למשמרת?");
  });

  it("handles the full seeded greeting", () => {
    expect(renderTemplate("שלום {name}! האם {אתה נכנס|את נכנסת} למשמרת?", "נועה קירל", "F"))
      .toBe("שלום נועה קירל! האם את נכנסת למשמרת?");
  });

  it("leaves plain text and slashes untouched", () => {
    const text = "האם יש מטופלים מטבלת ההשלמות/משיבון?";
    expect(renderTemplate(text, "דן", "M")).toBe(text);
  });

  it("supports an empty male or female side", () => {
    expect(renderTemplate("נכנס{|ת}", "x", "F")).toBe("נכנסת");
    expect(renderTemplate("נכנס{|ת}", "x", "M")).toBe("נכנס");
  });
});
