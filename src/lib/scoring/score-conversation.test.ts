import { describe, it, expect } from "vitest";
import {
  buildNumberedTranscript,
  validateScoreResult,
} from "@/lib/scoring/score-conversation";
import { scoreAverage } from "@/lib/scoring/dimensions";

function validDimensions(score = 3) {
  return ["D1", "D2", "D3", "D4", "D5", "D6"].map((id) => ({
    id,
    score,
    citations: ["U2"],
    note: "note",
  }));
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    dimensions: validDimensions(),
    signals: {
      bare_yes_streak: "none",
      boundary_turn: "U4",
      correction_count: 2,
    },
    ruptures: [],
    predicted_bounce: null,
    strongest: "J3 handed the connection over",
    weakest: "J5 stated a summary",
    ...overrides,
  };
}

describe("buildNumberedTranscript", () => {
  it("numbers assistant turns J1… and user turns U1… independently, from the top", () => {
    const out = buildNumberedTranscript([
      { role: "assistant", content: "hi" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "go on" },
      { role: "user", content: "ok" },
    ]);
    expect(out).toBe("J1: hi\n\nU1: hello\n\nJ2: go on\n\nU2: ok");
  });

  it("renders system rows unnumbered as [system] and keeps J/U numbering unaffected", () => {
    const out = buildNumberedTranscript([
      { role: "assistant", content: "close line" },
      { role: "system", content: "Entry has been saved in your Manual." },
      { role: "assistant", content: "kept" },
    ]);
    expect(out).toContain("[system] Entry has been saved in your Manual.");
    expect(out).toContain("J2: kept");
  });

  it("skips empty-content rows without consuming a turn number", () => {
    const out = buildNumberedTranscript([
      { role: "user", content: "  " },
      { role: "user", content: "real" },
    ]);
    expect(out).toBe("U1: real");
  });

  it("truncates from the top when over budget and says so, preserving numbering", () => {
    const messages = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: "x".repeat(5000),
    }));
    const out = buildNumberedTranscript(messages);
    expect(out).toMatch(/^\[transcript truncated: the first \d+ turns are omitted/);
    expect(out.length).toBeLessThan(160_000);
    // The tail survives with its original numbering.
    expect(out).toContain("J30:");
  });
});

describe("validateScoreResult", () => {
  it("accepts a well-formed payload and normalizes it", () => {
    const result = validateScoreResult(validPayload());
    expect(result.dimensions).toHaveLength(6);
    expect(result.dimensions[0]).toEqual({
      id: "D1",
      score: 3,
      citations: ["U2"],
      note: "note",
    });
    expect(result.signals.correction_count).toBe(2);
    expect(result.predicted_bounce).toBeNull();
    expect(scoreAverage(result)).toBe(3);
  });

  it("throws when a dimension is missing", () => {
    const payload = validPayload({ dimensions: validDimensions().slice(0, 5) });
    expect(() => validateScoreResult(payload)).toThrow(/D6/);
  });

  it("throws on out-of-range or non-integer scores", () => {
    for (const bad of [0, 6, 3.5, "high", null]) {
      const dims = validDimensions();
      (dims[2] as { score: unknown }).score = bad;
      expect(() => validateScoreResult(validPayload({ dimensions: dims }))).toThrow(/D3/);
    }
  });

  it("defaults malformed optional fields instead of throwing", () => {
    const result = validateScoreResult(
      validPayload({
        signals: { correction_count: "nope" },
        ruptures: [{ type: "withdrawal" }, { at: "U9", type: "withdrawal", repaired: true }],
        predicted_bounce: "",
        strongest: 7,
      }),
    );
    expect(result.signals.bare_yes_streak).toBe("none");
    expect(result.signals.correction_count).toBe(0);
    // The at-less rupture is dropped; the real one survives.
    expect(result.ruptures).toEqual([
      { at: "U9", type: "withdrawal", repaired: true, note: "" },
    ]);
    expect(result.predicted_bounce).toBeNull();
    expect(result.strongest).toBe("");
  });
});
