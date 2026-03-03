import { describe, it, expect } from "vitest";
import { formatExtractionForSage, type ExtractionState } from "@/lib/sage/extraction";

function makeState(overrides?: Partial<ExtractionState>): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      2: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      3: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      4: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      5: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
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
      target_type: "component",
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    pattern_tracking: {
      active: false,
      layer: null,
      label: "",
      chain_elements: [],
      recurrence_count: 0,
    },
    confirmed_patterns: [],
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
            discovery_mode: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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
          target_type: "component",
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

  describe("clinical flag", () => {
    it("includes crisis warning when clinical_flag is crisis", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "User expressed suicidal ideation" },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("⚠ CRISIS:");
      expect(result).toContain("User expressed suicidal ideation");
      expect(result).toContain("Stop building");
    });

    it("includes caution warning when clinical_flag is caution", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "caution", note: "User asked if they have ADHD" },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("⚠ CLINICAL CAUTION:");
      expect(result).toContain("User asked if they have ADHD");
      expect(result).toContain("Stay in behavioral description");
    });

    it("does NOT include clinical warning when level is none", () => {
      const state = makeState({
        clinical_flag: { active: false, level: "none", note: "" },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("⚠ CRISIS");
      expect(result).not.toContain("⚠ CLINICAL CAUTION");
    });

    it("blocks checkpoint gate when crisis is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "Self-harm intent" },
        checkpoint_gate: {
          concrete_examples: 3,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 1,
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CHECKPOINT: NOT READY");
    });

    it("does NOT block checkpoint gate when caution is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "caution", note: "Diagnostic question" },
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CHECKPOINT: READY");
    });

    it("crisis warning appears before CHECKPOINT line", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "Crisis detected" },
      });
      const result = formatExtractionForSage(state, false);
      const crisisIdx = result.indexOf("⚠ CRISIS:");
      const checkpointIdx = result.indexOf("CHECKPOINT:");
      expect(crisisIdx).toBeLessThan(checkpointIdx);
    });
  });

  // ─── Pattern system tests ──────────────────────────────────────────────────
  describe("discovery_mode", () => {
    it("defaults to 'component' for all layers", () => {
      const state = makeState();
      for (let i = 1; i <= 5; i++) {
        expect(state.layers[i].discovery_mode).toBe("component");
      }
    });

    it("shows [pattern mode] in layer signals when discovery_mode is 'pattern'", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "explored", material: [], examples: [], dimensions: [], discovery_mode: "pattern" },
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("L1 (What Drives You): explored [pattern mode]");
    });

    it("does NOT show [pattern mode] when discovery_mode is 'component'", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("[pattern mode]");
    });
  });

  describe("pattern_tracking", () => {
    it("defaults to inactive with empty chain", () => {
      const state = makeState();
      expect(state.pattern_tracking.active).toBe(false);
      expect(state.pattern_tracking.chain_elements).toEqual([]);
      expect(state.pattern_tracking.recurrence_count).toBe(0);
    });

    it("renders PATTERN CHAIN when active with elements", () => {
      const state = makeState({
        pattern_tracking: {
          active: true,
          layer: 3,
          label: "the shutdown loop",
          chain_elements: [
            { element: "trigger", content: "authority challenge", source: "my boss told me I was wrong" },
            { element: "response", content: "freeze and withdraw", source: "I just shut down" },
          ],
          recurrence_count: 2,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain('PATTERN CHAIN: "the shutdown loop"');
      expect(result).toContain("✓ trigger: authority challenge");
      expect(result).toContain("✓ response: freeze and withdraw");
      expect(result).toContain("○ internal_experience: not yet identified");
      expect(result).toContain("○ payoff: not yet identified");
      expect(result).toContain("○ cost: not yet identified");
    });

    it("does NOT render PATTERN CHAIN when inactive", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("PATTERN CHAIN");
    });
  });

  describe("pattern gate", () => {
    it("renders PATTERN GATE: MET when target_type is pattern and criteria met", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
          target_type: "pattern",
        },
        pattern_tracking: {
          active: true,
          layer: 3,
          label: "the shutdown loop",
          chain_elements: [
            { element: "trigger", content: "authority", source: "boss" },
            { element: "response", content: "freeze", source: "shut down" },
            { element: "cost", content: "missed opportunities", source: "I never speak up" },
          ],
          recurrence_count: 2,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("PATTERN GATE: MET");
      expect(result).toContain('pattern: "the shutdown loop"');
    });

    it("renders PATTERN GATE: NOT MET when recurrence < 2", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
          target_type: "pattern",
        },
        pattern_tracking: {
          active: true,
          layer: 3,
          label: "test pattern",
          chain_elements: [
            { element: "trigger", content: "x", source: "y" },
            { element: "response", content: "x", source: "y" },
            { element: "cost", content: "x", source: "y" },
          ],
          recurrence_count: 1,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("PATTERN GATE: NOT MET");
      expect(result).toContain("need more recurrence");
    });

    it("renders PATTERN GATE: NOT MET when chain < 3 elements", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
          target_type: "pattern",
        },
        pattern_tracking: {
          active: true,
          layer: 3,
          label: "test pattern",
          chain_elements: [
            { element: "trigger", content: "x", source: "y" },
            { element: "response", content: "x", source: "y" },
          ],
          recurrence_count: 3,
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("PATTERN GATE: NOT MET");
      expect(result).toContain("chain incomplete (2/3 minimum elements)");
    });

    it("does NOT render PATTERN GATE for component target_type", () => {
      const state = makeState({
        checkpoint_gate: {
          concrete_examples: 2,
          has_mechanism: true,
          has_charged_language: true,
          has_behavior_driver_link: true,
          strongest_layer: 3,
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CHECKPOINT: READY");
      expect(result).not.toContain("PATTERN GATE");
    });
  });

  describe("pattern saturation", () => {
    it("shows SATURATED when layer has 2 patterns in manual components", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "explored", material: [], examples: [], dimensions: [], discovery_mode: "pattern" },
        },
      });
      const components = [
        { layer: 1, type: "component", name: "Core Drive", content: "..." },
        { layer: 1, type: "pattern", name: "Pattern A", content: "..." },
        { layer: 1, type: "pattern", name: "Pattern B", content: "..." },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).toContain("SATURATED: 2/2 patterns");
    });

    it("does NOT show SATURATED when layer has < 2 patterns", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "explored", material: [], examples: [], dimensions: [], discovery_mode: "pattern" },
        },
      });
      const components = [
        { layer: 1, type: "component", name: "Core Drive", content: "..." },
        { layer: 1, type: "pattern", name: "Pattern A", content: "..." },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).not.toContain("SATURATED");
      expect(result).toContain("[pattern mode]");
    });
  });

  describe("confirmed patterns", () => {
    it("renders CONFIRMED PATTERNS with chain summary", () => {
      const state = makeState({
        confirmed_patterns: [
          {
            layer: 3,
            name: "the shutdown loop",
            chain_elements: [
              { element: "trigger", content: "authority challenge", source: "boss" },
              { element: "response", content: "freeze", source: "shut down" },
              { element: "cost", content: "missed opportunities", source: "never speak up" },
            ],
          },
        ],
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CONFIRMED PATTERNS");
      expect(result).toContain('L3 — "the shutdown loop"');
      expect(result).toContain("trigger: authority challenge");
      expect(result).toContain("response: freeze");
      expect(result).toContain("cost: missed opportunities");
    });

    it("does NOT render CONFIRMED PATTERNS when array is empty", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("CONFIRMED PATTERNS");
    });

    it("renders CROSS-LAYER CONNECTIONS when 2+ confirmed patterns have triggers", () => {
      const state = makeState({
        confirmed_patterns: [
          {
            layer: 1,
            name: "the control reflex",
            chain_elements: [
              { element: "trigger", content: "loss of autonomy", source: "someone decided for me" },
              { element: "response", content: "take over", source: "I just stepped in" },
            ],
          },
          {
            layer: 3,
            name: "the shutdown loop",
            chain_elements: [
              { element: "trigger", content: "authority challenge", source: "boss" },
              { element: "response", content: "freeze", source: "shut down" },
            ],
          },
        ],
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("CROSS-LAYER CONNECTIONS");
      expect(result).toContain('L1 "the control reflex" trigger: loss of autonomy');
      expect(result).toContain('L3 "the shutdown loop" trigger: authority challenge');
    });

    it("does NOT render CROSS-LAYER CONNECTIONS with only 1 confirmed pattern", () => {
      const state = makeState({
        confirmed_patterns: [
          {
            layer: 3,
            name: "the shutdown loop",
            chain_elements: [
              { element: "trigger", content: "authority", source: "boss" },
            ],
          },
        ],
      });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("CROSS-LAYER CONNECTIONS");
    });
  });
});
