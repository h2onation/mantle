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
// The CONVERSATIONAL turn — the one the user actually feels. Bumped from
// Sonnet 4.6 to Opus 4.7 (the strongest model in this app)
// 2026-06-04 to test how much of the "sharper, more synthetic" feel of a
// claude.ai-style conversation is model tier vs craft. Opus on EVERY turn is
// a real cost/latency increase — reversible to claude-sonnet-4-6, and can be
// gated to complex turns later if cost demands. See the conversation-delta
// analysis. Extraction stays on Sonnet (background, cost-sensitive).
export const PERSONA_MODEL = "claude-opus-4-7";
// 4x the old 2048 cap so a synthesis turn (land evidence -> name the pattern
// -> hand back a test) can complete without truncating the evidence trail at
// the moment it matters. Pairs with the relaxed "one or two beats" voice rule
// (synthesis turns only). Dial down later if replies run long.
export const PERSONA_MAX_TOKENS = 8192;
export const EXTRACTION_MODEL = "claude-sonnet-4-6";
// Reconciled to match PERSONA_MODEL (was claude-opus-4-6 — unintentional version
// drift). The composed Manual entry is the product's core artifact; it runs on
// the same Opus tier as the conversational turn. Fires only on checkpoint turns,
// so the cost delta vs 4-6 is small.
export const COMPOSITION_MODEL = "claude-opus-4-7";
export const SUMMARY_MODEL = "claude-haiku-4-5-20251001";
export const SIMULATION_MODEL = "claude-haiku-4-5-20251001";

// Single source of truth for both the system-message text persisted after a
// checkpoint action and the natural-language reply mapSystemMessages() in
// call-persona.ts uses to render that system message as a synthetic user turn
// for Jove. Lives here (not in persona-pipeline.ts) to avoid a circular import
// between persona-pipeline.ts and call-persona.ts.
export const CHECKPOINT_ACTIONS = {
  // LOAD-BEARING on every confirm, not legacy. The confirm RPC
  // (confirm_checkpoint_write, migration 20260417000003:117-118) inserts a
  // "[User confirmed the checkpoint]" system row on EVERY confirm, and
  // mapSystemMessages() replays this naturalReply as a synthetic user turn on
  // the next turn and on every reload. (An earlier comment here claimed the
  // confirm path persists nothing — that was wrong; verified 2026-06-09.)
  //
  // The reply is deliberately flat and affect-free: a tap is an ACTION, not a
  // felt response. The previous text ("That resonates.") fabricated recognition
  // the user never expressed, so Jove treated every confirm — including
  // tap-to-dismiss — as a landed pattern. Voice-rebuild Phase 1; see
  // docs/voice-rebuild-proposal.md §6.
  confirmed: {
    systemMessage: "[User confirmed the checkpoint]",
    naturalReply: "I saved that to my Manual.",
  },
  rejected: {
    systemMessage: "[User rejected the checkpoint]",
    naturalReply: "That checkpoint didn't land right for me.",
  },
  refined: {
    systemMessage: "[User wants to refine the checkpoint]",
    naturalReply: "That's close but not quite right.",
  },
} as const;

export type CheckpointAction = keyof typeof CHECKPOINT_ACTIONS;

// The live-voice switch (LIVE_VOICE_VARIANT / VoiceVariant) was deleted
// 2026-07-06: the conductor (conductor-prompt.ts) is the sole 1:1 voice — it
// was promoted for all users 2026-07-02 and the rebuilt/legacy rollback
// worlds were retired, so there is nothing left to switch between.

// Conversation mode: which entry path the user took into a session. Centralized
// here so the runtime tuple (used for input validation in /api/chat) and the
// derived type (used in BuildPromptOptions and downstream consumers) stay in
// sync — previously declared as four near-identical inline literals across
// system-prompt.ts, chat/route.ts, prompt-architecture/route.ts, and
// prompt-sections.ts.
export const CONVERSATION_MODES = ["situation", "guided-intake", "upload"] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];
