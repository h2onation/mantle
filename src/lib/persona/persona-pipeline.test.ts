import { describe, it, expect } from "vitest";
import {
  validateMaterialQuality,
  validateComposedEntry,
  applyCheckpointGates,
  computeInheritedRefinementCount,
  buildEntriesSummary,
} from "@/lib/persona/persona-pipeline";
import type { ExtractionState } from "@/lib/persona/extraction";

function makeExtractionState(
  overrides?: Partial<ExtractionState>
): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [], dimensions: [] },
      2: { signal: "none", material: [], examples: [], dimensions: [] },
      3: { signal: "none", material: [], examples: [], dimensions: [] },
      4: { signal: "none", material: [], examples: [], dimensions: [] },
      5: { signal: "none", material: [], examples: [], dimensions: [] },
    },
    language_bank: [],
    depth: "surface",
    current_thread: "",
    mode: "situation_led",
    checkpoint_gate: {
      concrete_examples: 0,
      has_mechanism: false,
      has_charged_language: false,
      has_behavior_driver_link: false,
      strongest_layer: null,
    },
    clinical_flag: { active: false, level: "none", note: "" },
    observation_miss_count: 0,
    next_prompt: "",
    sage_brief: "",
    emerging_pattern_snippet: null,
    ...overrides,
  };
}

describe("validateMaterialQuality", () => {
  it("returns ok when state is null (no signal yet)", () => {
    const result = validateMaterialQuality(null, false);
    expect(result.ok).toBe(true);
  });

  it("blocks during crisis regardless of other criteria", () => {
    const state = makeExtractionState({
      clinical_flag: { active: true, level: "crisis", note: "self-harm" },
      checkpoint_gate: {
        concrete_examples: 5,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toMatch(/crisis/i);
  });

  it("requires 2 scenes for the standard gate", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/concrete scenes/);
  });

  it("requires 1 scene for the first-checkpoint gate", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: false,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, true);
    expect(result.ok).toBe(true);
  });

  it("first-checkpoint gate fails when neither mechanism nor link is present", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 1,
        has_mechanism: false,
        has_charged_language: true,
        has_behavior_driver_link: false,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, true);
    expect(result.ok).toBe(false);
  });

  it("standard gate passes when all four criteria are met", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = validateMaterialQuality(state, false);
    expect(result.ok).toBe(true);
  });
});

describe("validateComposedEntry", () => {
  const goodEntry = `You walk into a room and a second version of you switches on. It watches faces, times the nods, keeps your voice at the right volume, softens the parts of you that would read as too much. You don't decide to do this. It runs. By the end of the day the buzzing starts in your jaw and your thoughts get slower. You lose the evening and you call it being tired. You can't stop running the second version because the real one got flagged as too much a long time ago. The cost is that almost nobody in your life has met the real one, including you on the days when you come home and go straight to the dark room.`;

  it("passes for a well-formed entry with body anchor", () => {
    const result = validateComposedEntry(goodEntry);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("warns when entry is too short", () => {
    const result = validateComposedEntry(
      "You shut down. Your jaw goes tight. That's it."
    );
    expect(result.ok).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/too short/);
  });

  it("warns when entry exceeds the 150-word upper bound", () => {
    const tooLong = Array(200).fill("Your jaw goes tight").join(". ") + ".";
    const result = validateComposedEntry(tooLong);
    expect(result.ok).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/too long/);
    expect(result.warnings.join(" ")).toMatch(/150/);
  });

  it("warns when entry has no somatic anchor word", () => {
    const cerebral = Array(160).fill("You think about it carefully").join(". ") + ".";
    const result = validateComposedEntry(cerebral);
    expect(result.warnings.join(" ")).toMatch(/no somatic anchor/);
  });

  it("warns when a clinical label leaks through", () => {
    const text = goodEntry + " This is your trauma response.";
    const result = validateComposedEntry(text);
    expect(result.warnings.join(" ")).toMatch(/clinical label/);
  });

  it("warns when a time reference leaks through", () => {
    const text = goodEntry + " Right now this is happening.";
    const result = validateComposedEntry(text);
    expect(result.warnings.join(" ")).toMatch(/time reference/);
  });
});

describe("applyCheckpointGates with material quality", () => {
  it("blocks a checkpoint when extraction state shows insufficient material", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 0,
        has_mechanism: false,
        has_charged_language: false,
        has_behavior_driver_link: false,
        strongest_layer: null,
      },
    });
    const result = applyCheckpointGates(
      { layer: 1, name: "test" },
      [],
      10, // plenty of turns since last checkpoint
      state,
      false
    );
    expect(result.isCheckpoint).toBe(false);
  });

  it("permits the checkpoint when extraction state confirms quality", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = applyCheckpointGates(
      { layer: 1, name: "test" },
      [],
      10,
      state,
      false
    );
    expect(result.isCheckpoint).toBe(true);
  });

  it("still applies the turn-count gate after material quality passes", () => {
    const state = makeExtractionState({
      checkpoint_gate: {
        concrete_examples: 2,
        has_mechanism: true,
        has_charged_language: true,
        has_behavior_driver_link: true,
        strongest_layer: 1,
      },
    });
    const result = applyCheckpointGates(
      { layer: 1, name: "test" },
      [],
      2, // too soon since last checkpoint
      state,
      false
    );
    expect(result.isCheckpoint).toBe(false);
  });

  it("preserves backward compatibility when extraction state is omitted", () => {
    const result = applyCheckpointGates(
      { layer: 1, name: "test" },
      [],
      10
    );
    expect(result.isCheckpoint).toBe(true);
  });
});

// ─── Refinement-count chain inheritance (Track A Phase 7-Mid) ──────────────
describe("computeInheritedRefinementCount", () => {
  it("returns 0 when there is no previous checkpoint", () => {
    expect(computeInheritedRefinementCount(null)).toBe(0);
  });

  it("returns 0 when previous status is confirmed (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "confirmed",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is rejected (chain broken)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "rejected",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous status is pending (defensive — not a chain state)", () => {
    expect(
      computeInheritedRefinementCount({
        status: "pending",
        refinement_count: 5,
      })
    ).toBe(0);
  });

  it("returns 0 when previous count is undefined (legacy meta rows pre-Phase-7-Mid)", () => {
    expect(
      computeInheritedRefinementCount({ status: "refined" })
    ).toBe(0);
  });

  it("inherits the previous count when previous status is refined", () => {
    expect(
      computeInheritedRefinementCount({
        status: "refined",
        refinement_count: 1,
      })
    ).toBe(1);
  });

  // The case Phase 7-Mid spec called out explicitly to document via
  // a test name. Naming this case "across distinct entries" makes the
  // intent searchable in the codebase: yes, a fresh entry inherits
  // the chain count, and yes, that is intended behavior.
  it("refinement count inherits across distinct entries when chain is unbroken", () => {
    // Setup: the user refined two prior entries about an entirely
    // different topic (call them E1 about topic A, then E2 about topic
    // A again, both refined). Server now composes E3, which happens
    // to be about topic B (a fresh emerging pattern). The chain rule
    // is structural — it looks only at the previous checkpoint's
    // status, not at semantic similarity. Because E2 was refined with
    // count=2, E3 inherits count=2 even though it is about a
    // different topic.
    //
    // Result: the user sees the refinement-ceiling card UI on E3's
    // first attempt. They can accept E3 as-is or let it go.
    //
    // This is intended behavior. Detecting "same pattern" semantically
    // would require fuzzy LLM judgment we do not have. In practice,
    // refinements happen rapidly enough that an unbroken chain is the
    // right proxy for "the user has already pushed back twice and
    // would rather move on than refine a third time." If a user does
    // hit this case across genuinely distinct topics, hitting "Let it
    // go" on E3 breaks the chain (next entry starts fresh at 0).
    const e2RefinedMeta = {
      status: "refined" as const,
      refinement_count: 2,
    };
    expect(computeInheritedRefinementCount(e2RefinedMeta)).toBe(2);
  });
});

// ─── Entries-summary builder (Track A Phase 7-High) ────────────────────────
describe("buildEntriesSummary", () => {
  it("uses singular 'has material' when only one layer is populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 2,
        confirmedLayerName: "Some of My Patterns",
        otherLayersWithMaterial: [],
        remainingEmptyCount: 4,
      })
    ).toBe(
      "2 entries. Some of My Patterns has material. 4 still empty."
    );
  });

  it("uses 'X and Y have material' when exactly two layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 3,
        confirmedLayerName: "How I Process Things",
        otherLayersWithMaterial: ["Some of My Patterns"],
        remainingEmptyCount: 3,
      })
    ).toBe(
      "3 entries. How I Process Things and Some of My Patterns have material. 3 still empty."
    );
  });

  it("uses Oxford-comma joining when three or more layers are populated", () => {
    expect(
      buildEntriesSummary({
        entryCount: 4,
        confirmedLayerName: "What Helps",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
        ],
        remainingEmptyCount: 2,
      })
    ).toBe(
      "4 entries. What Helps, Some of My Patterns, and How I Process Things have material. 2 still empty."
    );
  });

  it("puts the just-confirmed layer first, then the other layers in input order", () => {
    // The confirmedLayerName always leads so the user sees "their new
    // entry's layer" highlighted in the recap.
    const result = buildEntriesSummary({
      entryCount: 5,
      confirmedLayerName: "Where I'm Strong",
      otherLayersWithMaterial: [
        "Some of My Patterns",
        "How I Process Things",
      ],
      remainingEmptyCount: 2,
    });
    const idx1 = result.indexOf("Where I'm Strong");
    const idx2 = result.indexOf("Some of My Patterns");
    expect(idx1).toBeLessThan(idx2);
  });

  it("handles all five layers populated — zero remaining", () => {
    // Not a special case in the spec; the downstream prompt treats
    // "0 still empty" as valid copy.
    expect(
      buildEntriesSummary({
        entryCount: 5,
        confirmedLayerName: "Where I'm Strong",
        otherLayersWithMaterial: [
          "Some of My Patterns",
          "How I Process Things",
          "What Helps",
          "How I Show Up with People",
        ],
        remainingEmptyCount: 0,
      })
    ).toContain("0 still empty.");
  });
});
