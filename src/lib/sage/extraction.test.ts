import { describe, it, expect } from "vitest";
import { formatExtractionForSage, type ExtractionState } from "@/lib/sage/extraction";
import { LAYER_NAMES } from "@/lib/manual/layers";

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
          target_type: "pattern",
        },
        pattern_tracking: {
          active: true,
          layer: 1,
          label: "loop",
          chain_elements: [
            { element: "trigger", content: "x", source: "y" },
            { element: "internal_experience", content: "x", source: "y" },
            { element: "response", content: "x", source: "y" },
          ],
          recurrence_count: 2,
        },
      });
      const result = formatExtractionForSage(state, false);
      // Old structural names must not appear anywhere
      expect(result).not.toContain("FIELD NOTES");
      expect(result).not.toContain("LAYER SIGNALS");
      expect(result).not.toContain("EXTRACTION CONTEXT");
      expect(result).not.toContain("CHECKPOINT: READY");
      expect(result).not.toContain("CHECKPOINT: NOT READY");
      expect(result).not.toContain("PATTERN GATE");
      expect(result).not.toContain("PATTERN CHAIN");
      expect(result).not.toContain("CONFIRMED PATTERNS");
      expect(result).not.toContain("CROSS-LAYER CONNECTIONS");
      expect(result).not.toContain("EXISTING CONTENT ON TARGET LAYER");
      expect(result).not.toContain("DEPTH:");
      expect(result).not.toContain("MODE:");
      expect(result).not.toContain("THREAD:");
      expect(result).not.toContain("[pattern mode]");
      expect(result).not.toContain("SATURATED");
      expect(result).not.toContain("internal_experience");
      expect(result).not.toContain("recurrence_count");
      expect(result).not.toContain("⚠ CRISIS");
      expect(result).not.toContain("⚠ CLINICAL CAUTION");
    });
  });

  describe("brief paragraph", () => {
    it("includes the sage_brief paragraph when present", () => {
      const state = makeState({ sage_brief: "User is exploring conflict avoidance." });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("User is exploring conflict avoidance.");
      expect(result).toContain("What's underneath this conversation");
    });

    it("omits the brief paragraph when sage_brief is empty", () => {
      const state = makeState({ sage_brief: "" });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("What's underneath this conversation");
    });
  });

  describe("layer signals", () => {
    it("renders all 5 layers with their canonical names", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      for (let i = 1; i <= 5; i++) {
        expect(result).toContain(`- ${LAYER_NAMES[i]}: untouched`);
      }
    });

    it("uses natural-language signal labels", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "emerging", material: [], examples: [], dimensions: [], discovery_mode: "component" },
          2: { signal: "explored", material: [], examples: [], dimensions: [], discovery_mode: "component" },
          3: { signal: "checkpoint_ready", material: [], examples: [], dimensions: [], discovery_mode: "component" },
        },
      });
      const result = formatExtractionForSage(state, false);
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
            discovery_mode: "component",
          },
        },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, true);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, true);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, true);
      expect(result).toContain("Not enough yet");
    });

    it("includes the first-reflection wrapper note when ready and first checkpoint", () => {
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
      expect(result).toContain("very first reflection");
      expect(result).toContain("one-time wrapper");
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
          target_type: "component",
        },
      });
      const components = [
        { layer: 1, type: "component", name: "The Fixer", content: "You always step in..." },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).toContain("What's already in the manual");
      expect(result).toContain(LAYER_NAMES[1]);
      expect(result).toContain("Core piece");
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
          target_type: "component",
        },
      });
      const components = [
        { layer: 3, type: "component", name: null, content: "Different layer" },
      ];
      const result = formatExtractionForSage(state, false, components);
      expect(result).not.toContain("What's already in the manual");
    });
  });

  describe("depth, mode, thread", () => {
    it("describes depth and approach in natural language", () => {
      const state = makeState({ depth: "mechanism", mode: "direct_exploration" });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("How deep this conversation has gone: mechanism");
      expect(result).toContain("Current approach: direct_exploration");
    });

    it("includes the current thread when present", () => {
      const state = makeState({ current_thread: "conflict with partner" });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("What's actually being explored right now: conflict with partner");
    });

    it("omits the thread line when current_thread is empty", () => {
      const state = makeState({ current_thread: "" });
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("What's actually being explored");
    });
  });

  describe("clinical flag", () => {
    it("surfaces a safety note when crisis is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "User expressed suicidal ideation" },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("Safety note:");
      expect(result).toContain("User expressed suicidal ideation");
      expect(result).toContain("Stop building");
    });

    it("surfaces a care note when caution is active", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "caution", note: "User asked if they have ADHD" },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("Care note:");
      expect(result).toContain("User asked if they have ADHD");
      expect(result).toContain("Stay in behavioral description");
    });

    it("does NOT include any clinical note when level is none", () => {
      const state = makeState({
        clinical_flag: { active: false, level: "none", note: "" },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
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
          target_type: "component",
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain("enough material here to reflect a piece back");
    });

    it("safety note appears before the readiness sentence", () => {
      const state = makeState({
        clinical_flag: { active: true, level: "crisis", note: "Crisis detected" },
      });
      const result = formatExtractionForSage(state, false);
      const safetyIdx = result.indexOf("Safety note:");
      const readyIdx = result.indexOf("reflect a piece back");
      expect(safetyIdx).toBeGreaterThanOrEqual(0);
      expect(readyIdx).toBeGreaterThan(safetyIdx);
    });
  });

  // ─── Pattern system tests ──────────────────────────────────────────────────
  describe("discovery_mode rendering", () => {
    it("defaults to 'component' for all layers", () => {
      const state = makeState();
      for (let i = 1; i <= 5; i++) {
        expect(state.layers[i].discovery_mode).toBe("component");
      }
    });

    it("notes the layer is open to a recurring loop when in pattern mode", () => {
      const state = makeState({
        layers: {
          ...makeState().layers,
          1: { signal: "explored", material: [], examples: [], dimensions: [], discovery_mode: "pattern" },
        },
      });
      const result = formatExtractionForSage(state, false);
      expect(result).toContain(`- ${LAYER_NAMES[1]}: well explored`);
      expect(result).toContain("open to looking for a recurring loop");
    });

    it("does NOT mention recurring-loop openness when in component mode", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("recurring loop");
    });
  });

  describe("pattern_tracking rendering", () => {
    it("defaults to inactive with empty chain", () => {
      const state = makeState();
      expect(state.pattern_tracking.active).toBe(false);
      expect(state.pattern_tracking.chain_elements).toEqual([]);
      expect(state.pattern_tracking.recurrence_count).toBe(0);
    });

    it("renders the loop in plain prose when active with elements", () => {
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
      expect(result).toContain('tracking a recurring loop called "the shutdown loop"');
      expect(result).toContain(LAYER_NAMES[3]);
      expect(result).toContain("described it 2 times");
      expect(result).toContain("What sets it off: authority challenge");
      expect(result).toContain("What you do: freeze and withdraw");
      expect(result).toContain("What happens inside: not yet known");
      expect(result).toContain("What it gives you: not yet known");
      expect(result).toContain("What it costs: not yet known");
    });

    it("does NOT render the loop block when inactive", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("tracking a recurring loop");
    });
  });

  describe("pattern gate", () => {
    it("signals enough material to name a loop when target is pattern and criteria met", () => {
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
      expect(result).toContain("enough material here to name a recurring loop");
      expect(result).toContain('"the shutdown loop"');
      expect(result).toContain(LAYER_NAMES[3]);
    });

    it("signals not enough yet when recurrence < 2", () => {
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
      expect(result).toContain("Not enough yet to name a recurring loop");
      expect(result).toContain("at least one more situation");
    });

    it("signals not enough yet when chain has fewer than 3 parts", () => {
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
      expect(result).toContain("Not enough yet to name a recurring loop");
      expect(result).toContain("missing key parts");
      expect(result).toContain("2 of 3");
    });

    it("does NOT show pattern-loop signal for component target_type", () => {
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
      expect(result).toContain("enough material here to reflect a piece back");
      expect(result).not.toContain("recurring loop");
    });
  });

  describe("pattern saturation", () => {
    it("notes the layer already has two named loops when 2 patterns exist", () => {
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
      expect(result).toContain("already has two named loops");
      expect(result).toContain("don't propose a third");
    });

    it("does NOT mention saturation when layer has fewer than 2 patterns", () => {
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
      expect(result).not.toContain("already has two named loops");
      expect(result).toContain("open to looking for a recurring loop");
    });
  });

  describe("confirmed patterns", () => {
    it("renders confirmed loops in natural prose", () => {
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
      expect(result).toContain("Loops already confirmed in the manual");
      expect(result).toContain(`On ${LAYER_NAMES[3]}, "the shutdown loop"`);
      expect(result).toContain("What sets it off: authority challenge");
      expect(result).toContain("What you do: freeze");
      expect(result).toContain("What it costs: missed opportunities");
    });

    it("does NOT render the confirmed-loops block when array is empty", () => {
      const state = makeState();
      const result = formatExtractionForSage(state, false);
      expect(result).not.toContain("Loops already confirmed");
    });

    it("surfaces shared triggers across loops when 2+ confirmed patterns have triggers", () => {
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
      expect(result).toContain("loops may share something in common");
      expect(result).toContain('"the control reflex"');
      expect(result).toContain("loss of autonomy");
      expect(result).toContain('"the shutdown loop"');
      expect(result).toContain("authority challenge");
    });

    it("does NOT surface shared-trigger block with only 1 confirmed pattern", () => {
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
      expect(result).not.toContain("loops may share something in common");
    });
  });
});
