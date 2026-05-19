import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildSystemPromptBlocks,
  composeTier2,
} from "@/lib/persona/system-prompt";
import type { OneOnOnePromptOptions } from "@/lib/persona/system-prompt";
import { LAYER_NAMES } from "@/lib/manual/layers";
import {
  VOICE_RULES,
  EXAMPLE_REGISTER,
  LANDING_EXAMPLES,
} from "@/lib/persona/voice-autistic";
import {
  BANNED_PHRASES,
  BANNED_PATTERNS,
  VOICE_RULES_BASE,
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
  // Default options — mid-session new user with no special flags.
  // personaModes pinned to ["autistic"] in test defaults because the
  // majority of voice-content assertions in this file exercise the
  // autistic persona (most-built voice surface, primary beta cohort).
  // The PROD default flipped from ["autistic"] to ["general"] in
  // migration 20260519100000 — see the dedicated "default persona
  // mode" describe block below for tests that pin the new prod default
  // behavior explicitly.
  const defaults: OneOnOnePromptOptions = {
    kind: "oneOnOne",
    manualComponents: [],
    currentConversationId: "test-conversation-id",
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: false,
    turnCount: 5,
    checkpointApproaching: false,
    personaModes: ["autistic"],
  };

  function build(overrides: Partial<OneOnOnePromptOptions> = {}) {
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

    it("describes the bootstrap OPENER and two-posture structure", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain("OPENER");
      // Two postures replace the five-branch ladder.
      expect(result).toContain("Concrete");
      expect(result).toContain("Abstract");
      // Old branch language must be gone.
      expect(result).not.toContain("progressive narrowing");
    });

    it("the OPENER section quotes SITUATION_OPENER for verbatim delivery", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      // The block instructs the model to deliver the opener verbatim — a
      // distinctive substring of SITUATION_OPENER must be in the prompt.
      expect(result).toContain("aren't always obvious");
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

    it("does NOT contain FIRST MESSAGE section header after the entry phase", () => {
      // Gate is turnCount <= 3 to cover opener (1) + first user message
      // + Jove's first reply (3). Turn 4 onward the block exhausts.
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 4,
      });
      const lines = result.split("\n");
      const firstMessageSectionLine = lines.find(
        (l) => l.trim() === "FIRST MESSAGE (new user, situation mode)"
      );
      expect(firstMessageSectionLine).toBeUndefined();
    });

    it("FIRST MESSAGE still fires at turn 3 (first reply to user message)", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 3,
      });
      expect(result).toContain("FIRST MESSAGE (new user, situation mode)");
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

    it("delivers the SITUATION_OPENER verbatim and does not explain Manual structure", () => {
      // Bootstrap pattern: Jove no longer introduces itself separately; the
      // opener IS the introduction. The block tells the model to deliver
      // SITUATION_OPENER verbatim on turn 1 and to skip explanation of the
      // checkpoint/Manual machinery.
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      expect(result).toContain("Deliver the opener below verbatim");
      expect(result).toContain(
        "Don't explain checkpoints, the Manual, or the five layers"
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
      // Wording lives in VOICE_INTRO_PARAGRAPHS_BASE (scaffold) now,
      // framed second-person to match the rest of the intro paragraph.
      expect(result).toContain(
        "claim to be objective, unbiased, or filter-free"
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
  // 2026-05-14 round 3: post-confirm blocks rewritten to drop the
  // "A working name:" stamp line, drop the entries-summary line, and
  // open with a pinned "Saved." instead. The creative piece is now a
  // continue-or-pivot offer (not a forward-only question), giving the
  // user agency to pause after a heavy save.
  describe("post-confirm blocks — first-message-2", () => {
    it("loads the first-message-2 block only when postConfirmMode is 'first-message-2'", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      expect(result).toContain("POST-CONFIRM — FIRST LIFETIME ENTRY");
    });

    it("does NOT load first-message-2 block when postConfirmMode is null or subsequent-single", () => {
      const none = build();
      expect(none).not.toContain("POST-CONFIRM — FIRST LIFETIME ENTRY");
      const sub = build({ postConfirmMode: "subsequent-single" });
      expect(sub).not.toContain("POST-CONFIRM — FIRST LIFETIME ENTRY");
    });

    it("pins 'Saved.' as the opening line", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      expect(result).toContain("Saved.");
      expect(result).toContain('Open directly with "Saved.".');
    });

    it("pins the first-time scaffolding paragraph", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      expect(result).toContain("A Manual takes time to build");
      expect(result).toContain("showing up daily over the next two weeks");
      expect(result).toContain(
        "You can change the name or sharpen the entry anytime"
      );
    });

    it("requires a continue-or-pivot offer with a specific thread", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      // The creative piece must name a specific thread AND offer both
      // continue + pivot paths. Not a forward-only question — the user
      // should have agency to pause after a heavy save.
      expect(result).toContain("Names a SPECIFIC thread");
      expect(result).toContain(
        "Offers BOTH paths: continue with that thread OR pivot"
      );
    });

    it("forbids the old 'A working name' / 'Yours to change' vocabulary", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      expect(result).toContain('Do not say "A working name"');
      expect(result).toContain('"Yours to change"');
      // Negative regression: the prompt itself must not embed the old
      // stamp wording as an example or scaffold.
      expect(result).not.toContain('"In. A working name:');
    });

    it("forbids form-language and vague catch-all questions", () => {
      const result = build({ postConfirmMode: "first-message-2" });
      expect(result).toContain("Would you like to");
      expect(result).toContain("Shall we");
      expect(result).toContain("What's next for you?");
    });
  });

  describe("post-confirm blocks — subsequent-single", () => {
    it("loads the subsequent-single block only when postConfirmMode is 'subsequent-single'", () => {
      const result = build({ postConfirmMode: "subsequent-single" });
      expect(result).toContain("POST-CONFIRM — SUBSEQUENT ENTRY");
    });

    it("does NOT load subsequent-single block when postConfirmMode is null or first-message-2", () => {
      const none = build();
      expect(none).not.toContain("POST-CONFIRM — SUBSEQUENT ENTRY");
      const first = build({ postConfirmMode: "first-message-2" });
      expect(first).not.toContain("POST-CONFIRM — SUBSEQUENT ENTRY");
    });

    it("pins 'Saved.' as the opening line", () => {
      const result = build({ postConfirmMode: "subsequent-single" });
      expect(result).toContain("Saved.");
      expect(result).toContain('Open directly with "Saved.".');
    });

    it("does NOT include the first-time scaffolding paragraph", () => {
      const result = build({ postConfirmMode: "subsequent-single" });
      // Subsequent users already know how the Manual builds; the
      // two-week commitment line is first-confirm only.
      expect(result).not.toContain("A Manual takes time to build");
      expect(result).not.toContain("showing up daily over the next two weeks");
    });

    it("requires a continue-or-pivot offer with a specific thread", () => {
      const result = build({ postConfirmMode: "subsequent-single" });
      expect(result).toContain("Names a SPECIFIC thread");
      expect(result).toContain(
        "Offers BOTH paths: continue with that thread OR pivot"
      );
    });

    it("forbids the old 'A working name' / entries-summary / 'Yours to change' vocabulary", () => {
      const result = build({ postConfirmMode: "subsequent-single" });
      expect(result).toContain('Do not say "A working name"');
      expect(result).toContain('"Yours to change"');
      expect(result).toContain("Do not reproduce an entries-count summary");
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

    it("does NOT auto-load for returning users without checkpointApproaching", () => {
      // showCheckpointInstructions no longer derives from isReturningUser.
      // Previously this auto-loaded the POST-REJECTION block on turn 1
      // of every returning-user session, which primed Jove to write the
      // transition line before any material had surfaced.
      const result = build({ isReturningUser: true, checkpointApproaching: false });
      expect(result).not.toContain("POST-REJECTION");
      expect(result).not.toContain("That entry didn't land. Was it off, or just not ready?");
    });

    it("appears for returning users once checkpointApproaching is true", () => {
      const result = build({ isReturningUser: true, checkpointApproaching: true });
      expect(result).toContain("POST-REJECTION");
      expect(result).toContain("That entry didn't land. Was it off, or just not ready?");
    });
  });

  // ─── Returning-user message (Track A Phase 7-Low / 7d) ───────────────────
  describe("returning-user opening structure", () => {
    // The returning-user-first-turn-situation block fires for entry-phase
    // turns only (turnCount <= 3 — opener + first user message + Jove's
    // reply). Tests pass turnCount: 1 to land inside that window.
    const earlyTurnReturning: Partial<OneOnOnePromptOptions> = {
      isReturningUser: true,
      turnCount: 1,
    };

    it("tells Jove to respond to what the user said instead of using a canned opener", () => {
      const result = build(earlyTurnReturning);
      expect(result).toContain("Respond directly to what the user said");
      expect(result).not.toContain('The opener: "Welcome back."');
    });

    it("permits referencing either a recent entry OR an open thread", () => {
      const result = build(earlyTurnReturning);
      expect(result).toContain("entry name OR an open thread");
    });

    it("does NOT contain the old closing-question variants", () => {
      const result = build(earlyTurnReturning);
      expect(result).not.toContain("What's bringing you in today?");
      expect(result).not.toContain('opens the door:');
      expect(result).not.toContain('The closing question, exactly');
    });

    it("preserves the activated-user carve-out", () => {
      const result = build(earlyTurnReturning);
      expect(result).toContain("activated");
      expect(result).toContain("skip the Manual reference entirely");
    });

    it("preserves the no-session-recap rule", () => {
      // 'No session recap' lives in the general RETURNING USER block,
      // which fires for any returning user regardless of turnCount/mode.
      const result = build({ isReturningUser: true });
      expect(result).toContain("No session recap");
    });

    it("does NOT fire after the entry phase exhausts (turnCount > 3)", () => {
      // Block is bootstrap-aware: opener + early reply only. From turn 4
      // onward the general RETURNING USER block carries.
      const result = build({ isReturningUser: true, turnCount: 4 });
      expect(result).not.toContain("RETURNING USER — SITUATION OPENER");
      expect(result).not.toContain("entry name OR an open thread");
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

    it("excludes CHECKPOINTS for returning users when checkpointApproaching is false", () => {
      // Gate flipped from (checkpointApproaching || isReturningUser) to
      // (checkpointApproaching) alone. Returning-user status flows
      // through the RETURNING USER block; the CHECKPOINTS block should
      // not auto-load on turn 1 of a fresh session.
      const result = build({
        isReturningUser: true,
        checkpointApproaching: false,
      });
      expect(result).not.toContain("\nCHECKPOINTS\n");
    });

    it("includes CHECKPOINTS when checkpointApproaching is true", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("\nCHECKPOINTS\n");
    });

    // Regression pin (2026-05-19 audit). Dyslexic-mode run drifted onto
    // verb variants ("Let me write this up for your Manual") and drafted
    // Manual-entry-shaped prose inline without ever firing the canonical
    // checkpoint trigger. CHECKPOINTS block strengthened with explicit
    // failure-mode warning on the transition phrase + a "never draft
    // Manual-entry prose in regular chat" rule. These assertions pin both.
    it("CHECKPOINTS block forbids drafting Manual entries in regular chat turns", () => {
      const result = build({ checkpointApproaching: true });
      expect(result).toContain("NEVER DRAFT MANUAL-ENTRY-SHAPED PROSE IN REGULAR CHAT TURNS");
      expect(result).toContain("are NOT recognized as checkpoint proposals");
      expect(result).toContain("Tier 1 Rule 1 violation");
    });

    it("CHECKPOINTS block warns about canonical-phrase contract with the system", () => {
      const result = build({ checkpointApproaching: true });
      // The "EXACT phrase" warning explains WHY the phrase matters — without
      // this framing, the model treated it as stylistic and drifted.
      expect(result).toContain("This EXACT phrase");
      expect(result).toContain("contract with the system");
      // The audit-observed drift phrasings are listed as explicit non-matches.
      expect(result).toContain("Let me write this up for your Manual");
    });

    it("includes CHECKPOINTS for returning users once checkpointApproaching is true", () => {
      const result = build({ isReturningUser: true, checkpointApproaching: true });
      expect(result).toContain("\nCHECKPOINTS\n");
    });

    it("excludes POST-REJECTION when not approaching (regardless of returning status)", () => {
      // POST-CHECKPOINT was deleted in Phase 7-High. POST-REJECTION now
      // gates on checkpointApproaching alone — returning-user status no
      // longer auto-loads the block.
      expect(
        build({ checkpointApproaching: false, isReturningUser: false })
      ).not.toContain("POST-REJECTION");
      expect(
        build({ checkpointApproaching: false, isReturningUser: true })
      ).not.toContain("POST-REJECTION");
    });

    it("includes POST-REJECTION once checkpointApproaching is true", () => {
      const result = build({ checkpointApproaching: true });
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
    // Upload Tier 3 block renders during the entry phase (turnCount <= 2)
    // per ADR-042 §3. Tests use turnCount: 0 (Jove opener) so the block
    // fires; the post-entry-phase behavior is covered by the lifecycle
    // tests below.
    it("includes UPLOAD MODE block with opener when mode is upload", () => {
      const result = build({ mode: "upload", turnCount: 0 });
      expect(result).toContain("UPLOAD MODE");
      expect(result).toContain("chose \"Upload\"");
      expect(result).toContain("Paste something here");
    });

    it("includes analysis instructions for upload mode", () => {
      const result = build({ mode: "upload", turnCount: 0 });
      // Shared pasted-content guidance (ADR-042, Phase 1.4) — same body
      // shared between Upload Tier 3 and transcript_detected dynamic block.
      expect(result).toContain("Cross-reference this content against the user's confirmed Manual entries");
      expect(result).toContain("Focus on the USER's behavior");
    });

    it("includes format-specific guidance", () => {
      const result = build({ mode: "upload", turnCount: 0 });
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

    // ADR-042 §3: entry-phase block stops rendering after turnCount > 2.
    // After the opener (turn 0) and the user's paste turn (turn 2), the
    // conversation runs on standard reflective exploration.
    it("UPLOAD MODE renders during entry phase (turnCount <= 2)", () => {
      for (const turnCount of [0, 1, 2]) {
        const result = build({ mode: "upload", turnCount });
        expect(result).toContain("UPLOAD MODE");
      }
    });

    it("UPLOAD MODE stops rendering after entry phase (turnCount > 2)", () => {
      for (const turnCount of [3, 4, 8, 20]) {
        const result = build({ mode: "upload", turnCount });
        expect(result).not.toContain("UPLOAD MODE");
      }
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

      it("the framework-question case folds into the Abstract posture", () => {
        // The standalone five-branch ladder is gone (the framework branch
        // had its own scripted response). It now folds into the Abstract
        // posture: "framework mention" is one of the abstract opener types,
        // handled by the same "answer in one or two sentences, then invite"
        // pattern. Tier 1 #3 ("NO CLINICAL LANGUAGE IN USER-FACING OUTPUT")
        // still governs how Jove handles framework names in any turn.
        const result = build({
          manualComponents: [],
          isReturningUser: false,
          turnCount: 1,
        });
        expect(result).toContain("framework mention");
        expect(result).toContain("NO CLINICAL LANGUAGE IN USER-FACING OUTPUT");
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

      it("renders voice rules as a numbered list: base first, persona deltas after", () => {
        const result = build();
        // Base rules render first under the new base+delta architecture.
        expect(result).toContain(`1. ${VOICE_RULES_BASE[0]}`);
        // The autistic persona's delta rules render after base, so they
        // appear with numbering offset by VOICE_RULES_BASE.length.
        const firstAutisticRuleNumber = VOICE_RULES_BASE.length + 1;
        expect(result).toContain(`${firstAutisticRuleNumber}. ${VOICE_RULES[0]}`);
        // Last rule overall is the last persona delta.
        const totalRules = VOICE_RULES_BASE.length + VOICE_RULES.length;
        expect(result).toContain(
          `${totalRules}. ${VOICE_RULES[VOICE_RULES.length - 1]}`
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

      // Regression pin: dev-simulator audit (2026-05-19) caught these
      // specific therapy-isms drifting through despite BANNED_PATTERNS
      // prose. Promoted to explicit BANNED_PHRASES for reliable
      // phrase-presence enforcement. If any of these get accidentally
      // removed, this test fails. Keep them pinned.
      it.each([
        ["sitting with", "process-narration -ing verb"],
        ["What I want to sit with", "announcing-observation variant"],
        ["What I'm sitting with", "announcing-observation variant"],
        ["What I'm noticing", "announcing-observation variant"],
        ["I'm noticing", "announcing-observation variant (shorter)"],
      ])("BANNED_PHRASES pins '%s' (%s)", (phrase) => {
        expect(BANNED_PHRASES as readonly string[]).toContain(phrase);
        const result = build();
        expect(result).toContain(phrase);
      });

      // Regression pin: dev-simulator audit caught em-dash-joined
      // clauses widespread in body prose. Expanded DASH_TO_PERIOD_RULE
      // with audit-derived examples. Pin a couple so future edits don't
      // silently regress.
      it("DASH_TO_PERIOD_RULE clarifies body-prose scope (not just openers)", () => {
        const result = build();
        expect(result).toContain("applies to BODY prose, not just openers");
      });

      it("DASH_TO_PERIOD_RULE pins audit-derived bad/good pairs", () => {
        const result = build();
        // Pairs lifted from real dev-simulator drift in 2026-05-19 audit
        expect(result).toContain("Your body filed it as a mistake");
        expect(result).toContain("The fluorescents pulling focus");
        expect(result).toContain("You weren't evasive because you didn't care");
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
  // delivered as modals (ChatWindowModal / PatternFormingModal) plus
  // the inline checkpoint trigger card. Negative-regression tests
  // guard against accidental reintroduction.
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

    // ADR-042 §3: guided posture persists for the conversation's life and
    // softens only on explicit user redirect (detection in Phase 2).
    it("GUIDED INTAKE persists across the conversation's life when not softened", () => {
      for (const turnCount of [1, 5, 20, 50]) {
        const result = build({ mode: "guided-intake", turnCount });
        expect(result).toContain("GUIDED INTAKE");
      }
    });

    it("GUIDED INTAKE stops rendering when guidedPostureSoftened is true", () => {
      const result = build({ mode: "guided-intake", guidedPostureSoftened: true });
      expect(result).not.toContain("GUIDED INTAKE");
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
        turnCount: 0,
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      expect(result).toContain("returning user");
      expect(result).toContain("without introducing yourself");
    });

    it("returning-user situation-specific first-turn block only renders in situation mode", () => {
      // turnCount: 1 lands inside the bootstrap-aware entry-phase gate
      // (turnCount <= 3). Without it, default turnCount: 5 is past the gate.
      const situation = build({
        mode: "situation",
        isReturningUser: true,
        turnCount: 1,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      const guided = build({
        mode: "guided-intake",
        isReturningUser: true,
        turnCount: 1,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test", conversation_id: "c1" }],
      });
      expect(situation).toContain("RETURNING USER — SITUATION OPENER");
      expect(guided).not.toContain("RETURNING USER — SITUATION OPENER");
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

    it("general mode does not pull in autistic-specific deepening examples", () => {
      // Under the new base+delta architecture, voice-general.ts contributes
      // no weak→strong pairs (the base voice carries the general voice).
      // The autistic-specific examples still appear only when autistic is
      // active. The point of this test is to verify persona isolation:
      // an autistic-specific somatic prompt should not leak into general
      // mode.
      const autistic = build({ personaModes: ["autistic"] });
      const general = build({ personaModes: ["general"] });
      expect(autistic).toContain("what your body was doing right then");
      expect(general).not.toContain("what your body was doing right then");
      expect(autistic).toContain("What happens when you realize you didn't know the code");
      expect(general).not.toContain("What happens when you realize you didn't know the code");
    });
  });

  // ─── Multi-select composition ────────────────────────────────────────────
  // Pin the prod default flip from ["autistic"] to ["general"] across all
  // four fallback paths (migration 20260519100000 / 2026-05-19). The
  // `defaults` object at the top of this file pins personaModes to
  // autistic for the bulk of the suite so existing autistic-content
  // assertions still pass; these tests deliberately omit personaModes to
  // exercise the new prod default.
  describe("prod default persona mode (no personaModes specified)", () => {
    it("buildSystemPrompt with no personaModes → general voice (not autistic)", () => {
      // Spread defaults but explicitly drop personaModes to exercise the
      // function's internal fallback.
      const opts = { ...defaults };
      delete (opts as Partial<OneOnOnePromptOptions>).personaModes;
      const result = buildSystemPrompt(opts);
      expect(result).toContain("has not named a neurotype");
      expect(result).not.toContain("late-diagnosed autistic adults");
    });
  });

  describe("composeTier2 equal-stacking", () => {
    it("single mode returns that mode's full Tier 2", () => {
      const single = composeTier2(["autistic"]);
      expect(single).toContain("late-diagnosed autistic adults");
    });

    it("empty array defaults to general (flipped 2026-05-19 from autistic)", () => {
      const empty = composeTier2([]);
      // General is the neutral neurotype-free voice. Should NOT contain
      // autistic-specific framing.
      expect(empty).not.toContain("late-diagnosed autistic adults");
      // Should contain general's persona-specific intro paragraph.
      expect(empty).toContain("has not named a neurotype");
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

  // ─── buildSystemPromptBlocks (prompt-cache split) ─────────────────────────
  describe("buildSystemPromptBlocks — cache-aware three-tier split", () => {
    const blocksDefaults: OneOnOnePromptOptions = {
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "test-conversation-id",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
      isFirstCheckpoint: false,
      turnCount: 5,
      checkpointApproaching: false,
    };

    function buildBlocks(overrides: Partial<OneOnOnePromptOptions> = {}) {
      return buildSystemPromptBlocks({ ...blocksDefaults, ...overrides });
    }

    it("returns three string blocks: tier1, staticContext, dynamic", () => {
      const blocks = buildBlocks();
      expect(typeof blocks.tier1).toBe("string");
      expect(typeof blocks.staticContext).toBe("string");
      expect(typeof blocks.dynamic).toBe("string");
      expect(blocks.tier1.length).toBeGreaterThan(0);
      expect(blocks.staticContext.length).toBeGreaterThan(0);
      expect(blocks.dynamic.length).toBeGreaterThan(0);
    });

    it("tier1 contains intro + TIER 1 only — no Tier 2/3 markers", () => {
      const blocks = buildBlocks();
      expect(blocks.tier1).toContain("You are Jove");
      expect(blocks.tier1).toContain("TIER 1: CONSTITUTIONAL RULES");
      expect(blocks.tier1).not.toContain("TIER 2:");
      expect(blocks.tier1).not.toContain("TIER 3:");
    });

    it("staticContext contains Tier 2 voice but NOT Tier 3 mechanics", () => {
      const blocks = buildBlocks();
      expect(blocks.staticContext).toContain("TIER 2:");
      expect(blocks.staticContext).toContain("VOICE RULES");
      expect(blocks.staticContext).not.toContain("TIER 3:");
      expect(blocks.staticContext).not.toContain(
        "TIER 3: CONVERSATION MECHANICS"
      );
    });

    it("dynamic contains Tier 3 mechanics but NOT Tier 1/Tier 2 headers", () => {
      const blocks = buildBlocks();
      expect(blocks.dynamic).toContain("TIER 3: CONVERSATION MECHANICS");
      expect(blocks.dynamic).not.toContain("TIER 1: CONSTITUTIONAL RULES");
      expect(blocks.dynamic).not.toContain("TIER 2: VOICE AND BEHAVIOR");
    });

    it("recent Manual entries appear in dynamic, NOT in staticContext", () => {
      // Entries authored in the current conversation MUST stay in the
      // dynamic block — they change every turn that adds a confirmation
      // and would invalidate the cache prefix otherwise.
      const blocks = buildBlocks({
        currentConversationId: "conv-current",
        manualComponents: [
          {
            layer: 1,
            name: "Fresh Pattern",
            content: "Current session content here.",
            source_conversation_id: "conv-current",
            created_at: "2026-04-15T12:00:00Z",
          },
        ],
      });
      expect(blocks.dynamic).toContain("Current session content here.");
      expect(blocks.dynamic).toContain('"Fresh Pattern"');
      expect(blocks.staticContext).not.toContain("Current session content here.");
      expect(blocks.staticContext).not.toContain('"Fresh Pattern"');
    });

    it("older (compressed) Manual entries appear in staticContext, NOT in dynamic", () => {
      // Older entries are stable across a session — they're the prime
      // caching target. Six entries forces some into the compressed
      // tail past the RECENT_FULL_LIMIT of 4.
      const blocks = buildBlocks({
        currentConversationId: "conv-current",
        manualComponents: Array.from({ length: 6 }, (_, i) => ({
          layer: 1,
          name: `Old Entry ${i}`,
          content: `Old content ${i}`,
          summary: `Summary for entry ${i}.`,
          key_words: [`kw${i}a`, `kw${i}b`],
          source_conversation_id: "conv-old",
          created_at: `2026-01-${(i + 1).toString().padStart(2, "0")}T00:00:00Z`,
        })),
      });
      // The "EARLIER ENTRIES" header marks the compressed-older block.
      expect(blocks.staticContext).toContain("EARLIER ENTRIES (compressed");
      expect(blocks.dynamic).not.toContain("EARLIER ENTRIES (compressed");
      // The oldest entry's compressed summary lives in staticContext.
      expect(blocks.staticContext).toContain("Summary for entry 0.");
      expect(blocks.dynamic).not.toContain("Summary for entry 0.");
    });

    it("staticContext is byte-identical across calls with the same inputs (cache pre-req)", () => {
      // Anthropic caches by prefix-byte identity. If the static block
      // differs even by a character, the cache miss-rate is 100%. This
      // is the most load-bearing test in the file.
      const opts: OneOnOnePromptOptions = {
        ...blocksDefaults,
        currentConversationId: "conv-cache-stability",
        isReturningUser: true,
        manualComponents: [
          {
            layer: 1,
            name: "Persistent",
            content: "Persistent content",
            summary: "Persistent summary.",
            key_words: ["a", "b"],
            source_conversation_id: "conv-old",
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            layer: 2,
            name: "Persistent 2",
            content: "Persistent content 2",
            summary: "Persistent 2 summary.",
            key_words: ["c", "d"],
            source_conversation_id: "conv-old",
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        personaModes: ["autistic"],
        turnCount: 7,
        sessionCount: 4,
      };
      const a = buildSystemPromptBlocks(opts);
      const b = buildSystemPromptBlocks(opts);
      expect(a.tier1).toBe(b.tier1);
      expect(a.staticContext).toBe(b.staticContext);
    });

    it("staticContext changes when personaModes change (different user → different cache)", () => {
      // Cache prefix is per-content; changing the voice block correctly
      // forces a new cache entry rather than reading a stale one.
      const autistic = buildBlocks({ personaModes: ["autistic"] });
      const dyslexic = buildBlocks({ personaModes: ["dyslexic"] });
      expect(autistic.staticContext).not.toBe(dyslexic.staticContext);
    });

    it("staticContext is identical across turnCount changes (per-turn flags do not affect cache)", () => {
      // turnCount flips Tier 3 conditional blocks. None of those should
      // appear in staticContext; otherwise every turn would miss the cache.
      const turn1 = buildBlocks({ turnCount: 1, isReturningUser: false });
      const turn7 = buildBlocks({ turnCount: 7, isReturningUser: false });
      expect(turn1.staticContext).toBe(turn7.staticContext);
    });

    it("staticContext is identical across checkpointApproaching changes", () => {
      const approaching = buildBlocks({ checkpointApproaching: true });
      const notApproaching = buildBlocks({ checkpointApproaching: false });
      expect(approaching.staticContext).toBe(notApproaching.staticContext);
    });
  });

  describe("buildSystemPrompt ↔ buildSystemPromptBlocks shared helpers", () => {
    // These tests pin the invariant that both prompt builders pull their
    // dynamic-context bodies (SESSION CONTEXT, TRANSCRIPT DETECTED,
    // EXPLORATION FOCUS) from the same private helpers. If a future change
    // edits one body but not the other, these assertions fail.
    const sharedDefaults: OneOnOnePromptOptions = {
      kind: "oneOnOne",
      manualComponents: [],
      currentConversationId: "test-conversation-id",
      isReturningUser: false,
      sessionSummary: null,
      extractionContext: "",
      isFirstCheckpoint: false,
      turnCount: 5,
      checkpointApproaching: false,
    };

    function bothForms(overrides: Partial<OneOnOnePromptOptions> = {}) {
      const opts = { ...sharedDefaults, ...overrides };
      return {
        legacy: buildSystemPrompt(opts),
        blocks: buildSystemPromptBlocks(opts),
      };
    }

    // Locate a header line + capture from it to the next blank-line boundary
    // or to the next ALL-CAPS header. Good enough for these invariant checks.
    function extractBlock(prompt: string, header: string): string {
      const start = prompt.indexOf(header);
      if (start === -1) return "";
      const rest = prompt.slice(start);
      // Stop before the next named block header we care about.
      const nextHeader = rest
        .split("\n")
        .slice(1)
        .findIndex((line) =>
          /^(SESSION CONTEXT|TRANSCRIPT DETECTED|EXPLORATION FOCUS|CONFIRMED MANUAL|EARLIER ENTRIES|EXTRACTION)/.test(
            line,
          ),
        );
      if (nextHeader === -1) return rest;
      // +1 because we sliced past the first line in the findIndex.
      return rest.split("\n").slice(0, nextHeader + 1).join("\n");
    }

    it("SESSION CONTEXT body is byte-identical in legacy and blocks form", () => {
      const { legacy, blocks } = bothForms({
        isReturningUser: true,
        sessionCount: 3,
        sessionSummary: "Previously discussed the morning meeting pattern.",
      });
      const legacyBlock = extractBlock(legacy, "SESSION CONTEXT");
      const blocksBlock = extractBlock(blocks.dynamic, "SESSION CONTEXT");
      expect(legacyBlock).toBe(blocksBlock);
      expect(legacyBlock).toContain("This is session 3");
      expect(legacyBlock).toContain("Returning user");
      expect(legacyBlock).toContain("Previously discussed the morning meeting pattern.");
    });

    it("TRANSCRIPT DETECTED body is byte-identical in legacy and blocks form", () => {
      const { legacy, blocks } = bothForms({
        transcriptContext: { isTranscript: true, confidence: "high" },
      });
      const legacyBlock = extractBlock(legacy, "TRANSCRIPT DETECTED");
      const blocksBlock = extractBlock(blocks.dynamic, "TRANSCRIPT DETECTED");
      expect(legacyBlock).toBe(blocksBlock);
      expect(legacyBlock).toContain("RECOGNITION");
      expect(legacyBlock).toContain("DO NOT");
    });

    it("EXPLORATION FOCUS body is byte-identical in legacy and blocks form", () => {
      const explorationContext: ExplorationContext = {
        type: "entry",
        layerId: 2,
        layerName: "How I Process Things",
        name: "I freeze before deciding",
        content: "When the choices stack up, the body locks before the head can sort.",
      };
      const { legacy, blocks } = bothForms({ explorationContext });
      const legacyBlock = extractBlock(legacy, "EXPLORATION FOCUS");
      const blocksBlock = extractBlock(blocks.dynamic, "EXPLORATION FOCUS");
      expect(legacyBlock).toBe(blocksBlock);
      expect(legacyBlock).toContain("I freeze before deciding");
      expect(legacyBlock).toContain("How I Process Things");
    });

    it("legacy form places Manual entries (recent + older) together after Tier 3", () => {
      // Eight entries spanning enough that prepareManualContext splits some
      // into the older-compressed block. Verify legacy keeps them adjacent
      // and after Tier 3.
      const manualComponents = Array.from({ length: 8 }, (_, i) => ({
        id: `id-${i}`,
        user_id: "u",
        source_conversation_id: i < 2 ? "test-conversation-id" : "older-conv",
        layer: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
        name: `Entry ${i}`,
        content: `Content for entry ${i}.`,
        summary: `Summary ${i}.`,
        key_words: ["k1", "k2"],
        status: "confirmed" as const,
        created_at: new Date(2026, 0, i + 1).toISOString(),
        updated_at: new Date(2026, 0, i + 1).toISOString(),
      }));
      const legacy = buildSystemPrompt({ ...sharedDefaults, manualComponents });
      // Legacy places CONFIRMED MANUAL and EARLIER ENTRIES adjacent, both
      // after the Tier 3 region.
      const tier3Idx = legacy.indexOf("TIER 3");
      const confirmedIdx = legacy.indexOf("CONFIRMED MANUAL");
      const earlierIdx = legacy.indexOf("EARLIER ENTRIES");
      expect(tier3Idx).toBeGreaterThan(-1);
      expect(confirmedIdx).toBeGreaterThan(tier3Idx);
      expect(earlierIdx).toBeGreaterThan(confirmedIdx);
    });
  });
});
