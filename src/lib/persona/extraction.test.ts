import { describe, it, expect } from "vitest";
import { formatExtractionForPersona, type ExtractionState } from "@/lib/persona/extraction";
import { LAYER_NAMES } from "@/lib/manual/layers";

function makeState(overrides?: Partial<ExtractionState>): ExtractionState {
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
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    observation_miss_count: 0,
    early_frame_delivered: false,
    depth_signal_delivered: false,
    approaching_signal_delivered: false,
    next_prompt: "",
    sage_brief: "",
    ...overrides,
  };
}

describe("formatExtractionForPersona", () => {
  describe("schema names do not leak", () => {
    it("does not contain raw schema labels", () => {
      const state = makeState({
        sage_brief: "test brief",
        depth: "mechanism",
        mode: "direct_exploration",
        current_thread: "test thread",
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForPersona(state, false);
      // Old structural names must not appear anywhere
      expect(result).not.toContain("FIELD NOTES");
      expect(result).not.toContain("LAYER SIGNALS");
      expect(result).not.toContain("EXTRACTION CONTEXT");
      expect(result).not.toContain("CHECKPOINT: READY");
      expect(result).not.toContain("CHECKPOINT: NOT READY");
      expect(result).not.toContain("EXISTING CONTENT ON TARGET LAYER");
      expect(result).not.toContain("DEPTH:");
      expect(result).not.toContain("MODE:");
      expect(result).not.toContain("THREAD:");
      expect(result).not.toContain("⚠ CRISIS");
      expect(result).not.toContain("⚠ CLINICAL CAUTION");
    });
  });

  describe("brief paragraph", () => {
    it("includes the sage_brief paragraph when present", () => {
      const state = makeState({ sage_brief: "User is exploring conflict avoidance." });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("User is exploring conflict avoidance.");
      expect(result).toContain("What's underneath this conversation");
    });

    it("omits the brief paragraph when sage_brief is empty", () => {
      const state = makeState({ sage_brief: "" });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("What's underneath this conversation");
    });
  });

  describe("layer signals", () => {
    it("renders all 5 layers with their canonical names", () => {
      const state = makeState();
      const result = formatExtractionForPersona(state, false);
      for (let i = 1; i <= 5; i++) {
        expect(result).toContain(`- ${LAYER_NAMES[i]}: untouched`);
      }
    });

    it("uses natural-language signal labels", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "emerging", material: [], examples: [], dimensions: [] },
          2: { signal: "explored", material: [], examples: [], dimensions: [] },
          3: { signal: "checkpoint_ready", material: [], examples: [], dimensions: [] },
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("starting to surface");
      expect(result).toContain("well explored");
      expect(result).toContain("ready to be reflected back");
    });

    it("includes recent threads (last 3) for layers with material", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: {
            signal: "emerging",
            material: ["first", "second", "third", "fourth"],
            examples: [],
            dimensions: [],
          },
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("second; third; fourth");
      expect(result).not.toContain("first;");
    });
  });

  describe("language bank", () => {
    it("filters to medium and high charge only", () => {
      const state = makeState({
        language_bank: [
          { phrase: "low phrase", context: "test", charge: "low", layers: [1] },
          { phrase: "medium phrase", context: "test", charge: "medium", layers: [1] },
          { phrase: "high phrase", context: "test", charge: "high", layers: [2] },
        ],
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("medium phrase");
      expect(result).toContain("high phrase");
      expect(result).not.toContain("low phrase");
    });

    it("limits language bank to last 15 entries", () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        phrase: `phrase-${i}`,
        context: "test",
        charge: "high" as const,
        layers: [1],
      }));
      const state = makeState({ language_bank: entries });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("phrase-5");
      expect(result).toContain("phrase-19");
      expect(result).not.toContain("phrase-4");
    });
  });

  describe("checkpoint readiness — standard", () => {
    it("signals enough material when all standard criteria met", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("enough material here to reflect a piece back");
      expect(result).toContain(LAYER_NAMES[3]);
    });

    it("signals not enough yet, with the missing reasons in plain English", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: false,
          has_charged_language: false,
          has_behavior_driver_link: false,
          strongest_layer: null,
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Not enough yet to reflect a piece back");
      expect(result).toContain("more concrete scene");
      expect(result).toContain("haven't reached the mechanism");
      expect(result).toContain("haven't captured a phrase");
    });

    it("does not mention mechanism gap when has_mechanism is true", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 0,
          has_mechanism: true,
          has_charged_language: false,
          has_behavior_driver_link: false,
          strongest_layer: null,
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("haven't reached the mechanism");
    });
  });

  describe("checkpoint readiness — first checkpoint (lighter)", () => {
    it("ready with: 1 example + charged language + mechanism", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: false,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForPersona(state, true);
      expect(result).toContain("enough material here to reflect a piece back");
    });

    it("ready with: 1 example + charged language + behavior_driver_link", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: false,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 2,
        },
      });
      const result = formatExtractionForPersona(state, true);
      expect(result).toContain("enough material here to reflect a piece back");
    });

    it("not ready when first checkpoint and no charged language", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: false,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForPersona(state, true);
      expect(result).toContain("Not enough yet");
    });

    it("no longer inlines the first-reflection wrapper note (wrapper moved to approaching signal)", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: false,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForPersona(state, true);
      expect(result).not.toContain("very first reflection");
      expect(result).not.toContain("one-time wrapper");
    });
  });

  describe("existing content on the strongest layer", () => {
    it("surfaces existing content when ready and matching components exist", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const components = [
        { layer: 1, name: "The Fixer", content: "You always step in..." },
      ];
      const result = formatExtractionForPersona(state, false, components);
      expect(result).toContain("What's already in the manual");
      expect(result).toContain(LAYER_NAMES[1]);
      expect(result).toContain("You always step in...");
    });

    it("omits existing-content section when no matching components", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const components = [
        { layer: 3, name: null, content: "Different layer" },
      ];
      const result = formatExtractionForPersona(state, false, components);
      expect(result).not.toContain("What's already in the manual");
    });
  });

  describe("depth, mode, thread", () => {
    it("describes depth and approach in natural language", () => {
      const state = makeState({ depth: "mechanism", mode: "direct_exploration" });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("How deep this conversation has gone: mechanism");
      expect(result).toContain("Current approach: direct_exploration");
    });

    it("includes the current thread when present", () => {
      const state = makeState({ current_thread: "conflict with partner" });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("What's actually being explored right now: conflict with partner");
    });

    it("omits the thread line when current_thread is empty", () => {
      const state = makeState({ current_thread: "" });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("What's actually being explored");
    });
  });

  describe("clinical flag", () => {
    it("surfaces a safety note when crisis is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "User expressed suicidal ideation" },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Safety note:");
      expect(result).toContain("User expressed suicidal ideation");
      expect(result).toContain("Stop building");
    });

    it("surfaces a care note when caution is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "caution", note: "User asked if they have ADHD" },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Care note:");
      expect(result).toContain("User asked if they have ADHD");
      expect(result).toContain("Stay in behavioral description");
    });

    it("does NOT include any clinical note when level is none", () => {
      const state = makeState({
        clinical_flag: { active: false, level: "none", note: "" },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("Safety note");
      expect(result).not.toContain("Care note");
    });

    it("blocks the ready signal when crisis is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "Self-harm intent" },
        checkpoint_gate: {
          concrete_examples: 3,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Not enough yet");
    });

    it("does NOT block the ready signal when only caution is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "caution", note: "Diagnostic question" },
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
        },
      });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("enough material here to reflect a piece back");
    });

    it("safety note appears before the readiness sentence", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "Crisis detected" },
      });
      const result = formatExtractionForPersona(state, false);
      const safetyIdx = result.indexOf("Safety note:");
      const readyIdx = result.indexOf("reflect a piece back");
      expect(safetyIdx).toBeGreaterThanOrEqual(0);
      expect(readyIdx).toBeGreaterThan(safetyIdx);
    });
  });

  describe("observation miss tracking", () => {
    it("omits any miss warning when count is 0", () => {
      const state = makeState({ observation_miss_count: 0 });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("didn't land");
      expect(result).not.toContain("Full reset");
    });

    it("omits any miss warning when count is 1", () => {
      const state = makeState({ observation_miss_count: 1 });
      const result = formatExtractionForPersona(state, false);
      expect(result).not.toContain("didn't land");
      expect(result).not.toContain("Full reset");
    });

    it("injects a grounding nudge when count is 2", () => {
      const state = makeState({ observation_miss_count: 2 });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Last two observations didn't land");
      expect(result).toContain("pure grounding");
      expect(result).not.toContain("Full reset");
    });

    it("injects a full reset when count is 3 or higher", () => {
      const state = makeState({ observation_miss_count: 3 });
      const result = formatExtractionForPersona(state, false);
      expect(result).toContain("Three misses");
      expect(result).toContain("Full reset");
      expect(result).not.toContain("Last two observations didn't land");
    });

    it("miss warning appears before the sage_brief paragraph", () => {
      const state = makeState({
        observation_miss_count: 2,
        sage_brief: "User is exploring conflict avoidance.",
      });
      const result = formatExtractionForPersona(state, false);
      const missIdx = result.indexOf("Last two observations didn't land");
      const briefIdx = result.indexOf("What's underneath this conversation");
      expect(missIdx).toBeGreaterThanOrEqual(0);
      expect(briefIdx).toBeGreaterThan(missIdx);
    });
  });
});
