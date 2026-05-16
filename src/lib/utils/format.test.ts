import { describe, it, expect } from "vitest";
import { formatShortDate, stripCheckpointFooter } from "@/lib/utils/format";

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

describe("stripCheckpointFooter", () => {
  it("strips explicit Headline: prefix and trailing validation question", () => {
    const input =
      "I want to put something in your Manual.\n\nYou start from anxiety in your stomach. That's a thin wire to hang the whole thing on.\n\nHeadline: Stomach First, Then the Scan\n\nWhat would you change or sharpen?";
    expect(stripCheckpointFooter(input)).toBe(
      "I want to put something in your Manual.\n\nYou start from anxiety in your stomach. That's a thin wire to hang the whole thing on."
    );
  });

  it("strips a bare headline line when the validation question is present", () => {
    const input =
      "I want to put something in your Manual.\n\nThere is a thing your system does when pressure lands.\n\nProof-Giving as Protection\n\nWhat would you change or sharpen?";
    expect(stripCheckpointFooter(input)).toBe(
      "I want to put something in your Manual.\n\nThere is a thing your system does when pressure lands."
    );
  });

  it("strips Headline: prefix even when no validation question follows", () => {
    const input = "Pattern body here.\n\nHeadline: Body Goes Quiet";
    expect(stripCheckpointFooter(input)).toBe("Pattern body here.");
  });

  it("preserves a bare last paragraph when no validation question is present", () => {
    const input =
      "Pattern body here.\n\nThis is a real sentence the user should still see.";
    expect(stripCheckpointFooter(input)).toBe(input);
  });

  it("does not strip a final paragraph that ends with terminal punctuation", () => {
    const input =
      "Pattern body.\n\nAnother sentence that ends with a period.\n\nWhat would you change or sharpen?";
    expect(stripCheckpointFooter(input)).toBe(
      "Pattern body.\n\nAnother sentence that ends with a period."
    );
  });

  it("accepts the 'Where is this off?' variant of the validation question", () => {
    const input =
      "Pattern.\n\nHeadline: Foo Bar Baz\n\nWhere is this off?";
    expect(stripCheckpointFooter(input)).toBe("Pattern.");
  });

  it("leaves content untouched when no footer is present", () => {
    const input = "Just a regular Jove message. Nothing to strip here.";
    expect(stripCheckpointFooter(input)).toBe(input);
  });

  it("handles empty input", () => {
    expect(stripCheckpointFooter("")).toBe("");
  });

  it("does not strip a long final paragraph mistaken for a headline", () => {
    const longParagraph =
      "This is a long final paragraph that contains many more words than a headline would and should therefore not be treated as a structural footer element to remove";
    const input = `Pattern body.\n\n${longParagraph}\n\nWhat would you change or sharpen?`;
    expect(stripCheckpointFooter(input)).toBe(`Pattern body.\n\n${longParagraph}`);
  });
});
