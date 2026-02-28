import { describe, it, expect } from "vitest";
import { formatShortDate } from "@/lib/utils/format";

describe("formatShortDate", () => {
  it("formats January date correctly", () => {
    const result = formatShortDate("2026-01-15T10:00:00Z");
    expect(result).toBe("JAN 15");
  });

  it("formats December date correctly", () => {
    // Use noon UTC to avoid timezone day-shift issues
    const result = formatShortDate("2026-12-25T12:00:00Z");
    expect(result).toBe("DEC 25");
  });

  it("handles single-digit days without padding", () => {
    const result = formatShortDate("2026-03-05T12:00:00Z");
    expect(result).toBe("MAR 5");
  });

  it("handles ISO date strings with timezone offset", () => {
    const result = formatShortDate("2026-06-20T15:30:00+05:00");
    // The exact day depends on local timezone, but the format should be "MON D"
    expect(result).toMatch(/^[A-Z]{3} \d{1,2}$/);
  });
});
