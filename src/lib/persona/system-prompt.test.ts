import { describe, it, expect } from "vitest";
import { buildSystemPrompt, composeTier2 } from "@/lib/persona/system-prompt";
import type { BuildPromptOptions } from "@/lib/persona/system-prompt";
import { LAYER_NAMES } from "@/lib/manual/layers";
import {
  VOICE_RULES,
  EXAMPLE_REGISTER,
  LANDING_EXAMPLES,
} from "@/lib/persona/voice-autistic";
import {
  BANNED_PHRASES,
  BANNED_PATTERNS,
} from "@/lib/persona/voice-scaffold";
import {
  VOICE_RULES as GENERAL_VOICE_RULES,
  LANDING_EXAMPLES as GENERAL_LANDING_EXAMPLES,
} from "@/lib/persona/voice-general";
// Banned phrases are scaffold-level now; re-export under the old name
// to keep the "general mode shares the same banned phrases" test honest.
const GENERAL_BANNED_PHRASES = BANNED_PHRASES;
import {
  VOICE_RULES as AUDHD_VOICE_RULES,
  LANDING_EXAMPLES as AUDHD_LANDING_EXAMPLES,
} from "@/lib/persona/voice-audhd";
import {
  VOICE_RULES as DYSLEXIC_VOICE_RULES,
  LANDING_EXAMPLES as DYSLEXIC_LANDING_EXAMPLES,
} from "@/lib/persona/voice-dyslexic";

describe("buildSystemPrompt", () => {
  // Default options — mid-session new user with no special flags
  const defaults: BuildPromptOptions = {
    manualComponents: [],
    currentConversationId: "test-conversation-id",
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: false,
    turnCount: 5,
    checkpointApproaching: false,
  };

  function build(overrides: Partial<BuildPromptOptions> = {}) {
    return buildSystemPrompt({ ...defaults, ...overrides });
  }

  // ─── Base prompt ─────────────────────────────────────────────────────────
  describe("base prompt always present", () => {
    it("contains 'You are Jove' regardless of parameters", () => {
      expect(build()).toContain("You are Jove");
    });

    it("contains 'You are Jove' with all parameters populated", () => {
      const result = build({
        manualComponents: [{ layer: 1, name: "Test", content: "Test content" }],
        isReturningUser: true,
        sessionSummary: "Previous summary",
        extractionContext: "Some extraction context",
        isFirstCheckpoint: true,
        sessionCount: 3,
        checkpointApproaching: true,
      });
      expect(result).toContain("You are Jove");
    });
  });

  // ─── Tier 1 — Constitutional rules ───────────────────────────────────────
  describe("tier 1 constitutional rules", () => {
    it("contains TIER 1 header", () => {
      expect(build()).toContain("TIER 1: CONSTITUTIONAL RULES");
    });

    it("contains the seven constitutional rule headlines", () => {
      const result = build();
      expect(result).toContain("THE USER IS THE AUTHOR");
      expect(result).toContain("PRESERVE THE USER'S EXACT LANGUAGE");
      expect(result).toContain("NO CLINICAL LANGUAGE IN USER-FACING OUTPUT");
      expect(result).toContain("ONE QUESTION PER TURN");
      expect(result).toContain("JOVE ASKS. JOVE DOES NOT DECLARE");
      expect(result).toContain("CRISIS PROTOCOL");
      expect(result).toContain("JOVE IS NOT A THERAPIST");
    });

    it("contains the tier-override statement so lower tiers know Tier 1 wins", () => {
      const result = build();
      expect(result).toContain(
        "If any other instruction in this prompt conflicts with a Tier 1 rule, the Tier 1 rule wins"
      );
    });

    it("crisis rule contains 988", () => {
      const result = build();
      expect(result).toContain("988");
    });

    it("Tier 1 sits above Tier 2 and Tier 3", () => {
      const result = build();
      const t1 = result.indexOf("TIER 1");
      const t2 = result.indexOf("TIER 2");
      const t3 = result.indexOf("TIER 3");
      expect(t1).toBeGreaterThanOrEqual(0);
      expect(t2).toBeGreaterThan(t1);
      expect(t3).toBeGreaterThan(t2);
    });

    it("does NOT contain the old LEGAL BOUNDARIES / HARD RULES headers", () => {
      const result = build();
      expect(result).not.toContain("LEGAL BOUNDARIES");
      expect(result).not.toContain("\nHARD RULES\n");
    });

    it("still surfaces the clinical material block in Tier 3", () => {
      const result = build();
      expect(result).toContain("CLINICAL MATERIAL IN CONVERSATION");
      expect(result).toContain("Do not deflect or shut down");
    });

    it("still surfaces the professional referral block in Tier 3", () => {
      const result = build();
      expect(result).toContain("PROFESSIONAL REFERRAL");
      expect(result).toContain(
        "A therapist could work with this in ways I can't"
      );
    });

    it("still surfaces the checkpoint language block in Tier 3", () => {
      const result = build();
      expect(result).toContain("CHECKPOINT LANGUAGE");
      expect(result).toContain("Write behavior and body, not labels");
    });

    it("Tier 1 appears before CHECKPOINTS when checkpoints render", () => {
      const result = build({ checkpointApproaching: true });
      const tier1Idx = result.indexOf("TIER 1: CONSTITUTIONAL RULES");
      const checkpointsIdx = result.indexOf("CHECKPOINTS");
      expect(tier1Idx).toBeLessThan(checkpointsIdx);
    });
  });

  // ─── Manual entries section ──────────────────────────────────────────────
  describe("manual entries section", () => {
    it("does NOT contain 'CONFIRMED MANUAL' when manualComponents is empty", () => {
      const result = build({ manualComponents: [] });
      expect(result).not.toContain("CONFIRMED MANUAL");
    });

    it("contains 'CONFIRMED MANUAL' and the entry content when entries exist", () => {
      const result = build({
        manualComponents: [
          {
            layer: 1,
            name: "Autonomy Drive",
            content: "You need control over your own direction.",
          },
        ],
      });
      expect(result).toContain("CONFIRMED MANUAL");
      expect(result).toContain("You need control over your own direction.");
    });

    it("renders layer 1 name correctly", () => {
      const result = build({
        manualComponents: [{ layer: 1, name: null, content: "Layer 1 content" }],
      });
      expect(result).toContain(LAYER_NAMES[1]);
    });

    it("renders layer 5 name correctly", () => {
      const result = build({
        manualComponents: [{ layer: 5, name: null, content: "Layer 5 content" }],
      });
      expect(result).toContain(LAYER_NAMES[5]);
    });

    it("includes the name in quotes when entry has a name", () => {
      const result = build({
        manualComponents: [
          { layer: 2, name: "The Fixer", content: "Some content" },
        ],
      });
      expect(result).toContain('"The Fixer"');
    });

    it("does NOT include stray quotes or 'null' when entry name is null", () => {
      const result = build({
        manualComponents: [
          { layer: 3, name: null, content: "Pattern content" },
        ],
      });
      expect(result).not.toContain('"null"');
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
      const extraction =
        "EXTRACTION BRIEF\nLayer signals: L1 strong, L3 emerging.";
      const result = build({ extractionContext: extraction });
      expect(result).toContain(extraction);
    });

    it("does not add extra content when extraction context is empty", () => {
      const withEmpty = build({ extractionContext: "" });
      const withoutExtraction = build({ extractionContext: "" });
      expect(withEmpty).toBe(withoutExtraction);
    });
  });

  // ─── First message block (Tier 3 conditional) ────────────────────────────
  describe("first message block", () => {
    it("contains FIRST MESSAGE section for new users on turn 1", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain("FIRST MESSAGE");
    });

    it("does NOT contain legacy PATH A/B/C routing (dropped in PR3)", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).not.toContain("PATH A");
      expect(result).not.toContain("PATH B");
      expect(result).not.toContain("PATH C");
      expect(result).not.toContain("CONVERGENCE");
    });

    it("describes unified free-form first-message handling", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain("free-form");
      expect(result).toContain("progressive narrowing");
    });

    it("contains framework-question guidance without letting Jove name them back", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain(
        "published behavioral and psychological frameworks"
      );
      expect(result).toContain("I don't label them for you");
    });

    it("does NOT contain FIRST MESSAGE for returning users", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: true,
        turnCount: 1,
      });
      expect(result).not.toContain("FIRST MESSAGE");
    });

    it("does NOT contain FIRST MESSAGE when user has manual entries", () => {
      const result = build({
        manualComponents: [{ layer: 1, name: "Test", content: "Content" }],
        isReturningUser: true,
        turnCount: 1,
      });
      expect(result).not.toContain("FIRST MESSAGE");
    });

    it("does NOT contain FIRST MESSAGE section header after turn 1", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 2,
      });
      const lines = result.split("\n");
      const firstMessageSectionLine = lines.find(
        (l) => l.trim() === "FIRST MESSAGE (new user)"
      );
      expect(firstMessageSectionLine).toBeUndefined();
    });

    it("FIRST MESSAGE appears before CHECKPOINTS when both present", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
        checkpointApproaching: true,
      });
      const firstMessageIdx = result.indexOf("FIRST MESSAGE");
      const checkpointsIdx = result.indexOf("\nCHECKPOINTS\n");
      expect(firstMessageIdx).toBeLessThan(checkpointsIdx);
    });

    it("instructs to introduce by name on first message, not explain layers", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain("Introduce yourself by name on your very first message");
      expect(result).toContain(
        "Do not explain checkpoints, Manual structure, or the five layers on turn 1"
      );
    });

    it("instructs returning users not to introduce by name", () => {
      const result = build({
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
        isReturningUser: true,
        turnCount: 1,
      });
      expect(result).toContain("do not introduce yourself by name");
    });

    it("instructs never to claim objectivity", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain(
        "Never claim to be objective, unbiased, or filter-free"
      );
    });
  });

  // ─── First session block (Tier 3 always-on wrapper) ──────────────────────
  describe("first session block", () => {
    it("contains first-session text when manualComponents is empty and not returning user", () => {
      const result = build({ manualComponents: [], isReturningUser: false });
      expect(result).toContain(
        "This user has no confirmed entries. First session."
      );
    });

    it("does NOT contain first-session text when manualComponents has entries", () => {
      const result = build({
        manualComponents: [{ layer: 1, name: "Test", content: "Content" }],
        isReturningUser: true,
      });
      expect(result).not.toContain("This user has no confirmed entries");
    });

    it("does NOT contain first-session text when isReturningUser is true", () => {
      const result = build({ manualComponents: [], isReturningUser: true });
      expect(result).not.toContain("This user has no confirmed entries");
    });
  });

  // ─── First checkpoint (one-time) ─────────────────────────────────────────
  describe("first checkpoint instruction", () => {
    it("contains 'FIRST CHECKPOINT (one-time, exact order)' when isFirstCheckpoint and checkpointApproaching", () => {
      const result = build({
        isFirstCheckpoint: true,
        checkpointApproaching: true,
      });
      expect(result).toContain("FIRST CHECKPOINT (one-time, exact order)");
    });

    it("does NOT contain 'FIRST CHECKPOINT' when isFirstCheckpoint is false", () => {
      const result = build({
        isFirstCheckpoint: false,
        checkpointApproaching: true,
      });
      expect(result).not.toContain("FIRST CHECKPOINT");
    });

    it("does NOT contain 'FIRST CHECKPOINT' when checkpointApproaching is false", () => {
      const result = build({
        isFirstCheckpoint: true,
        checkpointApproaching: false,
      });
      expect(result).not.toContain("FIRST CHECKPOINT");
    });

    it("uses the new four-step sequence with the transition copy and no internal wrapper", () => {
      const result = build({
        isFirstCheckpoint: true,
        checkpointApproaching: true,
      });
      expect(result).toContain('"I want to put something in your Manual."');
      expect(result).toContain("No wrapper inside any checkpoint");
      // Old five-step wrapper copy is gone
      expect(result).not.toContain("This is what building your manual looks like");
    });

    it("does NOT use the old 'Something's taken shape' transition copy", () => {
      const result = build({
        isFirstCheckpoint: true,
        checkpointApproaching: true,
      });
      expect(result).not.toContain("Something's taken shape from what you've told me");
    });
  });

  // ─── Post-confirm mode-specific blocks (Track A Phase 7-High) ────────────
  // The previous POST-CHECKPOINT block (one-turn with three steps — confirm
  // structure / name open thread / plant return hook) has been deleted and
  // replaced by two mode-specific blocks: first-message-2 (Message 2 of the
  // two-message first-lifetime flow) and subsequent-single (the single
  // post-confirm message for any non-first-lifetime confirmation). Both
  // are loaded via the postConfirmMode option, which is only set on
  // post-confirm callPersona invocations.
  describe("post-confirm blocks — first-message-2", () => {
    const firstMessage2Context = {
      layerName: "Some of My Patterns",
      proposedHeadline: "Voice Goes When Pressure Lands",
      entriesSummary:
        "unused for first-message-2 but context is uniform for both modes",
    };

    it("loads the first-message-2 block only when postConfirmMode is 'first-message-2'", () => {
      const result = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: firstMessage2Context,
      });
      expect(result).toContain(
        "POST-CONFIRM — FIRST LIFETIME ENTRY (Message 2 only)"
      );
    });

    it("does NOT load first-message-2 block when postConfirmMode is null or subsequent-single", () => {
      const none = build();
      expect(none).not.toContain("POST-CONFIRM — FIRST LIFETIME ENTRY");
      const sub = build({
        postConfirmMode: "subsequent-single",
        postConfirmContext: firstMessage2Context,
      });
      expect(sub).not.toContain("POST-CONFIRM — FIRST LIFETIME ENTRY");
    });

    it("pre-substitutes the layer name into the opening sentence", () => {
      const result = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: firstMessage2Context,
      });
      expect(result).toContain(
        "That went into Some of My Patterns. Four other places still empty"
      );
    });

    it("pins the scaffolding paragraph verbatim (two-week commitment, no-rush framing)", () => {
      const result = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: firstMessage2Context,
      });
      expect(result).toContain(
        "A real Manual takes time. It is not a quiz."
      );
      expect(result).toContain(
        "Come back daily for the first two weeks"
      );
    });

    it("instructs the model to produce only the open-thread line and nothing else", () => {
      const result = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: firstMessage2Context,
      });
      expect(result).toContain("The open-thread line is the only creative piece");
      expect(result).toContain("Do not add a headline");
      expect(result).toContain("Do not re-stamp the entry");
    });

    it("tells the model Message 1 was already sent by the system", () => {
      const result = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: firstMessage2Context,
      });
      expect(result).toContain(
        'Message 1 ("In. A working name:'
      );
      expect(result).toContain("already sent by the system");
    });
  });

  describe("post-confirm blocks — subsequent-single", () => {
    const subsequentContext = {
      layerName: "How I Process Things",
      proposedHeadline: "The Room Goes Loud Before Words Do",
      entriesSummary:
        "3 entries. How I Process Things and Some of My Patterns have material. 3 still empty.",
    };

    it("loads the subsequent-single block only when postConfirmMode is 'subsequent-single'", () => {
      const result = build({
        postConfirmMode: "subsequent-single",
        postConfirmContext: subsequentContext,
      });
      expect(result).toContain(
        "POST-CONFIRM — SUBSEQUENT ENTRY (single message)"
      );
    });

    it("does NOT load subsequent-single block when postConfirmMode is null or first-message-2", () => {
      const none = build();
      expect(none).not.toContain("POST-CONFIRM — SUBSEQUENT ENTRY");
      const first = build({
        postConfirmMode: "first-message-2",
        postConfirmContext: subsequentContext,
      });
      expect(first).not.toContain("POST-CONFIRM — SUBSEQUENT ENTRY");
    });

    it("pre-substitutes the proposed headline into the stamp line", () => {
      const result = build({
        postConfirmMode: "subsequent-single",
        postConfirmContext: subsequentContext,
      });
      expect(result).toContain(
        'In. A working name: "The Room Goes Loud Before Words Do." Yours to change.'
      );
    });

    it("pre-substitutes the entries-summary line verbatim (server-built)", () => {
      const result = build({
        postConfirmMode: "subsequent-single",
        postConfirmContext: subsequentContext,
      });
      expect(result).toContain(
        "3 entries. How I Process Things and Some of My Patterns have material. 3 still empty."
      );
    });

    it("instructs the model to produce only the open-thread line", () => {
      const result = build({
        postConfirmMode: "subsequent-single",
        postConfirmContext: subsequentContext,
      });
      expect(result).toContain("The open-thread line is the only creative piece");
      expect(result).toContain("Do not restate the entry twice");
    });
  });

  describe("deleted POST-CHECKPOINT block (replaced by mode-specific blocks)", () => {
    // The old POST-CHECKPOINT block that did "confirm structure / name open
    // thread / plant return hook" in one LLM turn is gone. These negative
    // assertions guard against accidental reintroduction.
    it("does NOT contain the old POST-CHECKPOINT section label in any build", () => {
      expect(build()).not.toContain("POST-CHECKPOINT");
      expect(build({ checkpointApproaching: true })).not.toContain(
        "POST-CHECKPOINT"
      );
      expect(build({ isReturningUser: true })).not.toContain("POST-CHECKPOINT");
    });

    it("does NOT contain the old three-step structure labels", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("CONFIRM AND NAME THE STRUCTURE");
      expect(result).not.toContain("NAME AN OPEN THREAD");
      expect(result).not.toContain("PLANT A RETURN HOOK");
    });

    it("does NOT contain the old first/second/third-entry scripted copy", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain(
        "That's your first entry. Your Manual has five layers."
      );
      expect(result).not.toContain("Four layers still open");
      expect(result).not.toContain("Two entries now.");
    });
  });

  // ─── Post-rejection (Track A Phase 7-Low / 7b) ───────────────────────────
  describe("post-rejection fixed-line behavior", () => {
    it("renders the POST-REJECTION section when checkpoint instructions are loaded", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("POST-REJECTION");
    });

    it("pins the exact fixed-string response after rejection", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("That entry didn't land. Was it off, or just not ready?");
    });

    it("scopes the fixed line to the immediate post-rejection turn only", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("immediate post-rejection turn");
      expect(result).toContain("return to natural exploration");
    });

    it("preserves the existing 'do not re-propose the same pattern' rule", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("Do not re-propose the same pattern in this session");
    });

    it("appears for returning users even without checkpointApproaching", () => {
      const result = build({ isReturningUser: true, checkpointApproaching: false });
      expect(result).toContain("POST-REJECTION");
      expect(result).toContain("That entry didn't land. Was it off, or just not ready?");
    });
  });

  // ─── Returning-user message (Track A Phase 7-Low / 7d) ───────────────────
  describe("returning-user opening structure", () => {
    it("tells Jove to respond to what the user said instead of using a canned opener", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("Respond directly to what the user said");
      expect(result).not.toContain('The opener: "Welcome back."');
    });

    it("permits referencing either a recent entry OR an open thread", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("entry name OR an open thread");
    });

    it("does NOT contain the old closing-question variants", () => {
      const result = build({ isReturningUser: true });
      expect(result).not.toContain("What's bringing you in today?");
      expect(result).not.toContain('opens the door:');
      expect(result).not.toContain('The closing question, exactly');
    });

    it("preserves the activated-user carve-out", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("activated");
      expect(result).toContain("skip the Manual reference entirely");
    });

    it("preserves the no-session-recap rule", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("No session recap");
    });
  });

  // ─── Exploration context ─────────────────────────────────────────────────
  describe("exploration context", () => {
    it("contains 'EXPLORATION FOCUS' and the entry name for type 'entry'", () => {
      const result = build({
        explorationContext: {
          type: "entry",
          layerId: 3,
          layerName: LAYER_NAMES[3],
          name: "The Shutdown Loop",
          content:
            "When challenged by authority, you freeze and withdraw.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain("The Shutdown Loop");
    });

    it("contains the entry content for type 'entry'", () => {
      const result = build({
        explorationContext: {
          type: "entry",
          layerId: 1,
          layerName: LAYER_NAMES[1],
          name: "Autonomy Drive",
          content:
            "You need autonomy above all else. Control over your own direction.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain(
        "You need autonomy above all else. Control over your own direction."
      );
    });

    it("contains the layer description for type 'empty_layer'", () => {
      const result = build({
        explorationContext: {
          type: "empty_layer",
          layerId: 4,
          layerName: LAYER_NAMES[4],
          content:
            "This layer covers your working patterns and decision-making style.",
        },
      });
      expect(result).toContain("EXPLORATION FOCUS");
      expect(result).toContain(
        "This layer covers your working patterns and decision-making style."
      );
    });

    it("contains 'Do NOT run entry sequences' (exploration early return)", () => {
      const result = build({
        explorationContext: {
          type: "entry",
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

  // ─── Conditional section loading ─────────────────────────────────────────
  describe("conditional section loading", () => {
    it("does not contain the deleted HOW TO USE meta block", () => {
      const result = build({ turnCount: 5 });
      expect(result).not.toContain("HOW TO USE THE EXTRACTION CONTEXT");
      expect(result).not.toContain("Field notes:");
      expect(result).not.toContain("Layer signals:");
    });

    it("excludes CHECKPOINTS when checkpointApproaching is false and not returning", () => {
      const result = build({
        checkpointApproaching: false,
        isReturningUser: false,
      });
      expect(result).not.toContain("\nCHECKPOINTS\n");
    });

    it("includes CHECKPOINTS for returning users regardless of checkpointApproaching", () => {
      const result = build({
        isReturningUser: true,
        checkpointApproaching: false,
      });
      expect(result).toContain("\nCHECKPOINTS\n");
    });

    it("includes CHECKPOINTS when checkpointApproaching is true", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("\nCHECKPOINTS\n");
    });

    it("excludes POST-REJECTION when not approaching and not returning", () => {
      // POST-CHECKPOINT was deleted in Phase 7-High. POST-REJECTION is
      // the remaining checkpoint-instructions block that gates on
      // (checkpointApproaching || isReturningUser). Same gate, new
      // assertion target.
      const result = build({
        checkpointApproaching: false,
        isReturningUser: false,
      });
      expect(result).not.toContain("POST-REJECTION");
    });

    it("includes POST-REJECTION for returning users", () => {
      const result = build({ isReturningUser: true });
      expect(result).toContain("POST-REJECTION");
    });

    it("excludes READINESS GATE when fewer than 3 entries", () => {
      const result = build({
        manualComponents: [
          { layer: 1, name: null, content: "c1" },
          { layer: 2, name: null, content: "c2" },
        ],
      });
      expect(result).not.toContain("READINESS GATE");
    });

    it("includes READINESS GATE when 3+ entries", () => {
      const result = build({
        manualComponents: [
          { layer: 1, name: null, content: "c1" },
          { layer: 2, name: null, content: "c2" },
          { layer: 3, name: null, content: "c3" },
        ],
        isReturningUser: true,
      });
      expect(result).toContain("READINESS GATE");
    });

    // Gate 8: the PROGRESS SIGNALS block was deleted from Tier 3.
    // Those signals (EARLY FRAME, DEPTH BUILDING, CHECKPOINT
    // APPROACHING) are now delivered as modals. The negative
    // assertions below guard against reintroduction.
    it("does NOT render the deleted PROGRESS SIGNALS block", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("PROGRESS SIGNALS");
      expect(result).not.toContain("DEPTH BUILDING SIGNAL");
      expect(result).not.toContain("CHECKPOINT APPROACHING SIGNAL");
      expect(result).not.toContain("EARLY FRAME");
    });

    it("no longer contains the replaced BUILDING TOWARD SIGNAL header", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("BUILDING TOWARD SIGNAL");
    });
  });

  // ─── Upload mode ─────────────────────────────────────────────────────────
  describe("upload mode", () => {
    it("includes UPLOAD MODE block with opener when mode is upload", () => {
      const result = build({ mode: "upload" });
      expect(result).toContain("UPLOAD MODE");
      expect(result).toContain("chose \"Upload\"");
      expect(result).toContain("Paste something here");
    });

    it("includes analysis instructions for upload mode", () => {
      const result = build({ mode: "upload" });
      expect(result).toContain("Cross-reference against the user's confirmed Manual entries");
      expect(result).toContain("Focus on the USER's behavior");
    });

    it("includes format-specific guidance", () => {
      const result = build({ mode: "upload" });
      expect(result).toContain("Speaker-alternating");
      expect(result).toContain("Email thread");
      expect(result).toContain("Journal entry");
    });

    it("does not include UPLOAD MODE in situation mode", () => {
      const result = build({ mode: "situation" });
      expect(result).not.toContain("UPLOAD MODE");
    });

    it("does not include UPLOAD MODE in guided-intake mode", () => {
      const result = build({ mode: "guided-intake" });
      expect(result).not.toContain("UPLOAD MODE");
    });
  });

  // ─── Fabricated content guard ───────────────────────────────────────────
  describe("fabricated content guard", () => {
    it("base prompt always contains the fabricated-content guard in Tier 3", () => {
      const result = build();
      expect(result).toContain("FABRICATED CONTENT");
      expect(result).toContain(
        "Do not describe, summarize, or guess from the URL, domain name, path"
      );
    });

    it("no longer contains SHARED CONTENT blocks (URL path removed)", () => {
      const result = build();
      expect(result).not.toContain("SHARED CONTENT");
      expect(result).not.toContain("you HAVE read it");
      expect(result).not.toContain("FETCH FAILED");
    });
  });

  // ─── Always-on Tier 3 blocks ─────────────────────────────────────────────
  describe("always-on Tier 3 blocks", () => {
    it("SHORT ANSWERS walkthrough invitation is present", () => {
      const result = build();
      expect(result).toContain(
        "Can you walk me through what happened, step by step?"
      );
    });

    it("DEEPENING asks for scenes over labels", () => {
      const result = build();
      expect(result).toContain("Ask for scenes, not labels");
    });

    // Gate 8: the approaching-signal copy is gone. Modal 3 carries
    // the "A pattern is ready for your Manual" teaching now.
    it("does NOT contain the deleted approaching-signal copy", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("There's an entry taking shape");
    });

    it("ADAPTING block renders for guarded/abstract/skeptical user modes", () => {
      const result = build();
      expect(result).toContain("Guarded");
      expect(result).toContain("Abstract");
      expect(result).toContain("Skeptical");
    });

    it("WHEN JOVE IS WRONG sequence scales from first miss to full reset", () => {
      const result = build();
      expect(result).toContain("WHEN JOVE IS WRONG");
      expect(result).toContain("First miss");
      expect(result).toContain("Second miss");
      expect(result).toContain("Third miss");
    });

    it("WHEN THE USER ASKS \"WHAT SHOULD I DO\" advisory block is present", () => {
      const result = build();
      expect(result).toContain('WHEN THE USER ASKS "WHAT SHOULD I DO"');
    });
  });

  // ─── Voice content sourced from voice-autistic.ts ─────────────────────────
  describe("voice-autistic content", () => {
    describe("clinical framework posture", () => {
      it("does NOT contain the old CLINICAL FRAMEWORK GUARDRAIL header", () => {
        const result = build();
        expect(result).not.toContain("CLINICAL FRAMEWORK GUARDRAIL");
      });

      it("does NOT contain the old rewrite examples (fear of abandonment, emotional avoidance)", () => {
        const result = build();
        expect(result).not.toContain("fear of abandonment");
        expect(result).not.toContain("emotional avoidance");
      });

      it("Tier 1 rule 3 forbids clinical language in user-facing output", () => {
        const result = build();
        const tier1Idx = result.indexOf("TIER 1: CONSTITUTIONAL RULES");
        const tier2Idx = result.indexOf("TIER 2: VOICE AND BEHAVIOR");
        expect(tier1Idx).toBeGreaterThanOrEqual(0);
        expect(tier2Idx).toBeGreaterThan(tier1Idx);
        const tier1Slice = result.slice(tier1Idx, tier2Idx);
        expect(tier1Slice).toContain(
          "NO CLINICAL LANGUAGE IN USER-FACING OUTPUT"
        );
        expect(tier1Slice).toMatch(/no framework names/i);
      });

      it("the framework-question response still instructs Jove not to label them", () => {
        const result = build({
          manualComponents: [],
          isReturningUser: false,
          turnCount: 1,
        });
        expect(result).toContain("I don't label them for you");
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

      it("renders voice rules as a numbered list", () => {
        const result = build();
        expect(result).toContain(`1. ${VOICE_RULES[0]}`);
        expect(result).toContain(
          `${VOICE_RULES.length}. ${VOICE_RULES[VOICE_RULES.length - 1]}`
        );
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

      it("contains every BANNED_PATTERNS entry as an 'Also banned' addendum", () => {
        const result = build();
        expect(BANNED_PATTERNS.length).toBeGreaterThan(0);
        for (const pattern of BANNED_PATTERNS) {
          expect(result).toContain(pattern);
        }
        expect(result).toContain("Also banned:");
      });

      it("contains the generic-chatbot principle line", () => {
        const result = build();
        expect(result).toContain(
          "If the sentence could come from a generic therapy chatbot"
        );
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

    describe("landing examples from voice-autistic.ts", () => {
      it("contains LANDING section header", () => {
        const result = build();
        expect(result).toContain("LANDING");
      });

      it("contains every landing example line", () => {
        const result = build();
        expect(LANDING_EXAMPLES.length).toBeGreaterThan(0);
        for (const { line } of LANDING_EXAMPLES) {
          expect(result).toContain(line);
        }
      });

      it("describes the receive-land-ask rhythm", () => {
        const result = build();
        expect(result).toContain("receive, land, ask");
      });
    });

    describe("somatic-first and short-answer handling", () => {
      it("VOICE_RULES contains the body-first default phrasing", () => {
        const result = build();
        expect(result).toContain("what did your body do");
      });

      it("SHORT ANSWERS uses walkthrough framing, not patronizing language", () => {
        const result = build();
        expect(result).toContain("Direct and brief is a valid mode");
        expect(result).toContain("Never patronize");
        expect(result).not.toContain("You're being honest but concise");
      });
    });
  });

  // ─── Checkpoint mechanics sit in Tier 3, not in the voice ────────────────
  describe("checkpoint mechanics (Tier 3)", () => {
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
      it("still talks about anchoring in the body, the bind, and recognition", () => {
        const result = buildCheckpointMode();
        expect(result).toMatch(/body/i);
        expect(result).toMatch(/bind/i);
        expect(result).toMatch(/recognition, not diagnosis/i);
      });

      it("instructs Jove to wait for confirmation before writing", () => {
        const result = buildCheckpointMode();
        expect(result).toMatch(/Never write to the Manual until/i);
      });
    });

    describe("composition and enforcement live server-side, not in the prompt", () => {
      it("does not contain the |||MANUAL_ENTRY||| sentinel anywhere", () => {
        const result = buildCheckpointMode();
        expect(result).not.toContain("|||MANUAL_ENTRY|||");
        expect(result).not.toContain("|||END_MANUAL_ENTRY|||");
      });

      it("does not contain the MANUAL ENTRY FORMAT header", () => {
        const result = buildCheckpointMode();
        expect(result).not.toContain("MANUAL ENTRY FORMAT");
      });

      it("does not narrate the JSON schema fields as instruction", () => {
        const result = buildCheckpointMode();
        expect(result).not.toMatch(/"changelog" field/);
        expect(result).not.toMatch(/TYPE RULE/);
      });

      it("does not contain the deleted CHECKPOINT DELIVERY SEQUENCE checklist", () => {
        const result = buildCheckpointMode();
        expect(result).not.toContain("CHECKPOINT DELIVERY SEQUENCE");
        expect(result).not.toMatch(
          /If you delivered the headline before step 2/i
        );
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
      });
    });
  });

  // ─── Progress signals (Gate 8: entire block deleted) ─────────────────────
  // The EARLY FRAME / DEPTH BUILDING SIGNAL / CHECKPOINT APPROACHING
  // SIGNAL inline prompts have been removed. Those signals are now
  // delivered as modals (ChatWindowModal / PatternFormingModal /
  // FirstCheckpointModal). Negative-regression tests guard against
  // accidental reintroduction.
  describe("deleted progress-signals block (Gate 8)", () => {
    it("does NOT render the EARLY FRAME block in any state", () => {
      const newUser = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 3,
      });
      expect(newUser).not.toContain("EARLY FRAME");
      expect(newUser).not.toContain("I'm building a model of how you operate");
      expect(newUser).not.toContain("What you confirm becomes your Manual");

      const returning = build({
        isReturningUser: true,
        manualComponents: [{ layer: 1, name: "x", content: "y" }],
      });
      expect(returning).not.toContain("EARLY FRAME");
    });

    it("does NOT render the depth-building or approaching-signal sections", () => {
      const result = build({ checkpointApproaching: true, isReturningUser: true });
      expect(result).not.toContain("DEPTH BUILDING SIGNAL");
      expect(result).not.toContain("CHECKPOINT APPROACHING SIGNAL");
      expect(result).not.toContain("Something is forming in your model");
    });

    it("does NOT contain the FIRST-EVER approaching signal's teaching copy", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("FIRST-EVER approaching signal");
      expect(result).not.toContain("When I see enough material I'll reflect a pattern back to you");
      expect(result).not.toContain("Nothing sticks unless you say so");
    });
  });

  // ─── Transition copy (new) ───────────────────────────────────────────────
  describe("checkpoint transition copy", () => {
    it("uses 'I want to put something in your Manual.' as the transition line", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain('"I want to put something in your Manual."');
    });

    it("no longer contains the old 'Something\\'s taken shape' transition", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).not.toContain("Something's taken shape from what you've told me");
    });
  });

  // ─── Structural snapshot — the tier layout ───────────────────────────────
  describe("structural snapshot", () => {
    // Default prompt sections in the order they must appear. Update
    // deliberately — this guards against accidental deletions.
    const EXPECTED_DEFAULT_SECTIONS = [
      "TIER 1: CONSTITUTIONAL RULES",
      "CRISIS PROTOCOL",
      "TIER 2: VOICE AND BEHAVIOR",
      "VOICE RULES",
      "BANNED PHRASES",
      "EXAMPLE REGISTER",
      "LANDING",
      "DEEPENING",
      "PACING",
      "WHEN JOVE IS WRONG",
      'WHEN THE USER ASKS "WHAT SHOULD I DO"',
      "TIER 3: CONVERSATION MECHANICS",
      "FIRST MESSAGE",
      "ADAPTING",
      "SHORT ANSWERS",
      "CLINICAL MATERIAL IN CONVERSATION",
      "PROFESSIONAL REFERRAL",
      "FABRICATED CONTENT",
      "CHECKPOINT LANGUAGE",
      "FIRST SESSION",
    ];

    it("all expected sections appear in order in the default (turn 1, new user) prompt", () => {
      const result = build({ turnCount: 1 });
      let cursor = 0;
      for (const section of EXPECTED_DEFAULT_SECTIONS) {
        const idx = result.indexOf(section, cursor);
        expect(
          idx,
          `Section "${section}" missing or out of order (cursor=${cursor})`
        ).toBeGreaterThanOrEqual(cursor);
        cursor = idx + section.length;
      }
    });

    it("checkpoint-mode sections appear in the expected order", () => {
      const result = build({
        checkpointApproaching: true,
        turnCount: 5,
      });
      // Phase 7-High removed POST-CHECKPOINT (replaced by mode-specific
      // blocks loaded only on post-confirm calls); POST-REJECTION
      // (Phase 7-Low) sits in that slot under the same gate. Gate 8
      // removed PROGRESS SIGNALS entirely — those are modals now.
      const EXPECTED_CHECKPOINT_SECTIONS = [
        "TIER 3: CONVERSATION MECHANICS",
        "CHECKPOINTS",
        "POST-REJECTION",
        "ADAPTING",
      ];
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

  // ─── Guided intake mode ─────────────────────────────────────────────────
  describe("guided intake mode", () => {
    it("renders GUIDED INTAKE block when mode is 'guided-intake'", () => {
      const result = build({ mode: "guided-intake" });
      expect(result).toContain("GUIDED INTAKE");
      expect(result).toContain("The user opted into a more directed path");
    });

    it("does NOT render GUIDED INTAKE when mode is omitted, undefined, or 'situation'", () => {
      expect(build()).not.toContain("GUIDED INTAKE");
      expect(build({ mode: undefined })).not.toContain("GUIDED INTAKE");
      expect(build({ mode: "situation" })).not.toContain("GUIDED INTAKE");
    });

    it("TIER 1 content still renders alongside guided intake", () => {
      const result = build({ mode: "guided-intake" });
      expect(result).toContain("TIER 1: CONSTITUTIONAL RULES");
      expect(result).toContain("THE USER IS THE AUTHOR");
    });

    it("TIER 2 content still renders alongside guided intake (voice rules and banned phrases)", () => {
      const result = build({ mode: "guided-intake" });
      expect(result).toContain("VOICE RULES");
      expect(result).toContain("BANNED PHRASES");
      for (const rule of VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("FIRST MESSAGE block does NOT render alongside guided intake — mode block owns the opener", () => {
      const result = build({
        mode: "guided-intake",
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).not.toContain("FIRST MESSAGE");
      expect(result).toContain("GUIDED INTAKE");
    });

    it("none of the banned phrases from voice-autistic.ts appear inside the GUIDED INTAKE block", () => {
      const result = build({ mode: "guided-intake" });
      const start = result.indexOf("GUIDED INTAKE");
      const end = result.indexOf("\nADAPTING", start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const guidedBlock = result.slice(start, end);
      for (const phrase of BANNED_PHRASES) {
        expect(guidedBlock).not.toContain(phrase);
      }
    });

    it("guided-intake opener tells returning users not to introduce themselves", () => {
      const result = build({
        mode: "guided-intake",
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      expect(result).toContain("returning user");
      expect(result).toContain("without introducing yourself");
    });

    it("guided-intake opener tells new users they may introduce themselves", () => {
      const result = build({
        mode: "guided-intake",
        isReturningUser: false,
        manualComponents: [],
      });
      expect(result).toContain("briefly introduce yourself");
    });

    it("upload opener tells returning users not to introduce themselves", () => {
      const result = build({
        mode: "upload",
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      expect(result).toContain("returning user");
      expect(result).toContain("without introducing yourself");
    });

    it("returning-user situation-specific first-turn block only renders in situation mode", () => {
      const situation = build({
        mode: "situation",
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      const guided = build({
        mode: "guided-intake",
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      expect(situation).toContain("RETURNING USER — FIRST TURN");
      expect(guided).not.toContain("RETURNING USER — FIRST TURN");
    });
  });

  // ─── PersonaMode branching ──────────────────────────────────────────────
  describe("personaMode voice branching", () => {
    it("defaults to autistic mode when personaMode is omitted", () => {
      const result = build();
      expect(result).toContain("late-diagnosed autistic adults");
    });

    it("autistic mode renders autistic-specific Tier 2 content", () => {
      const result = build({ personaModes: ["autistic"] });
      expect(result).toContain("late-diagnosed autistic adults");
      expect(result).toContain("exhausted from translating themselves");
      for (const rule of VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("general mode renders general-specific Tier 2 content", () => {
      const result = build({ personaModes: ["general"] });
      expect(result).not.toContain("late-diagnosed autistic adults");
      expect(result).toContain("reflective, curious, and looking for language");
      for (const rule of GENERAL_VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("general mode has its own landing examples", () => {
      const result = build({ personaModes: ["general"] });
      for (const { line } of GENERAL_LANDING_EXAMPLES) {
        expect(result).toContain(line);
      }
    });

    it("general mode shares the same banned phrases", () => {
      const result = build({ personaModes: ["general"] });
      for (const phrase of GENERAL_BANNED_PHRASES) {
        expect(result).toContain(phrase);
      }
    });

    it("audhd mode renders audhd-specific Tier 2 content", () => {
      const result = build({ personaModes: ["audhd"] });
      expect(result).toContain("both autistic and ADHD");
      expect(result).toContain("two systems that pull in opposite directions");
      for (const rule of AUDHD_VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("audhd mode has its own landing examples", () => {
      const result = build({ personaModes: ["audhd"] });
      for (const { line } of AUDHD_LANDING_EXAMPLES) {
        expect(result).toContain(line);
      }
    });

    it("audhd mode deepening tracks both systems", () => {
      const result = build({ personaModes: ["audhd"] });
      expect(result).toContain("Track both systems");
      expect(result).toContain("Walk me through what was going on between knowing and doing");
    });

    it("dyslexic mode renders dyslexic-specific Tier 2 content", () => {
      const result = build({ personaModes: ["dyslexic"] });
      expect(result).toContain("think in pictures, patterns, and stories");
      expect(result).toContain("see the big picture fast");
      for (const rule of DYSLEXIC_VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("dyslexic mode has its own landing examples", () => {
      const result = build({ personaModes: ["dyslexic"] });
      for (const { line } of DYSLEXIC_LANDING_EXAMPLES) {
        expect(result).toContain(line);
      }
    });

    it("dyslexic mode bans journaling suggestions", () => {
      const result = build({ personaModes: ["dyslexic"] });
      expect(result).toContain("Never suggest journaling, writing things down, or reading as a tool");
    });

    it("dyslexic mode deepening uses story invitations", () => {
      const result = build({ personaModes: ["dyslexic"] });
      expect(result).toContain("Use story invitations");
      expect(result).toContain("Tell me the story of what happens right before it starts");
    });

    it("all modes share the same structural sections in order", () => {
      const sections = [
        "TIER 1: CONSTITUTIONAL RULES",
        "TIER 2: VOICE AND BEHAVIOR",
        "VOICE RULES",
        "BANNED PHRASES",
        "EXAMPLE REGISTER",
        "LANDING",
        "DEEPENING",
        "PACING",
        "WHEN JOVE IS WRONG",
        'WHEN THE USER ASKS "WHAT SHOULD I DO"',
        "TIER 3: CONVERSATION MECHANICS",
      ];
      for (const mode of ["autistic", "audhd", "dyslexic", "general"] as const) {
        const result = build({ personaModes: [mode], turnCount: 1 });
        let cursor = 0;
        for (const section of sections) {
          const idx = result.indexOf(section, cursor);
          expect(
            idx,
            `Section "${section}" missing or out of order in ${mode} mode`
          ).toBeGreaterThanOrEqual(cursor);
          cursor = idx + section.length;
        }
      }
    });

    it("Tier 1 and Tier 3 are identical across all modes", () => {
      const extractTier1 = (s: string) =>
        s.slice(s.indexOf("TIER 1:"), s.indexOf("TIER 2:"));
      const extractTier3 = (s: string) =>
        s.slice(s.indexOf("TIER 3:"));
      const autistic = build({ personaModes: ["autistic"] });
      for (const mode of ["audhd", "dyslexic", "general"] as const) {
        const result = build({ personaModes: [mode] });
        expect(extractTier1(result)).toBe(extractTier1(autistic));
        expect(extractTier3(result)).toBe(extractTier3(autistic));
      }
    });

    it("each mode produces a distinct Tier 2", () => {
      const extractTier2 = (s: string) =>
        s.slice(s.indexOf("TIER 2:"), s.indexOf("TIER 3:"));
      const modes = ["autistic", "audhd", "dyslexic", "general"] as const;
      const tier2s = modes.map((m) => extractTier2(build({ personaModes: [m] })));
      for (let i = 0; i < tier2s.length; i++) {
        for (let j = i + 1; j < tier2s.length; j++) {
          expect(
            tier2s[i],
            `${modes[i]} and ${modes[j]} Tier 2 should differ`
          ).not.toBe(tier2s[j]);
        }
      }
    });

    it("general mode deepening uses different examples than autistic mode", () => {
      const autistic = build({ personaModes: ["autistic"] });
      const general = build({ personaModes: ["general"] });
      expect(autistic).toContain("what your body was doing right then");
      expect(general).toContain("what was happening for you right then");
      expect(autistic).toContain("What happens when you realize you didn't know the code");
      expect(general).not.toContain("What happens when you realize you didn't know the code");
    });
  });

  // ─── Multi-select composition ────────────────────────────────────────────
  describe("composeTier2 equal-stacking", () => {
    it("single mode returns that mode's full Tier 2", () => {
      const single = composeTier2(["autistic"]);
      expect(single).toContain("late-diagnosed autistic adults");
    });

    it("empty array defaults to autistic", () => {
      const empty = composeTier2([]);
      expect(empty).toContain("late-diagnosed autistic adults");
    });

    it("autistic + dyslexic stacks both intros and both unique content", () => {
      const result = composeTier2(["autistic", "dyslexic"]);
      // Both VOICE intros appear
      expect(result).toContain("late-diagnosed autistic adults");
      expect(result).toContain("think in pictures, patterns, and stories");
      // Dyslexic-unique behavioral guidance comes through (in voice rules + deepening)
      expect(result).toContain("Never suggest journaling");
      expect(result).toContain("Use story invitations");
      // Autistic-unique behavioral guidance is preserved too
      expect(result).toContain("what did your body do");
      expect(result).toContain("Silence is processing");
    });

    it("autistic + audhd stacks both intros and audhd's deepening addition", () => {
      const result = composeTier2(["autistic", "audhd"]);
      expect(result).toContain("late-diagnosed autistic adults");
      expect(result).toContain("both autistic and ADHD");
      expect(result).toContain("Track both systems");
      // AuDHD-unique landing examples appear
      expect(result).toContain("Executive function collapse");
      expect(result).toContain("Burnout cycle");
    });

    it("audhd + dyslexic stacks both intros and both unique content", () => {
      const result = composeTier2(["audhd", "dyslexic"]);
      expect(result).toContain("both autistic and ADHD");
      expect(result).toContain("think in pictures, patterns, and stories");
      expect(result).toContain("Never suggest journaling");
      expect(result).toContain("Track both systems");
    });

    it("general is filtered out when combined with neurotype-specific modes", () => {
      const result = composeTier2(["autistic", "general"]);
      expect(result).toContain("late-diagnosed autistic adults");
      expect(result).not.toContain("reflective, curious");
    });

    it("general alone uses general voice", () => {
      const result = composeTier2(["general"]);
      expect(result).toContain("reflective, curious");
    });

    it("shared scaffold (BANNED PHRASES, repair, advisory) appears exactly once even in multi-mode", () => {
      const single = composeTier2(["autistic"]);
      const dual = composeTier2(["autistic", "dyslexic"]);
      const tripleHeader = "WHEN JOVE IS WRONG";
      const singleCount = (single.match(new RegExp(tripleHeader, "g")) || []).length;
      const dualCount = (dual.match(new RegExp(tripleHeader, "g")) || []).length;
      expect(singleCount).toBe(1);
      expect(dualCount).toBe(1);
    });

    it("multi-select prompt builds correctly end-to-end", () => {
      const result = build({ personaModes: ["autistic", "dyslexic"] });
      expect(result).toContain("TIER 1: CONSTITUTIONAL RULES");
      expect(result).toContain("late-diagnosed autistic adults");
      expect(result).toContain("think in pictures, patterns, and stories");
      expect(result).toContain("Never suggest journaling");
      expect(result).toContain("TIER 3: CONVERSATION MECHANICS");
    });
  });
});
