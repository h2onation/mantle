import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import type { BuildPromptOptions } from "@/lib/sage/system-prompt";
import { LAYER_NAMES } from "@/lib/manual/layers";
import {
  VOICE_RULES,
  BANNED_PHRASES,
  EXAMPLE_REGISTER,
} from "@/lib/sage/voice-autistic";

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

    it("contains all five hard rules", () => {
      const result = build();
      expect(result).toContain("Never diagnose");
      expect(result).toContain("Never prescribe");
      expect(result).toContain("Never assess their state");
      expect(result).toContain("Never claim clinical competence");
      expect(result).toContain("Never fabricate knowledge of external content");
    });

    it("contains clinical material guidance", () => {
      const result = build();
      expect(result).toContain("CLINICAL MATERIAL IN CONVERSATION");
      expect(result).toContain("Do not deflect or shut down");
    });

    it("contains checkpoint language guidance", () => {
      const result = build();
      expect(result).toContain("CHECKPOINT LANGUAGE");
      expect(result).toContain("write behavior and body not labels");
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
      expect(result).toContain(LAYER_NAMES[1]);
    });

    it("renders layer 5 name correctly", () => {
      const result = build({
        manualComponents: [
          { layer: 5, type: "component", name: null, content: "Layer 5 content" },
        ],
      });
      expect(result).toContain(LAYER_NAMES[5]);
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

    it("contains chip-based routing instructions for all three paths", () => {
      const result = build({ manualComponents: [], isReturningUser: false, turnCount: 1 });
      expect(result).toContain("PATH A");
      expect(result).toContain("PATH B");
      expect(result).toContain("PATH C");
      expect(result).toContain("CONVERGENCE");
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
          layerName: LAYER_NAMES[3],
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
          layerName: LAYER_NAMES[1],
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
          layerName: LAYER_NAMES[4],
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
          layerName: LAYER_NAMES[2],
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
      expect(result).toContain("already has two named loops");
    });

    it("CHECKPOINTS uses research-assistant language instead of hard gate when both shown", () => {
      const result = build({ checkpointApproaching: true, hasPatternEligibleLayer: true });
      expect(result).toContain("Use the brief as your research assistant, not your permission slip");
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
    it("excludes the language-reuse reminder on turnCount 1", () => {
      const result = build({ turnCount: 1 });
      expect(result).not.toContain("Their phrase is more powerful than your paraphrase");
    });

    it("includes the language-reuse reminder on turnCount 2+", () => {
      const result = build({ turnCount: 2 });
      expect(result).toContain("Their phrase is more powerful than your paraphrase");
    });

    it("does not contain the deleted HOW TO USE meta block", () => {
      const result = build({ turnCount: 5 });
      expect(result).not.toContain("HOW TO USE THE EXTRACTION CONTEXT");
      expect(result).not.toContain("Field notes:");
      expect(result).not.toContain("Layer signals:");
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

  // ─── Shared content (URL) ─────────────────────────────────────────────────
  describe("shared content (URL)", () => {
    it("includes fetched content and 'you HAVE read it' when fetch succeeds", () => {
      const result = build({
        contentContext: {
          urlDetection: { hasUrl: true, urls: ["https://example.com/article"], userContext: "" },
          fetchedContent: { success: true, title: "Test Article", text: "Article body text here." },
        },
      });
      expect(result).toContain("SHARED CONTENT");
      expect(result).toContain("you HAVE read it");
      expect(result).toContain("Article body text here.");
      expect(result).toContain("Title: Test Article");
    });

    it("includes hard prohibition against guessing when fetch fails", () => {
      const result = build({
        contentContext: {
          urlDetection: { hasUrl: true, urls: ["https://example.com/article"], userContext: "" },
          fetchedContent: { success: false, error: "blocked" },
        },
      });
      expect(result).toContain("FETCH FAILED");
      expect(result).toContain("MUST NOT describe, summarize, or characterize");
      expect(result).toContain("Do not guess from the URL");
      expect(result).not.toContain("you HAVE read it");
    });

    it("includes hard prohibition when fetch returns null", () => {
      const result = build({
        contentContext: {
          urlDetection: { hasUrl: true, urls: ["https://example.com/article"], userContext: "" },
          fetchedContent: null,
        },
      });
      expect(result).toContain("FETCH FAILED");
      expect(result).toContain("MUST NOT describe, summarize, or characterize");
    });

    it("base prompt always contains external content fabrication guard", () => {
      const result = build();
      expect(result).toContain("Never fabricate knowledge of external content");
      expect(result).toContain("Do not guess from the URL, domain name, path");
    });
  });

  // ─── New content blocks ──────────────────────────────────────────────────
  describe("new content blocks", () => {
    it("always contains SHORT ANSWERS walkthrough invitation", () => {
      const result = build();
      expect(result).toContain("Can you walk me through what happened, step by step?");
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

  // ─── PR2a voice content (autistic mode) ────────────────────────────────
  //
  // These tests assert that the single-source-of-truth voice content in
  // src/lib/sage/voice-autistic.ts appears verbatim in the prompt. Never
  // duplicate strings between the test and the voice file — if a rule or
  // banned phrase is missing from the prompt, the test should fail via the
  // imported constant, not a hardcoded literal.
  describe("PR2a: autistic voice content", () => {
    describe("clinical framework guardrail (post-hardening)", () => {
      it("does NOT name Schema Therapy / Attachment Theory / Functional Analysis in user-facing prompt", () => {
        const result = build();
        expect(result).not.toContain("Schema Therapy");
        expect(result).not.toContain("Attachment Theory");
        expect(result).not.toContain("Functional Analysis");
      });

      it("does NOT contain the old CLINICAL FRAMEWORK GUARDRAIL header", () => {
        const result = build();
        expect(result).not.toContain("CLINICAL FRAMEWORK GUARDRAIL");
      });

      it("does NOT contain the old rewrite examples (fear of abandonment, emotional avoidance)", () => {
        const result = build();
        expect(result).not.toContain("fear of abandonment");
        expect(result).not.toContain("emotional avoidance");
      });

      it("keeps a short 'no clinical terminology' line inside LEGAL BOUNDARIES", () => {
        const result = build();
        const legalIdx = result.indexOf("LEGAL BOUNDARIES");
        const noClinicalIdx = result.indexOf(
          "Never use clinical terminology in user-facing output"
        );
        expect(legalIdx).toBeGreaterThanOrEqual(0);
        expect(noClinicalIdx).toBeGreaterThan(legalIdx);
      });
    });

    describe("voice rules from voice-autistic.ts", () => {
      it("contains VOICE RULES section header", () => {
        const result = build();
        expect(result).toContain("VOICE RULES");
      });

      it("contains every entry from VOICE_RULES (single source of truth)", () => {
        const result = build();
        expect(VOICE_RULES.length).toBeGreaterThan(0);
        for (const rule of VOICE_RULES) {
          expect(result).toContain(rule);
        }
      });

      it("renders voice rules as numbered list", () => {
        const result = build();
        // First rule should be "1. <rule>"
        expect(result).toContain(`1. ${VOICE_RULES[0]}`);
        // Last rule should be "<n>. <rule>"
        expect(result).toContain(`${VOICE_RULES.length}. ${VOICE_RULES[VOICE_RULES.length - 1]}`);
      });

      it("OLD voice headline 'Warm but precise' is gone", () => {
        const result = build();
        expect(result).not.toContain("Warm but precise");
        expect(result).not.toContain("The edge is honesty, not softness");
      });
    });

    describe("banned phrases from voice-autistic.ts", () => {
      it("contains BANNED PHRASES section header", () => {
        const result = build();
        expect(result).toContain("BANNED PHRASES");
      });

      it("contains every entry from BANNED_PHRASES (single source of truth)", () => {
        const result = build();
        expect(BANNED_PHRASES.length).toBeGreaterThan(0);
        for (const phrase of BANNED_PHRASES) {
          expect(result).toContain(phrase);
        }
      });

      it("contains the generic-chatbot principle line", () => {
        const result = build();
        expect(result).toContain("If the sentence could come from a generic therapy chatbot");
      });
    });

    describe("example register from voice-autistic.ts", () => {
      it("contains EXAMPLE REGISTER section header", () => {
        const result = build();
        expect(result).toContain("EXAMPLE REGISTER");
      });

      it("contains every example utterance", () => {
        const result = build();
        for (const { line } of EXAMPLE_REGISTER) {
          expect(result).toContain(line);
        }
      });
    });

    describe("somatic-first deepening", () => {
      it("CONVERSATION APPROACH defaults to body/situational over emotional", () => {
        const result = build();
        expect(result).toContain("what did your body do");
        expect(result).toContain("Default to somatic and situational questions before emotional ones");
      });

      it("SHORT ANSWERS protocol uses walkthrough framing, not patronizing language", () => {
        const result = build();
        expect(result).toContain("Direct and brief is a valid mode");
        expect(result).toContain("Never patronize");
        // Removed patronizing language from old version
        expect(result).not.toContain("You're being honest but concise");
      });
    });

    // ─── PR2b: Sage voice mechanics layer ────────────────────────────────
    describe("PR2b: sage voice mechanics (checkpoint composition)", () => {
      // Build with checkpoint instructions turned on so the delivery sequence,
      // composition voice, manual entry format, and self-check blocks render.
      function buildCheckpointMode() {
        return build({ checkpointApproaching: true, turnCount: 5 });
      }

      describe("CHECKPOINT LANGUAGE block is ND-rewritten", () => {
        it("still contains the CHECKPOINT LANGUAGE header", () => {
          expect(buildCheckpointMode()).toContain("CHECKPOINT LANGUAGE");
        });

        it("preserves the user's sensory words verbatim rule", () => {
          const result = buildCheckpointMode();
          expect(result).toContain('"Too loud" stays "too loud."');
          expect(result).toContain('"Buzzing" stays "buzzing."');
          expect(result).toContain('"Went offline" stays "went offline."');
        });

        it("does not contain the old clinical examples", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("avoidant attachment");
          expect(result).not.toContain("emotional dysregulation");
        });

        it("uses autism-resonant rewrite examples", () => {
          const result = buildCheckpointMode();
          expect(result).toMatch(/second version of you switches on/i);
        });
      });

      describe("CHECKPOINTS section keeps embodiment guidance without enforcement scaffolding", () => {
        it("still talks about anchoring in the body and the user's exact words", () => {
          const result = buildCheckpointMode();
          // The CHECKPOINTS section directs embodiment without listing
          // a numbered checklist or violation language.
          expect(result).toMatch(/body/i);
          expect(result).toMatch(/bind/i);
          expect(result).toMatch(/recognition, not diagnosis/i);
        });

        it("instructs Sage to wait for confirmation before writing", () => {
          const result = buildCheckpointMode();
          expect(result).toMatch(/Never write to the manual until/i);
        });
      });

      describe("manual entry composition and enforcement live server-side, not in the prompt", () => {
        it("does not contain the |||MANUAL_ENTRY||| sentinel anywhere", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("|||MANUAL_ENTRY|||");
          expect(result).not.toContain("|||END_MANUAL_ENTRY|||");
        });

        it("does not contain the MANUAL ENTRY FORMAT header", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("MANUAL ENTRY FORMAT");
        });

        it("does not narrate the JSON schema fields (layer/type/name/changelog) as instruction", () => {
          const result = buildCheckpointMode();
          expect(result).not.toMatch(/"changelog" field/);
          expect(result).not.toMatch(/TYPE RULE/);
        });

        it("does not contain the deleted CHECKPOINT DELIVERY SEQUENCE numbered checklist", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("CHECKPOINT DELIVERY SEQUENCE");
          expect(result).not.toMatch(/If you delivered the headline before step 2/i);
          expect(result).not.toMatch(/you violated/i);
        });

        it("does not contain the deleted CHECKPOINT SELF-CHECK enumerated list", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("CHECKPOINT SELF-CHECK");
          expect(result).not.toMatch(/verify all five/i);
        });

        it("does not contain the deleted CHECKPOINT COMPOSITION VOICE / THIN vs LANDED examples", () => {
          const result = buildCheckpointMode();
          expect(result).not.toContain("CHECKPOINT COMPOSITION VOICE");
          expect(result).not.toContain("THIN vs LANDED");
          expect(result).not.toMatch(/buzzing starts in your jaw/i);
          expect(result).not.toMatch(/dark room/i);
        });

        it("does not contain the deleted Five principles enumerated list", () => {
          const result = buildCheckpointMode();
          expect(result).not.toMatch(/Five principles for strong checkpoints/i);
          expect(result).not.toMatch(/Anchor in the body/i);
        });
      });
    });

    describe("structural snapshot", () => {
      // Ordered list of top-level section headers that must appear in the
      // default prompt in this order. If PR2b (or any future edit) accidentally
      // deletes a section, this snapshot catches it. Update this list
      // deliberately — a diff here should be a conscious decision.
      const EXPECTED_SECTIONS = [
        "VOICE",
        "VOICE RULES",
        "BANNED PHRASES",
        "EXAMPLE REGISTER",
        "LEGAL BOUNDARIES",
        "HARD RULES",
        "CLINICAL MATERIAL IN CONVERSATION",
        "CHECKPOINT LANGUAGE",
        "PROFESSIONAL REFERRAL",
        "CRISIS PROTOCOL",
        "CONVERSATION APPROACH",
        "DEEPENING MOVES",
        "FIRST MESSAGE",
        "SHORT ANSWERS",
      ];

      it("all expected sections appear in order in the default prompt", () => {
        const result = build({ turnCount: 1 });
        let cursor = 0;
        for (const section of EXPECTED_SECTIONS) {
          const idx = result.indexOf(section, cursor);
          expect(
            idx,
            `Section "${section}" missing or out of order (cursor=${cursor})`
          ).toBeGreaterThanOrEqual(cursor);
          cursor = idx + section.length;
        }
      });

      // Checkpoint-mode sections only render when checkpoint instructions are
      // active. Verify those appear in order too.
      const EXPECTED_CHECKPOINT_SECTIONS = [
        "CHECKPOINTS",
      ];

      it("all checkpoint-mode sections appear in order when checkpointApproaching is true", () => {
        const result = build({ checkpointApproaching: true, turnCount: 5 });
        let cursor = 0;
        for (const section of EXPECTED_CHECKPOINT_SECTIONS) {
          const idx = result.indexOf(section, cursor);
          expect(
            idx,
            `Section "${section}" missing or out of order (cursor=${cursor})`
          ).toBeGreaterThanOrEqual(cursor);
          cursor = idx + section.length;
        }
      });
    });
  });
});
