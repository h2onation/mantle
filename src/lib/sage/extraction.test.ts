import { describe, it, expect } from "vitest";
import { formatExtractionForSage, type ExtractionState } from "@/lib/sage/extraction";

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
    next_prompt: "",
    sage_brief: "",
    ...overrides,
  };
}

describe("formatExtractionForSage", () => {
  describe("field notes", () => {
    it("includes FIELD NOTES when sage_brief present", () => {
      const state = makeState({ sage_brief: "User is exploring conflict avoidance." });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("FIELD NOTES");
      expect(result).toContain("User is exploring conflict avoidance.");
    });

    it("omits FIELD NOTES when sage_brief is empty", () => {
      const state = makeState({ sage_brief: "" });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("FIELD NOTES");
    });
  });

  describe("layer signals", () => {
    it("renders all 5 layers with correct names", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("L1 (What Drives You)");
      expect(result).toContain("L2 (Your Self Perception)");
      expect(result).toContain("L3 (Your Reaction System)");
      expect(result).toContain("L4 (How You Operate)");
      expect(result).toContain("L5 (Your Relationship to Others)");
    });

    it("includes material snippets (last 3) for layers with material", () => {
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
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("second; third; fourth");
      expect(result).not.toContain("first");
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
      const result = formatExtractionForSage(state, false);
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
      const result = formatExtractionForSage(state, false);
      // Should contain entries 5-19 (last 15), not 0-4
      expect(result).toContain("phrase-5");
      expect(result).toContain("phrase-19");
      expect(result).not.toContain("phrase-4");
    });
  });

  describe("checkpoint gate — standard", () => {
    it("renders READY when all standard criteria met", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CHECKPOINT: READY");
      expect(result).toContain("strongest layer: L3");
    });

    it("renders NOT READY with missing reasons", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: false,
          has_charged_language: false,
          has_behavior_driver_link: false,
          strongest_layer: null,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CHECKPOINT: NOT READY");
      expect(result).toContain("need 1 more concrete example(s)");
      expect(result).toContain("haven't reached mechanism yet");
      expect(result).toContain("no charged user language captured");
    });

    it("does not show mechanism missing if has_mechanism is true", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 0,
          has_mechanism: true,
          has_charged_language: false,
          has_behavior_driver_link: false,
          strongest_layer: null,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("haven't reached mechanism yet");
    });
  });

  describe("checkpoint gate — first checkpoint (lighter)", () => {
    it("READY with lighter criteria: 1 example + charged language + mechanism", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: false,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForSage(state, true);
      expect(result).toContain("CHECKPOINT: READY");
    });

    it("READY with lighter criteria: 1 example + charged language + behavior_driver_link", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: false,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 2,
        },
      });
      const result = formatExtractionForSage(state, true);
      expect(result).toContain("CHECKPOINT: READY");
    });

    it("NOT READY when first checkpoint and no charged language", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: false,
          has_behavior_driver_link: true,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForSage(state, true);
      expect(result).toContain("CHECKPOINT: NOT READY");
    });

    it("includes FIRST CHECKPOINT instruction when first checkpoint and gate ready", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 1,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: false,
          strongest_layer: 1,
        },
      });
      const result = formatExtractionForSage(state, true);
      expect(result).toContain("FIRST CHECKPOINT");
      expect(result).toContain("instructional wrapper");
    });
  });

  describe("existing content on target layer", () => {
    it("includes existing content when gate ready and matching components exist", () => {
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
        { layer: 1, type: "component", name: "The Fixer", content: "You always step in..." },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).toContain("EXISTING CONTENT ON TARGET LAYER");
      expect(result).toContain("You always step in...");
    });

    it("omits existing content when no matching components", () => {
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
        { layer: 3, type: "component", name: null, content: "Different layer" },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).not.toContain("EXISTING CONTENT ON TARGET LAYER");
    });
  });

  describe("depth, mode, thread", () => {
    it("includes DEPTH and MODE line", () => {
      const state = makeState({ depth: "mechanism", mode: "direct_exploration" });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("DEPTH: mechanism | MODE: direct_exploration");
    });

    it("includes THREAD when current_thread is present", () => {
      const state = makeState({ current_thread: "conflict with partner" });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("THREAD: conflict with partner");
    });

    it("omits THREAD when current_thread is empty", () => {
      const state = makeState({ current_thread: "" });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("THREAD:");
    });
  });
});
