import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import type { ExplorationContext } from "@/lib/types";

describe("buildSystemPrompt", () => {
  // Helpers for default args
  const defaults = {
    manualComponents: [] as { layer: number; type: string; name: string | null; content: string }[],
    isReturningUser: false,
    sessionSummary: null as string | null,
    extractionContext: "",
    isFirstCheckpoint: false,
  };

  function build(overrides: Partial<{
    manualComponents: typeof defaults.manualComponents;
    isReturningUser: boolean;
    sessionSummary: string | null;
    extractionContext: string;
    isFirstCheckpoint: boolean;
    sessionCount: number;
    explorationContext: ExplorationContext;
  }> = {}) {
    const {
      manualComponents = defaults.manualComponents,
      isReturningUser = defaults.isReturningUser,
      sessionSummary = defaults.sessionSummary,
      extractionContext = defaults.extractionContext,
      isFirstCheckpoint = defaults.isFirstCheckpoint,
      sessionCount,
      explorationContext,
    } = overrides;
    return buildSystemPrompt(
      manualComponents,
      isReturningUser,
      sessionSummary,
      extractionContext,
      isFirstCheckpoint,
      sessionCount,
      explorationContext,
    );
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
      });
      expect(result).toContain("You are Sage");
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
    it("contains 'FIRST CHECKPOINT (one-time instruction)' when isFirstCheckpoint is true", () => {
      const result = build({ isFirstCheckpoint: true });
      expect(result).toContain("FIRST CHECKPOINT (one-time instruction)");
    });

    it("does NOT contain 'FIRST CHECKPOINT' when isFirstCheckpoint is false", () => {
      const result = build({ isFirstCheckpoint: false });
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
});
