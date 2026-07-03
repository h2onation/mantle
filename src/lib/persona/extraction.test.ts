import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { mergeExtractionState, type ExtractionState } from "@/lib/persona/extraction";

function makeState(overrides?: Partial<ExtractionState>): ExtractionState {
  return {
    layers: {
      1: { signal: "none" },
      2: { signal: "none" },
      3: { signal: "none" },
      4: { signal: "none" },
      5: { signal: "none" },
    },
    language_bank: [],
    depth: "surface",
    current_thread: "",
    checkpoint_gate: {
      concrete_examples: 0,
      has_mechanism: false,
      has_charged_language: false,
      has_behavior_driver_link: false,
      strongest_layer: null,
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    sage_brief: "",
    pattern_engaged: false,
    ...overrides,
  };
}

describe("mergeExtractionState — state merge", () => {
  it("resets pattern_engaged true → false when the model reports an explicit reversal", () => {
    const prev = makeState({ pattern_engaged: true });
    const merged = mergeExtractionState({ pattern_engaged: false }, prev);
    expect(merged.pattern_engaged).toBe(false);
  });

  it("keeps pattern_engaged true when the model omits it (no boolean reported)", () => {
    const prev = makeState({ pattern_engaged: true });
    const merged = mergeExtractionState({}, prev);
    expect(merged.pattern_engaged).toBe(true);
  });

  it("sets pattern_engaged false → true when the model reports engagement", () => {
    const prev = makeState({ pattern_engaged: false });
    const merged = mergeExtractionState({ pattern_engaged: true }, prev);
    expect(merged.pattern_engaged).toBe(true);
  });

  it("never lets the gate counts regress below the prior high-water mark", () => {
    const prev = makeState({
      checkpoint_gate: {
        concrete_examples: 3,
        distinct_contexts: 2,
        has_mechanism: false,
        has_charged_language: false,
        has_behavior_driver_link: false,
        strongest_layer: null,
      },
    });
    const merged = mergeExtractionState(
      { checkpoint_gate: { concrete_examples: 1, distinct_contexts: 0, strongest_layer: 2 } },
      prev
    );
    expect(merged.checkpoint_gate.concrete_examples).toBe(3);
    expect(merged.checkpoint_gate.distinct_contexts).toBe(2);
    // non-count fields take the incoming value
    expect(merged.checkpoint_gate.strongest_layer).toBe(2);
  });
});

// Layer-type coercion (2026-06-03 doom-loop incident). The model intermittently
// emits layer ids as strings ("1"). Left uncoerced, a string strongest_layer
// broke the gate's strict-equality membership against numeric language_bank
// layers ([1].includes("1") === false), suppressing every ready checkpoint.
// Normalize at the parse boundary so everything downstream compares numbers.
describe("mergeExtractionState — layer type coercion", () => {
  it("coerces a string strongest_layer to a number", () => {
    const merged = mergeExtractionState(
      {
        checkpoint_gate: {
          concrete_examples: 5,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: "1",
        },
      },
      makeState()
    );
    expect(merged.checkpoint_gate.strongest_layer).toBe(1);
  });

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

  it("leaves a null strongest_layer as null", () => {
    const merged = mergeExtractionState(
      {
        checkpoint_gate: {
          concrete_examples: 0,
          has_mechanism: false,
          has_charged_language: false,
          has_behavior_driver_link: false,
          strongest_layer: null,
        },
      },
      makeState()
    );
    expect(merged.checkpoint_gate.strongest_layer).toBeNull();
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
