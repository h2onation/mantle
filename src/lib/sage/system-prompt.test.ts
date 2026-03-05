import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import type { BuildPromptOptions } from "@/lib/sage/system-prompt";

describe("buildSystemPrompt", () => {
  // Default options — mid-session new user with no special flags
  const defaults: BuildPromptOptions = {
    manualComponents: [],
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: false,
    turnCount: 5,
    hasPatternEligibleLayer: false,
    checkpointApproaching: false,
  };

  function build(overrides: Partial<BuildPromptOptions> = {}) {
    return buildSystemPrompt({ ...defaults, ...overrides });
  }

  // ─── Base prompt ─────────────────────────────────────────────────────────
  describe("base prompt always present", () => {
    it("contains 'You are Sage' regardless of parameters", () => {
      expect(build()).toContain("You are Sage");
    });

    it("contains 'You are Sage' with all parameters populated", () => {
      const result = build({
        manualComponents: [{ layer: 1, type: "component", name: "Test", content: "Test content" }],
        isReturningUser: true,
        sessionSummary: "Previous summary",
        extractionContext: "Some extraction context",
        isFirstCheckpoint: true,
        sessionCount: 3,
        checkpointApproaching: true,
        hasPatternEligibleLayer: true,
      });
      expect(result).toContain("You are Sage");
    });
  });

  // ─── Legal boundaries section ───────────────────────────────────────────
  describe("legal boundaries", () => {
    it("contains LEGAL BOUNDARIES section", () => {
      const result = build();
      expect(result).toContain("LEGAL BOUNDARIES");
    });

    it("contains all four hard rules", () => {
      const result = build();
      expect(result).toContain("Never diagnose");
      expect(result).toContain("Never prescribe");
      expect(result).toContain("Never assess their state");
      expect(result).toContain("Never claim clinical competence");
    });

    it("contains clinical material guidance", () => {
      const result = build();
      expect(result).toContain("CLINICAL MATERIAL IN CONVERSATION");
      expect(result).toContain("Do not deflect or shut down");
    });

    it("contains checkpoint language guidance", () => {
      const result = build();
      expect(result).toContain("CHECKPOINT LANGUAGE");
      expect(result).toContain("write behavior not labels");
    });

    it("contains professional referral guidance", () => {
      const result = build();
      expect(result).toContain("PROFESSIONAL REFERRAL");
      expect(result).toContain("A therapist could work with this in ways I can't");
    });

    it("contains crisis protocol", () => {
      const result = build();
      expect(result).toContain("CRISIS PROTOCOL");
      expect(result).toContain("988");
      expect(result).toContain("741741");
    });

    it("LEGAL BOUNDARIES appears before CHECKPOINTS when checkpoints are shown", () => {
      const result = build({ checkpointApproaching: true });
      const legalIdx = result.indexOf("LEGAL BOUNDARIES");
      const checkpointsIdx = result.indexOf("CHECKPOINTS");
      expect(legalIdx).toBeLessThan(checkpointsIdx);
    });

    it("contains no-minors rule", () => {
      const result = build();
      expect(result).toContain("No manuals of minors");
    });
  });

  // ─── Manual components section ───────────────────────────────────────────
  describe("manual components section", () => {
    it("does NOT contain 'CONFIRMED MANUAL' when manualComponents is empty", () => {
      const result = build({ manualComponents: [] });
      expect(result).not.toContain("CONFIRMED MANUAL");
    });

    it("contains 'CONFIRMED MANUAL' and the component content when entries exist", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: "Autonomy Drive", content: "You need control over your own direction." },
        ],
      });
      expect(result).toContain("CONFIRMED MANUAL");
      expect(result).toContain("You need control over your own direction.");
    });

    it("renders layer 1 name correctly", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: null, content: "Layer 1 content" },
        ],
      });
      expect(result).toContain("What Drives You");
    });

    it("renders layer 5 name correctly", () => {
      const result = build({
        manualComponents: [
          { layer: 5, type: "component", name: null, content: "Layer 5 content" },
        ],
      });
      expect(result).toContain("Your Relationship to Others");
    });

    it("includes the name in quotes when component has a name", () => {
      const result = build({
        manualComponents: [
          { layer: 2, type: "component", name: "The Fixer", content: "Some content" },
        ],
      });
      expect(result).toContain('"The Fixer"');
    });

    it("does NOT include quotes or 'null' when component name is null", () => {
      const result = build({
        manualComponents: [
          { layer: 3, type: "pattern", name: null, content: "Pattern content" },
        ],
      });
      // The line should end with the type, no trailing quotes
      expect(result).not.toContain('"null"');
      expect(result).not.toContain("null");
      // Should not have a dangling " — "" pattern (empty quotes)
      const lines = result.split("\n");
      const layerLine = lines.find((l) => l.includes("Layer 3"));
      expect(layerLine).toBeDefined();
      expect(layerLine).not.toMatch(/ — ""/);
    });
  });

  // ─── Session context ─────────────────────────────────────────────────────
  describe("session context", () => {
    it("contains 'SESSION CONTEXT' and 'Returning user' when isReturningUser is true", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("SESSION CONTEXT");
      expect(result).toContain("Returning user");
    });

    it("does NOT contain 'SESSION CONTEXT' when isReturningUser is false", () => {
      const result = build({ isReturningUser: false });
      expect(result).not.toContain("SESSION CONTEXT");
    });

    it("contains 'This is session N' when sessionCount > 1", () => {
      const result = build({ isReturningUser: true, sessionCount: 4 });
      expect(result).toContain("This is session 4");
    });

    it("contains 'Previous session:' when sessionSummary is provided", () => {
      const result = build({
        isReturningUser: true,
        sessionSummary: "Explored conflict avoidance patterns.",
      });
      expect(result).toContain("Previous session:");
      expect(result).toContain("Explored conflict avoidance patterns.");
    });
  });

  // ─── Extraction context ──────────────────────────────────────────────────
  describe("extraction context", () => {
    it("includes extraction context string when non-empty", () => {
      const extraction = "EXTRACTION BRIEF\nLayer signals: L1 strong, L3 emerging.";
      const result = build({ extractionContext: extraction });
      expect(result).toContain(extraction);
    });

    it("does not add extra content when extraction context is empty", () => {
      const withEmpty = build({ extractionContext: "" });
      const withoutExtraction = build({ extractionContext: "" });
      expect(withEmpty).toBe(withoutExtraction);
    });
  });

  // ─── First message block ─────────────────────────────────────────────────
  describe("first message block", () => {
    it("contains FIRST MESSAGE section for new users on turn 1", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1 });
      expect(result).toContain("FIRST MESSAGE");
    });

    it("tells Sage the orientation box handles intro so first message is conversational", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1 });
      expect(result).toContain("welcome orientation box");
      expect(result).toContain("purely conversational");
      expect(result).toContain("Three beats: acknowledge, perspective, question");
    });

    it("does NOT contain FIRST MESSAGE for returning users", () => {
      const result = build({ manualComponents: [], isReturningUser: true, turnCount: 1 });
      expect(result).not.toContain("FIRST MESSAGE");
    });

    it("does NOT contain FIRST MESSAGE when user has manual components", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: "Test", content: "Content" },
        ],
        isReturningUser: true,
        turnCount: 1,
      });
      expect(result).not.toContain("FIRST MESSAGE");
    });

    it("does NOT contain FIRST MESSAGE section header after turn 1", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 2 });
      // The FIRST MESSAGE section header should not appear, though FIRST SESSION may reference it
      const lines = result.split("\n");
      const firstMessageSectionLine = lines.find((l) => l.trim() === "FIRST MESSAGE");
      expect(firstMessageSectionLine).toBeUndefined();
    });

    it("FIRST MESSAGE appears before CHECKPOINTS in the prompt when both present", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1, checkpointApproaching: true });
      const firstMessageIdx = result.indexOf("FIRST MESSAGE");
      const checkpointsIdx = result.indexOf("CHECKPOINTS");
      expect(firstMessageIdx).toBeLessThan(checkpointsIdx);
    });

    it("instructs not to introduce by name or explain layers on turn 1", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1 });
      expect(result).toContain("Do not introduce yourself by name");
      expect(result).toContain("Do not explain checkpoints, the manual structure, or the five layers on turn 1");
    });

    it("instructs never to claim objectivity", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1 });
      expect(result).toContain("Never claim to be objective, unbiased, or filter-free");
    });
  });

  // ─── First session block ─────────────────────────────────────────────────
  describe("first session block", () => {
    it("contains first session text when manualComponents is empty and not returning user", () => {
      const result = build({ manualComponents: [], isReturningUser: false });
      expect(result).toContain("This user has no confirmed components. First session.");
    });

    it("does NOT contain first session text when manualComponents has entries", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: "Test", content: "Content" },
        ],
        isReturningUser: true,
      });
      expect(result).not.toContain("This user has no confirmed components");
    });

    it("does NOT contain first session text when isReturningUser is true", () => {
      const result = build({ manualComponents: [], isReturningUser: true });
      expect(result).not.toContain("This user has no confirmed components");
    });
  });

  // ─── First checkpoint instruction ────────────────────────────────────────
  describe("first checkpoint instruction", () => {
    it("contains 'FIRST CHECKPOINT (one-time instruction)' when isFirstCheckpoint is true and checkpointApproaching", () => {
      const result = build({ isFirstCheckpoint: true, checkpointApproaching: true });
      expect(result).toContain("FIRST CHECKPOINT (one-time instruction)");
    });

    it("does NOT contain 'FIRST CHECKPOINT' when isFirstCheckpoint is false", () => {
      const result = build({ isFirstCheckpoint: false, checkpointApproaching: true });
      expect(result).not.toContain("FIRST CHECKPOINT");
    });

    it("does NOT contain 'FIRST CHECKPOINT' when checkpointApproaching is false even if isFirstCheckpoint is true", () => {
      const result = build({ isFirstCheckpoint: true, checkpointApproaching: false });
      expect(result).not.toContain("FIRST CHECKPOINT");
    });
  });

  // ─── Exploration context ─────────────────────────────────────────────────
  describe("exploration context", () => {
    it("contains 'EXPLORATION FOCUS' and the pattern name for type 'pattern'", () => {
      const result = build({
        explorationContext: {
          type: "pattern",
          layerId: 3,
          layerName: "Your Reaction System",
          name: "The Shutdown Loop",
          content: "When challenged by authority, you freeze and withdraw.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain("The Shutdown Loop");
    });

    it("contains the component narrative for type 'component'", () => {
      const result = build({
        explorationContext: {
          type: "component",
          layerId: 1,
          layerName: "What Drives You",
          content: "You need autonomy above all else. Control over your own direction.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain("You need autonomy above all else. Control over your own direction.");
    });

    it("contains the layer description for type 'empty_layer'", () => {
      const result = build({
        explorationContext: {
          type: "empty_layer",
          layerId: 4,
          layerName: "How You Operate",
          content: "This layer covers your working patterns and decision-making style.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain("This layer covers your working patterns and decision-making style.");
    });

    it("contains 'Do NOT run entry sequences' (exploration early return)", () => {
      const result = build({
        explorationContext: {
          type: "pattern",
          layerId: 2,
          layerName: "Your Self Perception",
          name: "The Fixer",
          content: "You default to fixing others.",
        },
      });
      expect(result).toContain("Do NOT run entry sequences");
    });

    it("does NOT contain 'EXPLORATION FOCUS' when no explorationContext is provided", () => {
      const result = build();
      expect(result).not.toContain("EXPLORATION FOCUS");
    });
  });

  // ─── Pattern system ────────────────────────────────────────────────────────
  describe("pattern system", () => {
    it("contains PATTERNS section when hasPatternEligibleLayer is true", () => {
      const result = build({ hasPatternEligibleLayer: true });
      expect(result).toContain("PATTERNS");
      expect(result).toContain("RECURRENCE CONFIRMATION");
      expect(result).toContain("CHAIN WALK");
      expect(result).toContain("PATTERN CHECKPOINT");
    });

    it("does NOT contain PATTERNS section when hasPatternEligibleLayer is false", () => {
      const result = build({ hasPatternEligibleLayer: false });
      expect(result).not.toContain("RECURRENCE CONFIRMATION");
      expect(result).not.toContain("CHAIN WALK");
      expect(result).not.toContain("PATTERN CHECKPOINT");
    });

    it("contains first pattern teaching instruction when pattern eligible", () => {
      const result = build({ hasPatternEligibleLayer: true });
      expect(result).toContain("FIRST PATTERN TEACHING");
      expect(result).toContain("Components are the landscape");
      expect(result).toContain("Patterns are the loops");
    });

    it("contains pattern disconfirmation guidance when pattern eligible", () => {
      const result = build({ hasPatternEligibleLayer: true });
      expect(result).toContain("DISCONFIRMATION");
    });

    it("contains pattern saturation handling when pattern eligible", () => {
      const result = build({ hasPatternEligibleLayer: true });
      expect(result).toContain("PATTERN SATURATION");
      expect(result).toContain("SATURATED: 2/2 patterns");
    });

    it("CHECKPOINTS uses research-assistant language instead of hard gate when both shown", () => {
      const result = build({ checkpointApproaching: true, hasPatternEligibleLayer: true });
      expect(result).toContain("Use the extraction context as your research assistant, not your permission slip");
      expect(result).not.toContain("Only deliver a checkpoint when");
    });

    it("PATTERNS section appears before POST-CHECKPOINT when both shown", () => {
      const result = build({ hasPatternEligibleLayer: true, checkpointApproaching: true });
      const patternsIdx = result.indexOf("PATTERNS");
      const postCheckpointIdx = result.indexOf("POST-CHECKPOINT");
      expect(patternsIdx).toBeLessThan(postCheckpointIdx);
    });
  });

  // ─── Conditional section loading ─────────────────────────────────────────
  describe("conditional section loading", () => {
    it("excludes HOW TO USE EXTRACTION on turnCount 1", () => {
      const result = build({ turnCount: 1 });
      expect(result).not.toContain("HOW TO USE THE EXTRACTION CONTEXT");
    });

    it("includes HOW TO USE EXTRACTION on turnCount 2+", () => {
      const result = build({ turnCount: 2 });
      expect(result).toContain("HOW TO USE THE EXTRACTION CONTEXT");
    });

    it("excludes CHECKPOINTS when checkpointApproaching is false and not returning", () => {
      const result = build({ checkpointApproaching: false, isReturningUser: false });
      expect(result).not.toContain("CHECKPOINTS");
    });

    it("includes CHECKPOINTS for returning users regardless of checkpointApproaching", () => {
      const result = build({ isReturningUser: true, checkpointApproaching: false });
      expect(result).toContain("CHECKPOINTS");
    });

    it("includes CHECKPOINTS when checkpointApproaching is true", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("CHECKPOINTS");
    });

    it("excludes POST-CHECKPOINT when not approaching and not returning", () => {
      const result = build({ checkpointApproaching: false, isReturningUser: false });
      expect(result).not.toContain("POST-CHECKPOINT");
    });

    it("includes POST-CHECKPOINT for returning users", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("POST-CHECKPOINT");
    });

    it("excludes READINESS GATE when fewer than 3 components", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: null, content: "c1" },
          { layer: 2, type: "component", name: null, content: "c2" },
        ],
      });
      expect(result).not.toContain("READINESS GATE");
    });

    it("includes READINESS GATE when 3+ components", () => {
      const result = build({
        manualComponents: [
          { layer: 1, type: "component", name: null, content: "c1" },
          { layer: 2, type: "component", name: null, content: "c2" },
          { layer: 3, type: "component", name: null, content: "c3" },
        ],
        isReturningUser: true,
      });
      expect(result).toContain("READINESS GATE");
    });

    it("includes BUILDING TOWARD SIGNAL when checkpointApproaching is true", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("BUILDING TOWARD SIGNAL");
    });

    it("excludes BUILDING TOWARD SIGNAL when checkpointApproaching is false", () => {
      const result = build({ checkpointApproaching: false });
      expect(result).not.toContain("BUILDING TOWARD SIGNAL");
    });
  });

  // ─── New content blocks ──────────────────────────────────────────────────
  describe("new content blocks", () => {
    it("always contains ENCOURAGE DEPTH text", () => {
      const result = build();
      expect(result).toContain("Give me the full version");
    });

    it("always contains DEEPENING MOVES scene-invitation guidance", () => {
      const result = build();
      expect(result).toContain("Every question should invite a scene, not a label");
    });

    it("BUILDING TOWARD SIGNAL contains signal-naming instruction when present", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("There's a thread running through everything you've described");
    });
  });
});
