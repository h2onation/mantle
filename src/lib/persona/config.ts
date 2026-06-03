/**
 * User-facing display name for the AI persona.
 *
 * Change this one value to rename the AI everywhere in the UI.
 * Internal code uses "persona" as the technical identifier — this
 * constant is the public-facing label rendered to users.
 *
 * Currently "Jove". Renamed from "Sage" on 2026-04-14. Target: "mywalnut"
 * (the AI collapses into the platform identity — no separate persona name)
 * once all user-facing strings are wired through this constant.
 *
 * Rebrand checklist when changing this value:
 *   1. Update PERSONA_NAME and PERSONA_NAME_FORMAL below.
 *   2. Regenerate the vCard in public/persona-contact.vcf with the new FN field.
 *   3. Update the static brand copy in public/offline.html (not templated).
 *   4. Review legal copy in src/app/{terms,privacy,sms}/page.tsx
 *      — some references may need legal re-approval.
 *   5. Review user-facing brand copy in public/narrative/*.html (marketing pages).
 *   6. Re-render pitch-video assets (see pitch-video/README).
 *   7. Anthropic prompt cache will invalidate on next request.
 *   8. A few tests in system-prompt.test.ts and generate-summary.test.ts
 *      assert the literal current name — expected to fail and prompt
 *      conscious review; update their assertions to use PERSONA_NAME.
 */
export const PERSONA_NAME = "Jove";

/**
 * Capitalized form for SMS messages, vCard, legal pages.
 * Keep in sync with PERSONA_NAME.
 */
export const PERSONA_NAME_FORMAL = "Jove";

// Model IDs for the four LLM call sites in src/lib/persona/.
// Centralized here so a model bump touches one file. Verify dated suffixes
// via Anthropic docs before changing — see CLAUDE.md "Model IDs" rule.
export const PERSONA_MODEL = "claude-sonnet-4-6";
export const PERSONA_MAX_TOKENS = 2048;
export const EXTRACTION_MODEL = "claude-sonnet-4-6";
export const COMPOSITION_MODEL = "claude-opus-4-6";
export const SUMMARY_MODEL = "claude-haiku-4-5-20251001";
export const SIMULATION_MODEL = "claude-haiku-4-5-20251001";
// Phase 0 — shadow monitor. Reads alliance state (bond / task / scope /
// rupture / direction) per turn. Currently log-only — no behavior gates
// on this. See docs/reference/two-layer-engine-evaluation.md § 3 Phase 0.
//
// Set to Opus deliberately. Phase 0 is a ceiling test: we want to know
// whether rupture / withdrawal / sinking detection is POSSIBLE at the
// best model we can throw at the problem, not whether it works on a
// budget. Cost optimization (e.g., flipping back to Haiku) is for after
// Opus proves the signal is detectable. If Opus misses, Haiku won't
// catch it; if Opus catches it, we know how far Haiku has to climb.
export const MONITOR_MODEL = "claude-opus-4-7";

// Single source of truth for both the system-message text persisted after a
// checkpoint action and the natural-language reply mapSystemMessages() in
// call-persona.ts uses to render that system message as a synthetic user turn
// for Jove. Lives here (not in persona-pipeline.ts) to avoid a circular import
// between persona-pipeline.ts and call-persona.ts.
export const CHECKPOINT_ACTIONS = {
  // LEGACY — DO NOT DELETE. Current code no longer writes a confirmed action
  // row (the confirm path persists nothing; only rejected / refined / deferred
  // insert a system row). But pre-`2350176` conversations DO contain
  // "[User confirmed the checkpoint]" rows in prod — 19 confirmed on 2026-06-03
  // — and mapSystemMessages() needs this entry to render them as a turn on
  // reload. Re-check before ever removing it:
  //   select count(*) from messages where role='system'
  //     and content='[User confirmed the checkpoint]';   -- must be 0 to delete
  confirmed: {
    systemMessage: "[User confirmed the checkpoint]",
    naturalReply: "I confirmed that checkpoint. That resonates.",
  },
  rejected: {
    systemMessage: "[User rejected the checkpoint]",
    naturalReply: "That checkpoint didn't land right for me.",
  },
  refined: {
    systemMessage: "[User wants to refine the checkpoint]",
    naturalReply: "That's close but not quite right.",
  },
  // Refinement-ceiling "Let it go" path. DB status maps to "rejected"
  // (same downstream behavior — entry is closed, nothing written to
  // manual_entries) but Jove sees this distinct message so the
  // POST-REJECTION fixed line does not fire.
  deferred: {
    systemMessage: "[User let the checkpoint go]",
    naturalReply: "I'll let that one go for now. We can come back to it.",
  },
} as const;

export type CheckpointAction = keyof typeof CHECKPOINT_ACTIONS;

// Conversation mode: which entry path the user took into a session. Centralized
// here so the runtime tuple (used for input validation in /api/chat) and the
// derived type (used in BuildPromptOptions and downstream consumers) stay in
// sync — previously declared as four near-identical inline literals across
// system-prompt.ts, chat/route.ts, prompt-architecture/route.ts, and
// prompt-sections.ts.
export const CONVERSATION_MODES = ["situation", "guided-intake", "upload"] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];
