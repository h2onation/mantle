import { describe, it, expect } from "vitest";
import {
  validateMaterialQuality,
  validateComposedEntry,
  applyCheckpointGates,
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
    next_prompt: "",
    sage_brief: "",
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
