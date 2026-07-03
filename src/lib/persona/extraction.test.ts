import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { mergeExtractionState, type ExtractionState } from "@/lib/persona/extraction";

function makeState(overrides?: Partial<ExtractionState>): ExtractionState {
  return {
    language_bank: [],
    depth: "surface",
    current_thread: "",
    checkpoint_gate: {
      distinct_contexts: 0,
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    sage_brief: "",
    ...overrides,
  };
}

describe("mergeExtractionState — state merge", () => {
  it("never lets distinct_contexts regress below the prior high-water mark", () => {
    const prev = makeState({ checkpoint_gate: { distinct_contexts: 2 } });
    const merged = mergeExtractionState(
      { checkpoint_gate: { distinct_contexts: 0 } },
      prev
    );
    expect(merged.checkpoint_gate.distinct_contexts).toBe(2);
  });
});

// Layer-type coercion (2026-06-03 doom-loop incident): the model intermittently
// emits language_bank layer ids as strings ("1"). Normalize at the parse
// boundary so downstream comparisons are number-to-number.
describe("mergeExtractionState — layer type coercion", () => {
  it("coerces string layer ids in the language bank to numbers", () => {
    const merged = mergeExtractionState(
      {
        language_bank: [
          { phrase: "x", context: "y", charge: "high", layers: ["1", "4"] },
        ],
      },
      makeState()
    );
    expect(merged.language_bank[0].layers).toEqual([1, 4]);
  });

  it("drops malformed layer ids rather than carrying garbage forward", () => {
    const merged = mergeExtractionState(
      {
        language_bank: [
          { phrase: "x", context: "y", charge: "high", layers: ["9", "abc", 2] },
        ],
      },
      makeState()
    );
    // 9 is out of range, "abc" is non-numeric, 2 is valid.
    expect(merged.language_bank[0].layers).toEqual([2]);
  });
});


// ── Prompt-cache wiring ──
// Extraction is per-turn and runs against a hefty system prompt
// (EXTRACTION_SYSTEM — the five-layer model, all analysis priorities,
// JSON shape). Caching the system block cuts the extractor's input cost
// dramatically. Source-contract tests because the API silently degrades
// to an uncached call when the request shape is wrong.

describe("extraction — prompt-cache wiring", () => {
  const src = readFileSync(
    join(process.cwd(), "src/lib/persona/extraction.ts"),
    "utf-8"
  );

  it("sends `system` as an array containing EXTRACTION_SYSTEM with cache_control", () => {
    // Look for the anthropicFetch call shape: array literal with the
    // EXTRACTION_SYSTEM constant marked ephemeral.
    expect(src).toMatch(
      /system:\s*\[\s*\{\s*type:\s*"text",\s*text:\s*EXTRACTION_SYSTEM,\s*cache_control:\s*\{\s*type:\s*"ephemeral"\s*\}/
    );
  });

  it("emits a cache_performance log event with surface=extraction", () => {
    expect(src).toContain('event: "cache_performance"');
    expect(src).toContain('surface: "extraction"');
    expect(src).toContain("response.usage?.cache_read_input_tokens");
    expect(src).toContain("response.usage?.cache_creation_input_tokens");
  });

  it("references the response.usage shape (extends AnthropicResponse contract)", () => {
    expect(src).toContain("response.usage?.input_tokens");
    expect(src).toContain("response.usage?.output_tokens");
  });
});
