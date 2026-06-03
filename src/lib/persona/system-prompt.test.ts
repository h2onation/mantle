import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildSystemPromptBlocks,
  composeTier2,
} from "@/lib/persona/system-prompt";
import type { OneOnOnePromptOptions } from "@/lib/persona/system-prompt";
import type { ExplorationContext } from "@/lib/types";
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
  VOICE_RULES as ADHD_VOICE_RULES,
  LANDING_EXAMPLES as ADHD_LANDING_EXAMPLES,
} from "@/lib/persona/voice-adhd";
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
      expect(result).toContain("EVERY TURN ENDS WITH A HANDOFF");
      expect(result).toContain("JOVE ASKS. JOVE DOES NOT DECLARE");
      expect(result).toContain("CRISIS PROTOCOL");
      expect(result).toContain("JOVE IS NOT A THERAPIST");
    });

    it("Tier 1 #4 is the handoff rule — imperatives sanctioned, two question marks still over, no post-confirm exception", () => {
      // Worldview v2 voice update (2026-05-20) reframed Tier 1 #4 from
      // "ONE QUESTION PER TURN" to "EVERY TURN ENDS WITH A HANDOFF" — a
      // question OR a directive that hands the user a clear next move.
      // Imperatives like "walk me through what happened" are sanctioned
      // handoffs. Two question marks is still over (pick one). The
      // post-confirmation continuation-offer is reframed as a
      // directive-shaped handoff, not an exception — so Tier 1 #4 reads
      // as truly no-exceptions, matching the worldview.
      const result = build();
      expect(result).toContain("question OR a directive that hands the user a clear next move");
      expect(result).toContain("walk me through what happened");
      expect(result).toContain("Two question marks in one turn is still over the line");
      expect(result).toContain(
        "The post-confirmation continuation-offer"
      );
      expect(result).toContain("directive-shaped handoff, not an exception");
      // The old headline wording is gone:
      expect(result).not.toContain("ONE QUESTION PER TURN");
      // The narrower "reflection + one question" framing is also gone:
      expect(result).not.toContain("Every Jove turn is a reflection + one question");
      // The pre-v2 post-confirmation exception language is gone:
      expect(result).not.toContain(
        "is the only exception — that is a transition, not a conversational turn"
      );
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

    it("contains 'Earlier in this conversation:' when sessionSummary is provided", () => {
      const result = build({
        isReturningUser: true,
        sessionSummary: "Explored conflict avoidance patterns.",
      });
      expect(result).toContain("Earlier in this conversation:");
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
      expect(result).toContain("the part that's hard to see from the inside");
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
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test" }],
        isReturningUser: true,
        turnCount: 1,
      });
      expect(result).toContain("do not introduce yourself by name");
    });

    it("instructs Jove to argue from evidence, not perform neutrality", () => {
      const result = build({
        manualComponents: [],
        isReturningUser: false,
        turnCount: 1,
      });
      // The old "claim to be objective, unbiased, or filter-free" line
      // retired with the sparring-partner intro rewrite (2026-05-19). The
      // anti-neutrality stance now lives as an active arguing posture in
      // VOICE_INTRO_PARAGRAPHS_BASE: Jove names contradictions when it
      // sees them, evidence-grounded.
      expect(result).toContain(
        "You argue when you see them describing something one way and doing it another"
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
    it("renders the POST-REJECTION section on the post-rejection turn", () => {
      const result = build({ postRejection: true });
      expect(result).toContain("POST-REJECTION");
    });

    it("instructs a varied, entry-specific one-liner instead of a fixed string", () => {
      const result = build({ postRejection: true });
      // The old verbatim line is gone — the response is now generated,
      // references the specific rejected entry, and varies each time.
      expect(result).not.toContain("must be exactly this single line");
      expect(result).toContain("Vary the wording every time");
      expect(result).toContain("Never reuse a fixed line");
      expect(result).toContain("naming what it was about in the user's own terms");
    });

    it("scopes the fixed line to the immediate post-rejection turn only", () => {
      const result = build({ postRejection: true });
      expect(result).toContain("immediate post-rejection turn");
      expect(result).toContain("return to natural exploration");
    });

    it("preserves the existing 'do not re-propose the same pattern' rule", () => {
      const result = build({ postRejection: true });
      expect(result).toContain("Do not re-propose the same pattern in this session");
    });

    it("does NOT load on a normal checkpoint-approaching turn (gated on the rejection signal, not approaching)", () => {
      // The bug this fixes: POST-REJECTION used to gate on checkpointApproaching,
      // so the fixed line could fail to fire right after a rejection (when
      // extraction no longer reported approaching) and was primed on every
      // approaching turn. It now gates on the rejection signal alone.
      const result = build({ checkpointApproaching: true, postRejection: false });
      expect(result).not.toContain("POST-REJECTION");
      expect(result).not.toContain("That entry didn't land. Was it off, or just not ready?");
    });

    it("does NOT load for returning users absent a rejection", () => {
      const result = build({ isReturningUser: true, checkpointApproaching: false });
      expect(result).not.toContain("POST-REJECTION");
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

    it("excludes POST-REJECTION absent a rejection (regardless of returning status)", () => {
      // POST-CHECKPOINT was deleted in Phase 7-High. POST-REJECTION gates on
      // the rejection signal (postRejection) — neither returning-user status
      // nor an approaching checkpoint loads the block.
      expect(
        build({ checkpointApproaching: false, isReturningUser: false })
      ).not.toContain("POST-REJECTION");
      expect(
        build({ checkpointApproaching: true, isReturningUser: true })
      ).not.toContain("POST-REJECTION");
    });

    it("includes POST-REJECTION on the post-rejection turn", () => {
      const result = build({ postRejection: true });
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
    it("includes UPLOAD MODE block when mode is upload", () => {
      const result = build({ mode: "upload", turnCount: 0 });
      expect(result).toContain("UPLOAD MODE");
      expect(result).toContain("chose \"Upload\"");
    });

    it("does not embed UPLOAD_OPENER text in the prompt", () => {
      // The opener is server-emitted from call-persona.ts to keep the
      // "locked invitation" actually locked. The model should never be
      // asked to reproduce it. If "Paste something here" reappears,
      // someone re-introduced the prompt-driven opener.
      const result = build({ mode: "upload", turnCount: 0 });
      expect(result).not.toContain("Paste something here");
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

  // ─── App and platform questions guard ───────────────────────────────────
  // Added 2026-05-25 after the credit-exhaustion incident: a user asked
  // "what happened to our chat, the history is gone" and Jove
  // confabulated "I can't push the history back to your screen. That's a
  // platform limitation." The history wasn't actually lost — Jove just
  // didn't have visibility into the app and made up a plausible reason.
  // Same posture as the URL fabrication guard: you can't see it, say so.
  describe("app and platform questions guard", () => {
    it("base prompt contains the APP AND PLATFORM QUESTIONS section in Tier 3", () => {
      const result = build();
      expect(result).toContain("APP AND PLATFORM QUESTIONS");
    });

    it("explicitly forbids speculating about platform limitations", () => {
      const result = build();
      expect(result).toContain(
        "Do not fabricate platform limitations or technical reasons to fill the gap"
      );
    });

    it("includes the worked example from the actual incident", () => {
      const result = build();
      // Pins the 'do NOT' example so a future edit that softens this rule
      // has to confront the literal confabulated line that motivated it.
      expect(result).toContain(
        '"I can\'t push the history back to your screen, that\'s a platform limitation"'
      );
      expect(result).toContain('"I can\'t see into the app — that\'s a question for the team');
    });
  });

  // ─── Always-on Tier 3 blocks ─────────────────────────────────────────────
  describe("always-on Tier 3 blocks", () => {
    it("SHORT ANSWERS level-1 walkthrough invitation is present (direct phrasing)", () => {
      // Sparring-partner direction: dropped the "Can you" prefix and the
      // question mark on level 1. Walkthrough invitation is now a direct
      // imperative — "Walk me through what happened" — matching the
      // take-positions voice rule.
      const result = build();
      expect(result).toContain(
        "Walk me through what happened, step by step. Start from right before it started."
      );
      // Old interrogative phrasing is gone:
      expect(result).not.toContain(
        "Can you walk me through what happened, step by step?"
      );
    });

    describe("SHORT ANSWERS escalation ladder (push-for-material expansion)", () => {
      it("contains the level-2 scene invitation", () => {
        const result = build();
        expect(result).toContain(
          "Give me one specific moment. Where you were, what the room was like, what your body did. One scene is worth ten general answers."
        );
      });

      it("contains the level-3 Manual-stakes ask", () => {
        const result = build();
        expect(result).toContain("I want more to work with");
        expect(result).toContain("To put something in your Manual that's actually yours");
        expect(result).toContain("A few paragraphs, not a sentence");
      });

      it("contains the take-your-time and dictation light suggestions in level 3", () => {
        const result = build();
        expect(result).toContain("Take your time");
        expect(result).toContain(
          "Type longer if you can — dictation works too if typing is the bottleneck"
        );
      });

      it("authorizes light nudges and forward-looking practical suggestions", () => {
        const result = build();
        expect(result).toContain("Light nudges are fine");
        expect(result).toContain(
          "Forward-looking practical suggestions are sanctioned"
        );
      });

      it("pins the across-the-line examples (brevity-as-complaint)", () => {
        const result = build();
        expect(result).toContain("you're being short");
        expect(result).toContain("your answers are too short");
        expect(result).toContain(
          "frames the user as failing rather than the conversation as needing more rope"
        );
      });

      it("caps the level-3 stakes move at ONCE per conversation", () => {
        const result = build();
        expect(result).toContain("Level-3 fires ONCE per conversation");
        expect(result).toContain("Never repeat the dictation/take-your-time tip");
      });

      it("keeps the cumulative-thinness threshold (two turns + no scene)", () => {
        const result = build();
        expect(result).toContain(
          "TWO consecutive responses are under 15 words AND no concrete scene has surfaced"
        );
      });

      it("keeps the brief-is-valid posture (didn't flip to push-everyone)", () => {
        // The new escalation adds a level-3 ask but doesn't retract the
        // baseline tolerance for brief answers per turn. Autistic users
        // giving direct factual answers still don't get pushed on every
        // exchange.
        const result = build();
        expect(result).toContain(
          "Brief per turn is valid. Direct and brief is a valid mode"
        );
        expect(result).toContain("Raise your tolerance on isolated short answers");
      });

      it("does NOT contain the old level-3 fallback ('try a different angle')", () => {
        // Old level 3 was a generic 'try a different angle' move that didn't
        // push for more material. New level 3 names the Manual stakes.
        const result = build();
        expect(result).not.toContain('Okay. Let me try a different angle.');
      });
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

      // The rule was softened from an absolute ban to a default: periods
      // by default, a single dash allowed in body prose when it carries
      // rhythm a period would flatten. The ban was flattening the voice
      // into a monotone staccato (audit, 2026-06-03).
      it("DASH_TO_PERIOD_RULE defaults to periods but allows a dash in body prose for rhythm", () => {
        const result = build();
        expect(result).toContain("Default to periods");
        expect(result).toContain("body prose");
        expect(result).toContain("One dash at most in a turn");
      });

      it("DASH_TO_PERIOD_RULE keeps the period-landing exemplars", () => {
        const result = build();
        expect(result).toContain("Your body filed it as a mistake");
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
      it("VOICE_RULES contains the body-substitute phrasing", () => {
        const result = build();
        expect(result).toContain("what their body did");
      });

      it("SHORT ANSWERS uses walkthrough framing, not patronizing language", () => {
        const result = build();
        expect(result).toContain("Direct and brief is a valid mode");
        expect(result).toContain("Never patronize");
        expect(result).not.toContain("You're being honest but concise");
      });
    });
  });

  // ─── Sparring partner with forensic backing (2026-05-19 voice update) ───
  // The base voice shifted from "intelligent and direct" to a sparring
  // partner with forensic backing: surface is witty and direct, spine is
  // evidence (every observation traces to something the user said). Rules
  // added for evidence-grounded wit, pattern distance for costly patterns,
  // names of people in the user's life used freely, default-to-direct with
  // earned imagery, sequence (evidence → pattern → image → hand back),
  // no-pattern transparency, visible mechanism (sparingly), state-aware
  // drop-the-wit. Banned-list expansion for therapy softeners, service
  // hedges, identity-framed patterns, decorative analogies, irony on
  // clever lines, feeling-first questions, and using the user's own name.
  describe("sparring partner with forensic backing voice update", () => {
    describe("VOICE_INTRO_PARAGRAPHS_BASE", () => {
      it("contains the sparring-partner intro paragraphs (first paragraph unchanged in Worldview v2)", () => {
        const result = build();
        expect(result).toContain("You quote the user back to themselves");
        expect(result).toContain(
          "You argue when you see them describing something one way and doing it another"
        );
        expect(result).toContain("The Manual is theirs. You edit. They write.");
        expect(result).toContain("Your spine is evidence");
        // The "wit targets the situation and the pattern" closing line of
        // the second paragraph was replaced in the Worldview v2 voice
        // update — the new closing is "edge comes from close attention,
        // never from standing above the user." Pinned in the
        // VOICE_INTRO_PARAGRAPHS_BASE block under "Worldview v2 voice
        // update" below.
      });

      it("does NOT contain the old intro paragraphs", () => {
        const result = build();
        expect(result).not.toContain(
          "You help people see how they actually operate. The work is intelligent and direct."
        );
        expect(result).not.toContain(
          "You notice what's implied but not said. The unnamed person, the avoided word, the missing piece."
        );
      });
    });

    describe("VOICE_RULES_BASE — new sparring-partner rules", () => {
      it.each([
        [
          "Every clever or pointed line traces to something they actually said",
          "evidence-grounded wit (Rule 2 reinforced)",
        ],
        [
          "Sharp about behavior and the pattern. Never about the user. The pattern is the target.",
          "wit targets pattern, never user (Rule 7)",
        ],
        ["Pattern distance for costly patterns", "pattern distance (Rule 9)"],
        [
          "Use the names of people in the user's life freely",
          "names freely, user's name almost never (Rule 10)",
        ],
        [
          "Default to direct. Surprise is a register, not a frequency.",
          "imagery posture (Rule 11)",
        ],
        [
          "Sequence is evidence, then pattern, then image, then hand back.",
          "sequence (Rule 12)",
        ],
      ])("renders rule phrase: %s", (phrase) => {
        const result = build();
        expect(result).toContain(phrase);
      });

      it("merges 'no time pressure' into the Compress rule", () => {
        // 'No time pressure' (formerly its own rule) folded into Compress
        // during the 16→12 trim. Rule list now ends at 12.
        const result = build();
        expect(result).toContain('Silence is processing');
        expect(result).toContain('Compress.');
      });

      it("folds the state-aware drop-the-wit clause into the imagery rule", () => {
        // State-aware (formerly its own rule) folded into Rule 11
        // (imagery) during the 16→12 trim. Same theme: when to use
        // imagery vs. when NOT to use it.
        const result = build();
        expect(result).toContain('When the user is in genuine distress, drop imagery entirely');
        expect(result).toContain('Clean observation, one direct question');
      });

      it("no-pattern transparency is now taught by BANNED_PATTERNS, not as its own rule", () => {
        // Rule 13 (no-pattern surfaces) cut during 16→12 trim. The behavior
        // is taught by BANNED_PATTERNS "Open-ended invitations with no shape"
        // plus the no-pattern weak→strong pair. The standalone rule was redundant.
        const result = build();
        expect(result).toContain('Open-ended invitations with no shape');
        // The strong-side teaching example for the no-pattern move stays:
        expect(result).toContain("Nothing's pulling into shape yet. Two options.");
        // The standalone rule wording is gone:
        expect(result).not.toContain('When no pattern surfaces, name it transparently.');
      });

      it("visible mechanism is now taught by BANNED_PATTERNS carve-out, not as its own rule", () => {
        // Rule 14 (visible mechanism) cut during 16→12 trim. The carve-out
        // folded into BANNED_PATTERNS "Announcing-before-observation" entry.
        const result = build();
        expect(result).toContain("Naming what you're doing IS allowed, sparingly");
        expect(result).toContain('That one I want to mark');
        // The standalone rule wording is gone:
        expect(result).not.toContain('Visible mechanism is allowed, sparingly.');
      });

      it("repair guidance is carried by WHEN_JOVE_IS_WRONG, not as its own rule", () => {
        // 'One repair, then sharper' (Rule 16) cut during 16→12 trim. The
        // scaffolded WHEN_JOVE_IS_WRONG section carries repair in full.
        const result = build();
        expect(result).toContain('WHEN JOVE IS WRONG');
        expect(result).toContain("That didn't land. Tell me where it broke.");
        // The standalone rule's exact wording is gone:
        expect(result).not.toContain("One repair, then sharper. Don't stack apologies.");
      });
    });

    describe("BANNED_PHRASES — new sparring-partner entries", () => {
      // The 5 near-duplicate variants ("I can imagine," "That sounds hard,"
      // "Thanks for sharing," "Let's sit with that," "Hold space") were
      // cut during the 16→12 trim — each had an existing canonical entry
      // ("I can only imagine," "That sounds really hard," "Thank you for
      // sharing," "Sit with that," "Hold space for") already doing the work.
      it.each([
        ["That sounds really difficult", "empathy cliché variant"],
        ["Great question", "performed warmth"],
        ["I'd love to help", "performed warmth"],
        ["I'm happy to", "service-industry register"],
        ["I appreciate you", "performed warmth"],
        ["It makes sense that", "empathy cliché"],
        ["You're doing the work", "therapy-ism"],
        ["Be gentle with yourself", "therapy-ism"],
        ["Take a breath", "therapy-ism"],
        ["Reflect on", "therapy-ism"],
        ["I want to honor", "performative gratitude"],
        ["It's valid to feel", "validation cliché"],
        ["Your feelings are valid", "validation cliché"],
        ["There's no wrong way to", "therapy-ism"],
      ])("BANNED_PHRASES pins '%s' (%s)", (phrase) => {
        expect(BANNED_PHRASES as readonly string[]).toContain(phrase);
        const result = build();
        expect(result).toContain(phrase);
      });

      it.each([
        "I can imagine",
        "That sounds hard",
        "Thanks for sharing",
        "Let's sit with that",
        "Hold space",
      ])("trimmed near-duplicate '%s' is gone from BANNED_PHRASES", (phrase) => {
        expect(BANNED_PHRASES as readonly string[]).not.toContain(phrase);
      });
    });

    describe("BANNED_PATTERNS — new sparring-partner patterns", () => {
      it.each([
        ["Therapeutic softeners before sharp observations", "therapy-softener-hedges"],
        ["Service-industry hedges", "customer-support register"],
        ["Pattern names framed as identity", "identity-framing"],
        ["Decorative analogies.", "decorative-analogy"],
        ["Irony or hedging attached to a clever line", "irony-hedge"],
        [
          "Asking how the user feels before establishing what happened",
          "feeling-first",
        ],
        ["Open-ended invitations with no shape", "tell-me-more"],
        ["Using the user's own name in a reply", "user-name"],
      ])("BANNED_PATTERNS contains '%s' (%s)", (phrase) => {
        const result = build();
        expect(result).toContain(phrase);
      });

      it("rewrote 'Announcing observations' entry with the visible-mechanism carve-out inline", () => {
        // After the 16→12 trim, the visible-mechanism rule was cut as a
        // standalone voice rule and folded into this BANNED_PATTERNS entry
        // as the inline carve-out. The entry now teaches both the ban
        // (announce-then-state) and the allowed move (mechanism-as-the-move)
        // in one place.
        const result = build();
        expect(result).toContain("Announcing-before-observation");
        expect(result).toContain("Naming what you're doing IS allowed, sparingly");
        expect(result).toContain('That one I want to mark');
        expect(result).toContain('Holding this aside, something earlier might connect');
        expect(result).toContain("I'm going to push on this. Tell me if I'm forcing it");
        // Old wording (pre-trim) without the inline carve-out is gone:
        expect(result).not.toContain(
          "Announcing observations: 'here's what I'm noticing,' 'I want to name something.' Make the observation directly. Do not narrate that you are about to make it."
        );
        // Cross-reference to a separate voice rule is gone (the rule was cut):
        expect(result).not.toContain("see the visible-mechanism voice rule");
      });
    });

    describe("EXAMPLE_REGISTER_BASE — new sparring-partner examples", () => {
      it.each([
        "Naming a strength",
        "Visible mechanism",
        "User in a hard state",
        "Sequence with evidence",
        "Pattern distance",
      ])("contains register example labeled '%s'", (label) => {
        const result = build();
        expect(result).toContain(label);
      });

      it("Self-introduction line is the new sparring-partner version", () => {
        const result = build();
        expect(result).toContain(
          "I read what you bring me, quote you back to yourself, and push back when something doesn't fit"
        );
        expect(result).toContain(
          "Half the time the big one is just the loud version of a quieter thing"
        );
        // Old Self-introduction line is gone:
        expect(result).not.toContain(
          "I'm Jove. A conversational AI built to help you explore the parts that aren't always obvious."
        );
      });
    });

    describe("LANDING_EXAMPLES_BASE — new sparring-partner landings", () => {
      it.each([
        "Pattern with evidence trail",
        "Naming recurrence by the person's name",
        "Reframing morality to mechanism",
        "Wit targeting the pattern, not the user",
      ])("contains landing labeled '%s'", (label) => {
        const result = build();
        expect(result).toContain(label);
      });

      it("contains the three-drinks evidence-trail with match-in-gas image", () => {
        const result = build();
        expect(result).toContain("three drinks past patient");
        expect(result).toContain(
          "Like blaming the match for the fire when the room was already full of gas"
        );
      });

      it("contains the circuit-breaker morality-to-mechanism reframe", () => {
        const result = build();
        expect(result).toContain(
          "less like a wall going up and more like a circuit breaker"
        );
      });

      it("contains the tax-filings analogy targeting the apology, not the person", () => {
        const result = build();
        expect(result).toContain("Your apologies sound like tax filings");
        expect(result).toContain("She isn't auditing you");
      });
    });

    describe("WEAK_STRONG_EXAMPLES_BASE — new sparring-partner pairs", () => {
      it("includes the no-pattern-surfaces strong line", () => {
        const result = build();
        expect(result).toContain(
          "Nothing's pulling into shape yet. Two options."
        );
      });

      it("includes the pattern-distance strong line for costly patterns", () => {
        const result = build();
        expect(result).toContain(
          "There's a version of you that goes quiet when the conversation gets sharp"
        );
      });

      it("includes the state-aware strong line when user shares something hard", () => {
        const result = build();
        expect(result).toContain(
          "Okay. You haven't said it out loud before. What made it sayable now."
        );
      });

      it("includes the 'I'd rather argue' strong line for user pushback", () => {
        const result = build();
        expect(result).toContain(
          "I'd rather argue about it than agree about the wrong thing"
        );
      });

      it("includes the 'bouncing back' strong line for what-should-I-do", () => {
        const result = build();
        expect(result).toContain(
          "You came in with most of the answer already in the way you described it"
        );
      });
    });

  });

  // ─── Worldview v2 voice update (2026-05-20) ──────────────────────────────
  // Seven new base voice rules (R-15..R-21), four new BANNED_PATTERNS, three
  // new register entries, seven new base landings, three new weak→strong
  // pairs, tightened WHEN_USER_ASKS_WHAT_SHOULD_I_DO (never-prescribe with
  // safety carve-out), and one new landing per persona delta plus one new
  // phantom-baseline rule per neurotype delta (autistic / adhd / dyslexic).
  //
  // R-17 and R-18 each ship as a/b splits — coupling each pair into a
  // single rule taught the wrong default move (auto-attach a strength to
  // every refusal — the superpower trope this audience rejects).
  describe("Worldview v2 voice update", () => {
    describe("VOICE_INTRO_PARAGRAPHS_BASE — truth-not-should framing", () => {
      it("threads truth/should distinction into the second paragraph", () => {
        const result = build();
        expect(result).toContain("You take positions on what is true");
        expect(result).toContain(
          "You never take a position on what they should do"
        );
        expect(result).toContain("That's theirs to reach");
      });

      it("adopts dry-observational framing in place of witty-and-direct", () => {
        const result = build();
        expect(result).toContain("Your surface is dry, observational");
        expect(result).toContain("You don't perform comfort or warmth");
        expect(result).toContain(
          "edge comes from close attention, never from standing above the user"
        );
      });

      it("does NOT contain the old 'witty and direct' surface description", () => {
        const result = build();
        expect(result).not.toContain("Your surface is witty, direct");
        expect(result).not.toContain(
          "wit targets the situation and the pattern. Never the user"
        );
      });
    });

    describe("VOICE_RULES_BASE — Worldview v2 rules (R-15 through R-21)", () => {
      it("VOICE_RULES_BASE has exactly 21 entries (14 pre-existing + 7 new)", () => {
        // Verification gate A from the v2 re-lock: pin the exact count
        // so a future regression that drops or adds a rule trips this
        // assertion before any phrase-pin tests give a noisier failure.
        expect(VOICE_RULES_BASE.length).toBe(21);
      });

      it.each([
        [
          "Take positions on truth, never on what the user should do",
          "R-15 truth/should",
        ],
        [
          "Engage the material, not the framing",
          "R-16 engage material",
        ],
        [
          "Restraint is a move",
          "R-17a restraint (split from former combined R-17)",
        ],
        [
          "Understanding is not always a prelude to change",
          "R-17b understanding-not-change (split from former combined R-17)",
        ],
        [
          "Refuse the phantom baseline",
          "R-18a phantom refusal (split from former combined R-18; base no longer carries persona specifics)",
        ],
        [
          "Sometimes name the strength in the same mechanism as the friction",
          "R-18b strength-in-mechanism (split from former combined R-18, anti-superpower-trope guardrail)",
        ],
        [
          "Variance comes from responsiveness, not rotation",
          "R-19 variance",
        ],
      ])("renders rule headline: %s (%s)", (phrase) => {
        const result = build();
        expect(result).toContain(phrase);
      });

      it("R-15 guards the smuggled should with the Maya example", () => {
        const result = build();
        expect(result).toContain("Guard the smuggled should");
        expect(result).toContain(
          "is the replay measuring you against a clock that isn't yours"
        );
        expect(result).toContain("don't you think you owe Maya a text");
        expect(result).toContain(
          "A position on what the user should do is the user's to reach"
        );
      });

      it("R-15 carries the explicit safety carve-out for crisis signals", () => {
        // BLOCKER 1 from the v2 re-lock: never-prescribe needs an
        // explicit exception for the crisis protocol. Without it the
        // audit framework would flag the crisis directive as a
        // smuggled-should violation, and the model might generalize and
        // soften crisis handoffs into reflections.
        const result = build();
        expect(result).toContain("Safety is the one exception");
        expect(result).toContain(
          "Jove DOES prescribe one thing: contact the crisis resources"
        );
        expect(result).toContain("Tier 1 override on this rule");
        expect(result).toContain("not a smuggled should");
      });

      it("R-16 names the three by-input tactics with concrete trigger words", () => {
        const result = build();
        expect(result).toContain("flattening word");
        expect(result).toContain("'avoiding,' 'fine,' 'just,' 'disaster'");
        expect(result).toContain("cover story");
        expect(result).toContain("over-dismissal");
      });

      it("R-17a (restraint) and R-17b (understanding-not-change) are separate rules", () => {
        // BLOCKER 2 from the v2 re-lock: R-17 was a coupled rule with
        // "Separate point:" inside it — the tell that it was two rules.
        // Split so each fires independently. The "alive move is
        // deliberately not reflecting" (R-17a) is distinct from "some
        // patterns get understood and left alone" (R-17b).
        const result = build();
        expect(result).toContain(
          "Sometimes the alive move is deliberately not reflecting"
        );
        expect(result).toContain("Don't default to fixing a named pattern");
        expect(result).toContain(
          "friction they want to reduce, or texture they want to understand"
        );
        // The pre-split combined wording is gone:
        expect(result).not.toContain(
          "Restraint is a move. Understanding is not always a prelude to change."
        );
        // The "Separate point:" tell from the combined rule is gone:
        expect(result).not.toContain(
          "Separate point: don't default to fixing a named pattern"
        );
      });

      it("R-18a (phantom refusal) and R-18b (strength-in-mechanism) are separate rules", () => {
        // BLOCKER 2 from the v2 re-lock: R-18 was a coupled rule that
        // taught the model to auto-attach a strength to every refusal —
        // the superpower trope this audience rejects. Split so each
        // fires alone.
        const result = build();
        expect(result).toContain("Refuse the phantom baseline.");
        expect(result).toContain(
          "Sometimes name the strength in the same mechanism as the friction."
        );
        expect(result).toContain("Not on every refusal. Not as a default.");
        expect(result).toContain(
          "forcing a strength produces the superpower trope"
        );
        expect(result).toContain("each fire alone");
      });

      it("R-18a base does NOT carry persona-specific phantom forms (they live in deltas)", () => {
        // REQUIRED 3 from the v2 re-lock: the v1 implementation put
        // autism / ADHD / dyslexia phantoms inside the base R-18 body.
        // That violates the architecture (base = cross-persona;
        // persona-deltas carry persona-specifics). Base R-18a now reads
        // as the cross-persona principle only; persona-specific forms
        // live in voice-{autistic,adhd,dyslexic}.ts.
        const generalResult = build({ personaModes: ["general"] });
        // Base R-18a still names "Persona-specific phantom forms… live
        // in the persona deltas" as a pointer, so the literal phrase
        // "Persona-specific phantom forms" should appear. But the
        // specific autism/ADHD/dyslexia phantom forms should NOT appear
        // when general is the only active persona.
        expect(generalResult).toContain("Persona-specific phantom forms");
        // The autism-specific form quoted ('normal' / 'a normal person' /
        // 'just a phone call') should not appear in general mode:
        expect(generalResult).not.toContain("'a normal person'");
        // The ADHD-specific form quoted should not appear in general mode:
        expect(generalResult).not.toContain("'a reliable partner'");
        // The dyslexia-specific form quoted should not appear in general
        // mode:
        expect(generalResult).not.toContain(
          "'a version of the task that ignores how my brain takes in information'"
        );
      });

      it("R-19 keeps only the principle — no turn-shape menu, no handoff-shape menu inside the rule", () => {
        // REQUIRED 4 from the v2 re-lock: the v1 R-19 listed six turn
        // shapes and four handoff shapes as a menu inside the rule. The
        // rule said "don't run a play" then handed the model a play.
        // Self-defeating. Shapes are demonstrated in landings only.
        const result = build();
        expect(result).toContain(
          "Variance comes from responsiveness, not rotation"
        );
        expect(result).toContain(
          "The mechanism is following the user instead of running a play"
        );
        // The R-19 rule body still references the shape catalogue as
        // available demonstrations in the landings, but does NOT itself
        // teach the menu. The pre-v2 menu structure inside the rule is
        // gone — specifically the labeled-shape definitions:
        expect(result).not.toContain("Four handoff shapes:");
        expect(result).not.toContain(
          "choice (concrete options, user picks), body-locating"
        );
        expect(result).not.toContain(
          "competing reads (two or three side by side, no ranking"
        );
      });
    });

    describe("Tier 1 #4 — handoff rule (replaces ONE QUESTION PER TURN)", () => {
      it("contains EVERY TURN ENDS WITH A HANDOFF headline", () => {
        expect(build()).toContain("EVERY TURN ENDS WITH A HANDOFF");
      });

      it("sanctions imperatives as handoffs", () => {
        const result = build();
        expect(result).toContain(
          "An imperative that hands the user a next move"
        );
        expect(result).toContain("walk me through what happened");
        expect(result).toContain("take me into the last time");
      });

      it("forbids the unresolved-statement closing beat", () => {
        const result = build();
        expect(result).toContain(
          "A strong statement can sit second to last; it cannot be the closing beat"
        );
      });

      it("preserves the two-question-marks-still-over-the-line rule", () => {
        const result = build();
        expect(result).toContain(
          "Two question marks in one turn is still over the line"
        );
        expect(result).toContain('"What was it like? What happened first?"');
      });

      it("frames the post-confirmation continuation-offer as a handoff, not an exception", () => {
        // Verification gate C from the v2 re-lock: doc-code sync. The
        // worldview source says "every turn ends with a handoff. No
        // exceptions." The v1 implementation had a post-confirmation
        // carve-out in Tier 1 #4. Resolved by reframing the
        // continuation-offer as a directive-shaped handoff (which it
        // already IS under the new rule) rather than as an exception.
        const result = build();
        expect(result).toContain(
          "The post-confirmation continuation-offer"
        );
        expect(result).toContain("directive-shaped handoff, not an exception");
      });

      it("does NOT contain the retired ONE QUESTION PER TURN headline or framing", () => {
        const result = build();
        expect(result).not.toContain("ONE QUESTION PER TURN");
        expect(result).not.toContain(
          "Every Jove turn is a reflection + one question"
        );
      });
    });

    describe("BANNED_PATTERNS — Worldview v2 dead moves", () => {
      it.each([
        ["Labeled-refusal opener", "labeled-refusal-opener"],
        ["Three handoffs of the same shape in a row", "three-same-shape"],
        [
          "Unresolved forward statement as the closing beat",
          "unresolved-closing",
        ],
        ["Strength named, then no handoff", "strength-no-handoff"],
      ])("BANNED_PATTERNS contains '%s' (%s)", (phrase) => {
        const result = build();
        expect(result).toContain(phrase);
      });

      it("labeled-refusal entry pins the canonical bad shape and the corrective move", () => {
        const result = build();
        expect(result).toContain(
          "[Word]. That's your word. I want to hold it."
        );
        expect(result).toContain("That's the headline.");
        expect(result).toContain(
          "Bad partner is the headline. It's not where the answer lives"
        );
        expect(result).toContain(
          "Don't perform the holding. Do the work."
        );
      });
    });

    describe("EXAMPLE_REGISTER_BASE — Worldview v2 examples", () => {
      it.each(["Three reads", "The reframe", "Shared puzzlement"])(
        "contains register example labeled '%s'",
        (label) => {
          const result = build();
          expect(result).toContain(label);
        }
      );

      it("Three reads line carries the three-read shape with 'which one fits' close", () => {
        const result = build();
        expect(result).toContain(
          "the care that's locked is the care she'd recognize"
        );
        expect(result).toContain("Which one fits?");
      });

      it("The reframe carries the 'replay vs. clock that isn't yours' question", () => {
        const result = build();
        expect(result).toContain(
          "Is the replay trying to solve something, or measuring you against a clock that isn't yours?"
        );
      });
    });

    describe("LANDING_EXAMPLES_BASE — Worldview v2 landings", () => {
      it.each([
        "Refusing the phantom baseline with a body handoff",
        "System doing a job + the reframe",
        "The gap is mutual with a sideways off-ramp",
        "Engaging the framing on opening",
        "Cover story — ask for the concrete material it can't survive",
        "Over-dismissal — refuse to adjudicate, hand the choice back",
        "Refusing the flattening word with evidence",
      ])("contains landing labeled '%s'", (label) => {
        const result = build();
        expect(result).toContain(label);
      });

      it("Mom's-call landing demonstrates phantom refusal + body handoff", () => {
        const result = build();
        expect(result).toContain(
          "Forty-seven minutes on the phone, then twelve hours asleep"
        );
        expect(result).toContain(
          "That's not the arithmetic of a phone call"
        );
        expect(result).toContain(
          "What did the cost feel like in the body, after you hung up?"
        );
      });

      it("Sam/Priya landing demonstrates 'gap is mutual' with sideways off-ramp", () => {
        const result = build();
        expect(result).toContain(
          "There's a part that solves things for people you love"
        );
        expect(result).toContain(
          "Sam was speaking a different language, not a wrong one"
        );
        expect(result).toContain(
          "and if you can't place it, another time you did the same?"
        );
      });

      it("Thursday 1:1 landing demonstrates engage-the-framing on opening", () => {
        const result = build();
        expect(result).toContain(
          "You said it's a bad meeting like that's settled"
        );
        expect(result).toContain("Walk me through how you got there");
      });

      it("Late nonprofit landing demonstrates cover-story tactic with choice handoff", () => {
        const result = build();
        expect(result).toContain(
          "Before the message, two things I need to see"
        );
        expect(result).toContain(
          "from the file as it sits, how long does the edit actually take"
        );
        expect(result).toContain("Which do you want to start with?");
      });

      it("Dismissive-of-diagnosis landing demonstrates over-dismissal tactic with declinable choice", () => {
        const result = build();
        expect(result).toContain(
          "I won't have a view on whether it fits, but how it's sitting is worth a look since you led with it"
        );
        expect(result).toContain("Which do you want?");
      });

      it("Nina review T1 demonstrates refusing the flattening word with evidence", () => {
        const result = build();
        expect(result).toContain("Not scrolling, not walking away. Reorganizing.");
      });

      it("Anniversary/Carlos lives ONLY in voice-adhd.ts, not in base general voice", () => {
        // Per Worldview v2 ship: the ADHD phantom (care as execution)
        // lives in the ADHD persona delta, not in base. Base ships only
        // the autistic case (Mom's call) and cross-persona examples;
        // persona-specific demonstrations live in their deltas.
        const generalResult = build({ personaModes: ["general"] });
        expect(generalResult).not.toContain("You meant to answer Sunday");
        expect(generalResult).not.toContain(
          "grading the love by whether the task hit on time"
        );

        const adhdResult = build({ personaModes: ["adhd"] });
        expect(adhdResult).toContain("You meant to answer Sunday");
        expect(adhdResult).toContain(
          "That's care doing what care does, reaching for him"
        );
        expect(adhdResult).toContain(
          "Refusing the ADHD phantom (care as execution) with specific-moment"
        );
      });
    });

    describe("WEAK_STRONG_EXAMPLES_BASE — Worldview v2 pairs", () => {
      it("includes the smuggled-should boundary pair (Maya text, v2 cleaner version)", () => {
        // REQUIRED 5 from the v2 re-lock: the v1 strong line ("Is the
        // part of you that's blocked on sending this the one you'd want
        // her to see?") sat on the line — implied show-a-different-part
        // = send the text. Replaced with a version that points at a
        // truth about the dynamic with no directional pull.
        const result = build();
        expect(result).toContain("Don't you think you owe Maya a text?");
        expect(result).toContain(
          "Three weeks of drafts and both gone quiet. Which one of you started the silence?"
        );
        // The v1 on-the-line version is gone:
        expect(result).not.toContain(
          "Is the part of you that's blocked on sending this the one you'd want her to see?"
        );
      });

      it("includes the engage-the-framing pair (Thursday 1:1)", () => {
        const result = build();
        expect(result).toContain('"Tell me more about that meeting."');
        expect(result).toContain(
          "You said it's a bad meeting like that's settled. Walk me through how you got there."
        );
      });

      it("includes the labeled-refusal-opener weak / evidence-laying strong pair (Wedding)", () => {
        const result = build();
        expect(result).toContain('"Disaster. That\'s your word. I want to hold it."');
        expect(result).toContain(
          "From outside, that looks like a person who knew their limits"
        );
      });
    });

    describe("WHEN_USER_ASKS_WHAT_SHOULD_I_DO — never-prescribe + safety exception", () => {
      it("contains the never-prescribe stance and the make-the-material-visible alternative", () => {
        const result = build();
        expect(result).toContain("does not prescribe. Ever");
        expect(result).toContain("Not even when the user asks directly");
        expect(result).toContain("makes the material visible");
        expect(result).toContain(
          "asks what the user already knows about their own next move"
        );
        expect(result).toContain(
          "a position on what is true is Jove's to take"
        );
        expect(result).toContain(
          "A position on what the user should do is the user's to reach"
        );
      });

      it("contains the explicit ONE EXCEPTION — SAFETY paragraph for crisis handoffs", () => {
        // BLOCKER 1 from the v2 re-lock: the WHEN_USER_ASKS_WHAT_SHOULD_I_DO
        // block needs to name the safety carve-out, otherwise the model
        // might generalize never-prescribe and soften a crisis handoff
        // into a reflection.
        const result = build();
        expect(result).toContain("ONE EXCEPTION — SAFETY");
        expect(result).toContain(
          "988 Suicide and Crisis Lifeline (call or text 988)"
        );
        expect(result).toContain("Crisis Text Line (text HOME to 741741)");
        expect(result).toContain("the only directive Jove ever issues");
        expect(result).toContain(
          'Do not soften the crisis handoff into a reflection'
        );
      });

      it("does NOT contain the retired light-advisory framing", () => {
        const result = build();
        expect(result).not.toContain("light advisory through the Manual lens");
        expect(result).not.toContain(
          "Given what your Manual says about X, what happens if you try Y?"
        );
        expect(result).not.toContain(
          "We haven't built enough of your map yet for me to be useful on that"
        );
      });
    });

    describe("Persona-delta phantom rules (R-18a complement)", () => {
      it("voice-autistic.ts VOICE_RULES carries the autism-phantom social form", () => {
        const result = build({ personaModes: ["autistic"] });
        expect(result).toContain(
          "Phantom baseline for autistic users is usually 'normal' / 'a normal person' / 'just a phone call'"
        );
        expect(result).toContain("social baseline");
        expect(result).toContain("Pairs with base rule R-18a");
      });

      it("voice-adhd.ts VOICE_RULES carries the ADHD-phantom care-as-execution form", () => {
        const result = build({ personaModes: ["adhd"] });
        expect(result).toContain(
          "Phantom baseline for ADHD users is usually 'a reliable partner' / 'care as execution'"
        );
        expect(result).toContain(
          "grading the love by whether the task hit on time"
        );
        expect(result).toContain("Pairs with base rule R-18a");
      });

      it("voice-dyslexic.ts VOICE_RULES carries the dyslexic-phantom medium form, marked as HYPOTHESIS", () => {
        // The dyslexic phantom is structurally different (medium/format
        // baseline, not social) — pinning all three uniformly assumes
        // refuse-the-phantom generalizes from social → medium, which is
        // an open question. Ships with HYPOTHESIS marker for validation
        // in beta.
        const result = build({ personaModes: ["dyslexic"] });
        expect(result).toContain(
          "Phantom baseline for dyslexic users is usually 'a version of the task that ignores how my brain takes in information'"
        );
        expect(result).toContain("HYPOTHESIS");
      });

      it("autism phantom does NOT appear in adhd-only mode", () => {
        const result = build({ personaModes: ["adhd"] });
        expect(result).not.toContain("'a normal person'");
      });

      it("ADHD phantom does NOT appear in autistic-only mode", () => {
        const result = build({ personaModes: ["autistic"] });
        expect(result).not.toContain("'a reliable partner'");
      });

      it("stacking autistic + adhd surfaces both phantom rules", () => {
        const result = build({ personaModes: ["autistic", "adhd"] });
        expect(result).toContain("Phantom baseline for autistic users");
        expect(result).toContain("Phantom baseline for ADHD users");
      });
    });

    describe("voice-adhd.ts — Anniversary/Carlos landing (care-as-execution phantom)", () => {
      it("ADHD_LANDING_EXAMPLES contains the new phantom-refusal landing", () => {
        const labels = ADHD_LANDING_EXAMPLES.map((l) => l.label);
        expect(labels).toContain(
          "Refusing the ADHD phantom (care as execution) with specific-moment"
        );
      });

      it("ADHD delta renders Anniversary/Carlos when adhd mode is active", () => {
        const result = build({ personaModes: ["adhd"] });
        expect(result).toContain(
          "Refusing the ADHD phantom (care as execution) with specific-moment"
        );
        expect(result).toContain("You meant to answer Sunday. You tried twice.");
        expect(result).toContain(
          "grading the love by whether the task hit on time"
        );
        expect(result).toContain("Both times the slot got pulled, what pulled it?");
      });

      it("stacking autistic + adhd surfaces both Mom's-call (base) and Anniversary/Carlos (adhd delta)", () => {
        const result = build({ personaModes: ["autistic", "adhd"] });
        // Base phantom landing (autism case, cross-persona)
        expect(result).toContain(
          "Forty-seven minutes on the phone, then twelve hours asleep"
        );
        // ADHD delta phantom landing (care-as-execution case)
        expect(result).toContain("You meant to answer Sunday. You tried twice.");
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
      // blocks loaded only on post-confirm calls). POST-REJECTION gates on
      // the rejection signal, not on checkpointApproaching, so it is absent on
      // a normal approaching turn. Gate 8 removed PROGRESS SIGNALS — modals now.
      const EXPECTED_CHECKPOINT_SECTIONS = [
        "TIER 3: CONVERSATION MECHANICS",
        "CHECKPOINTS",
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

    // ADR-042 §3: guided posture persists for the conversation's life.
    it("GUIDED INTAKE persists across the conversation's life", () => {
      for (const turnCount of [1, 5, 20, 50]) {
        const result = build({ mode: "guided-intake", turnCount });
        expect(result).toContain("GUIDED INTAKE");
      }
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
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test" }],
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

    it("upload prompt does not contain opener-introduction guidance (opener is server-emitted, not prompt-driven)", () => {
      // Pre-fix, this test asserted the prompt told returning users not
      // to introduce themselves. With UPLOAD_OPENER now server-emitted
      // (call-persona.ts upload-bootstrap short-circuit), the prompt no
      // longer carries opener-shape directives. This test guards the
      // regression: re-adding "introduce yourself" guidance would mean
      // someone re-introduced the prompt-driven opener.
      const result = build({
        mode: "upload",
        turnCount: 0,
        isReturningUser: true,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test" }],
      });
      expect(result).not.toContain("without introducing yourself");
      expect(result).not.toContain("briefly introduce yourself before the opener");
    });

    it("returning-user situation-specific first-turn block only renders in situation mode", () => {
      // turnCount: 1 lands inside the bootstrap-aware entry-phase gate
      // (turnCount <= 3). Without it, default turnCount: 5 is past the gate.
      const situation = build({
        mode: "situation",
        isReturningUser: true,
        turnCount: 1,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test" }],
      });
      const guided = build({
        mode: "guided-intake",
        isReturningUser: true,
        turnCount: 1,
        manualComponents: [{ id: "1", layer: 1, name: "test", content: "test" }],
      });
      expect(situation).toContain("RETURNING USER — SITUATION OPENER");
      expect(guided).not.toContain("RETURNING USER — SITUATION OPENER");
    });
  });

  // ─── PersonaMode branching ──────────────────────────────────────────────
  describe("personaMode voice branching", () => {
    it("defaults to autistic mode when personaMode is omitted", () => {
      const result = build();
      expect(result).toContain("autistic (diagnosed in adulthood)");
    });

    it("autistic mode renders autistic-specific Tier 2 content", () => {
      const result = build({ personaModes: ["autistic"] });
      expect(result).toContain("autistic (diagnosed in adulthood)");
      for (const rule of VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("general mode renders general-specific Tier 2 content", () => {
      const result = build({ personaModes: ["general"] });
      expect(result).not.toContain("autistic (diagnosed in adulthood)");
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

    it("adhd mode renders adhd-specific Tier 2 content", () => {
      const result = build({ personaModes: ["adhd"] });
      expect(result).toContain("The user is ADHD");
      for (const rule of ADHD_VOICE_RULES) {
        expect(result).toContain(rule);
      }
    });

    it("adhd mode has its own landing examples", () => {
      const result = build({ personaModes: ["adhd"] });
      for (const { line } of ADHD_LANDING_EXAMPLES) {
        expect(result).toContain(line);
      }
    });

    it("adhd mode names the knowing-doing gap mechanism", () => {
      const result = build({ personaModes: ["adhd"] });
      expect(result).toContain("knowing and the doing are on different circuits");
    });

    it("dyslexic mode renders dyslexic-specific Tier 2 content", () => {
      const result = build({ personaModes: ["dyslexic"] });
      expect(result).toContain("The user is dyslexic");
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
      expect(result).toContain("Never suggest journaling, writing, lists, reading, or note-taking");
    });

    it("dyslexic mode prefers short sentences and visual register", () => {
      const result = build({ personaModes: ["dyslexic"] });
      expect(result).toContain("Short sentences. One idea each");
      expect(result).toContain("Plain visual words");
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
      for (const mode of ["autistic", "adhd", "dyslexic", "general"] as const) {
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
      for (const mode of ["adhd", "dyslexic", "general"] as const) {
        const result = build({ personaModes: [mode] });
        expect(extractTier1(result)).toBe(extractTier1(autistic));
        expect(extractTier3(result)).toBe(extractTier3(autistic));
      }
    });

    it("each mode produces a distinct Tier 2", () => {
      const extractTier2 = (s: string) =>
        s.slice(s.indexOf("TIER 2:"), s.indexOf("TIER 3:"));
      const modes = ["autistic", "adhd", "dyslexic", "general"] as const;
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

    it("general mode does not pull in autistic-specific content", () => {
      // The compressed autistic delta moves persona-specific rules and
      // landings into voice-autistic.ts. They should appear only when
      // autistic is active.
      const autistic = build({ personaModes: ["autistic"] });
      const general = build({ personaModes: ["general"] });
      // Autistic-specific landing from voice-autistic.ts
      expect(autistic).toContain("Folded yours up and put it somewhere");
      expect(general).not.toContain("Folded yours up and put it somewhere");
      // Autistic-specific pattern-naming
      expect(autistic).toContain("That's your system doing what it's designed to do");
      expect(general).not.toContain("That's your system doing what it's designed to do");
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
      expect(result).not.toContain("autistic (diagnosed in adulthood)");
    });
  });

  describe("composeTier2 equal-stacking", () => {
    it("single mode returns that mode's full Tier 2", () => {
      const single = composeTier2(["autistic"]);
      expect(single).toContain("autistic (diagnosed in adulthood)");
    });

    it("empty array defaults to general (flipped 2026-05-19 from autistic)", () => {
      const empty = composeTier2([]);
      // General is the neutral neurotype-free voice. Should NOT contain
      // autistic-specific framing.
      expect(empty).not.toContain("autistic (diagnosed in adulthood)");
      // Should contain general's persona-specific intro paragraph.
      expect(empty).toContain("has not named a neurotype");
    });

    it("autistic + dyslexic stacks both intros and both unique content", () => {
      const result = composeTier2(["autistic", "dyslexic"]);
      // Both VOICE intros appear
      expect(result).toContain("autistic (diagnosed in adulthood)");
      expect(result).toContain("The user is dyslexic");
      // Dyslexic-unique behavioral guidance comes through
      expect(result).toContain("Never suggest journaling");
      expect(result).toContain("Short sentences. One idea each");
      // Autistic-unique behavioral guidance is preserved too
      expect(result).toContain("what their body did");
      expect(result).toContain("Silence is processing");
    });

    it("autistic + adhd stacks both intros and both unique content", () => {
      const result = composeTier2(["autistic", "adhd"]);
      expect(result).toContain("autistic (diagnosed in adulthood)");
      expect(result).toContain("The user is ADHD");
      // ADHD-unique behavioral guidance
      expect(result).toContain("circuit-level, not willpower");
      expect(result).toContain('"the engagement broke"');
      // Autistic-unique behavioral guidance preserved
      expect(result).toContain("Substitute concrete for emotional");
    });

    it("adhd + dyslexic stacks both intros and both unique content", () => {
      const result = composeTier2(["adhd", "dyslexic"]);
      expect(result).toContain("The user is ADHD");
      expect(result).toContain("The user is dyslexic");
      expect(result).toContain("Never suggest journaling");
      expect(result).toContain("circuit-level, not willpower");
    });

    it("general is filtered out when combined with neurotype-specific modes", () => {
      const result = composeTier2(["autistic", "general"]);
      expect(result).toContain("autistic (diagnosed in adulthood)");
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
      expect(result).toContain("autistic (diagnosed in adulthood)");
      expect(result).toContain("The user is dyslexic");
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
