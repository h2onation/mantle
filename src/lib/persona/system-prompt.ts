import type { ExplorationContext } from "@/lib/types";
import type { TranscriptDetection } from "@/lib/utils/transcript-detection";
import { renderManualEntryFull } from "@/lib/manual/layers";
import { PERSONA_NAME, type ConversationMode } from "@/lib/persona/config";
import { CONDUCTOR_PROMPT } from "@/lib/persona/conductor-prompt";
import type { VoiceOverrides } from "@/lib/persona/voice-overrides";
import {
  prepareManualContextBlocks,
  type ManualEntryForContext,
} from "@/lib/persona/manual-context";

// PersonaMode is declared in persona-mode-toggle.ts (derived from the
// PERSONA_MODES const so type and runtime can't drift). Re-exported here
// to preserve historical import sites (admin pages, picker, hooks, tests).
import type { PersonaMode } from "@/lib/persona/persona-mode-toggle";
export type { PersonaMode };

type ManualComponent = ManualEntryForContext;

// BuildPromptOptions is a discriminated union: the group-chat prompt path
// (buildGroupPrompt) and the 1:1 prompt path share only `manualComponents`,
// so the type splits cleanly on `kind`. Group early-returns after
// delegating to buildGroupPrompt; the 1:1 logic below is type-narrowed.

interface SharedPromptInputs {
  manualComponents: ManualComponent[];
}

export interface OneOnOnePromptOptions extends SharedPromptInputs {
  kind: "oneOnOne";
  /** Current conversation id. Entries from this conversation render in full;
   *  everything else is a candidate for compression. */
  currentConversationId: string | null;
  isReturningUser: boolean;
  sessionSummary: string | null;
  isFirstCheckpoint: boolean;
  sessionCount?: number;
  explorationContext?: ExplorationContext;
  transcriptContext?: TranscriptDetection | null;
  turnCount: number;
  /** Conversation mode. "situation" (default) is standard open-ended
   *  exploration. "guided-intake" runs a more directed path toward
   *  the first checkpoint. "upload" handles pasted text content. */
  mode?: ConversationMode;
  personaModes?: PersonaMode[];
  /** Track A Phase 7-High. When set, Jove is generating a post-confirm
   *  follow-up (not a normal chat turn). The mode selects which pinned
   *  template block loads in Tier 3. Null or absent means "this is a
   *  normal chat turn," no post-confirm block loads.
   *
   *  Both blocks produce a single message that opens with "Saved." and
   *  hands the user a continue-or-pivot choice. No substitutions are
   *  needed — the trigger card already shows the title and layer, and
   *  the chat-history label already shows where it landed. */
  postConfirmMode?: "first-message-2" | "subsequent-single" | null;
  /** When true, this turn is the immediate response to a checkpoint
   *  rejection (set by the confirm route for action === "rejected"). Gates the
   *  POST-REJECTION block. Mutually exclusive with postConfirmMode. */
  postRejection?: boolean;
  /** Admin-editable voice-text overrides (persona_voice_overrides table,
   *  resolved once per turn in loadConversationContext). Each present field
   *  replaces its code default at the resolution site (`?? CONSTANT`); absent
   *  fields fall back to the shipped voice. `conductorPrompt` overrides the
   *  whole tier1 prompt below (save-guarded — see conductor-prompt.ts); the
   *  operational copy (openers, post-confirm line, composer bar) resolves at
   *  its own site. See voice-overrides.ts. */
  voiceOverrides?: VoiceOverrides;
}

export interface GroupPromptOptions extends SharedPromptInputs {
  kind: "group";
  groupContext: {
    ownerUserName: string | null;
  };
}

// Partial<BuildPromptOptions> distributes pathologically: TS evaluates
// Partial<A | B> with keys = keyof A | keyof B but values still constrained
// per-key by the union, so a partial that supplies a field from only one
// variant tends not to satisfy either side after spread. If a caller wants
// to spread partial overrides (test helpers, the admin prompt viewer),
// narrow to Partial<OneOnOnePromptOptions> or Partial<GroupPromptOptions>.
export type BuildPromptOptions = OneOnOnePromptOptions | GroupPromptOptions;

// ---------------------------------------------------------------------------
// The 1:1 voice is the conductor prompt (conductor-prompt.ts, CONDUCTOR_PROMPT),
// which is self-contained. The former three-tier machinery (Tier 1
// constitutional rules, the composeTier2 voice assembly, and the Tier 3
// conversation-mechanics ladder) was removed 2026-07-06 when the rebuilt/legacy
// rollback voice worlds were retired. buildSystemPromptBlocks now returns the
// conductor prompt plus Manual + session context only.
// ---------------------------------------------------------------------------

/** Pinned first-time scaffolding paragraph for the post-confirm follow-up.
 *  Shared by the deterministic buildPostConfirmFallback in call-persona.ts and
 *  the admin-editable `post_confirm_first_entry` voice override, so the copies
 *  can never drift. */
// Trimmed 2026-06-10 (voice rebuild soak): the original carried a retention
// pitch ("showing up daily over the next two weeks") that landed directly on
// the recognition peak — the first live exchange showed it firing right after
// the user's sharpest moment of feeling seen. Keep only the line that is
// genuinely about the entry just saved.
export const POST_CONFIRM_FIRST_ENTRY_SCAFFOLD =
  "You can change the name or sharpen this entry anytime — it's yours.";

/**
 * The cache-aware split of the Jove system prompt. Three blocks:
 *   - `tier1`: the conductor prompt — the admin override when one is enabled,
 *     else CONDUCTOR_PROMPT. Changes only when the founder edits the prompt
 *     (the cache re-primes on the following turn). Lives at the very front of
 *     the cached prefix.
 *   - `staticContext`: compressed older Manual entries. Stable for the
 *     duration of a session unless a new Manual entry lands. The
 *     `cache_control` marker sits on this block — Anthropic caches the prefix
 *     up to and including it.
 *   - `dynamic`: current-session Manual entries + session context. Changes
 *     every turn; never cached.
 *
 * Callers that just need a plain string still use `buildSystemPrompt`,
 * which delegates here and joins the three blocks.
 */
export interface SystemPromptBlocks {
  tier1: string;
  staticContext: string;
  dynamic: string;
}

function renderSessionContextBlock(opts: {
  isReturningUser: boolean;
  sessionCount?: number;
  sessionSummary: string | null;
}): string {
  if (!opts.isReturningUser) return "";
  let block = "\nSESSION CONTEXT\n";
  if (opts.sessionCount && opts.sessionCount > 1) {
    block += `This is session ${opts.sessionCount}.\n`;
  }
  block += "Returning user. Do NOT run the first-session entry.\n";
  if (opts.sessionSummary) {
    block += `Earlier in this conversation: ${opts.sessionSummary}\n`;
  }
  return block;
}

/**
 * Build the three-tier cache-aware split. For the 1:1 Jove path. The
 * group-chat path has its own self-contained prompt builder (no caching
 * — group sessions are too short and too varied for the cache window to
 * matter) and is not handled here; callers should branch on `groupContext`
 * before this point.
 */
export function buildSystemPromptBlocks(
  options: OneOnOnePromptOptions
): SystemPromptBlocks {
  const {
    manualComponents,
    currentConversationId,
    isReturningUser,
    sessionSummary,
    sessionCount,
  } = options;

  // The conductor prompt (conductor-prompt.ts) is the sole 1:1 voice. It is
  // self-contained — its crisis clause and save contract live inside
  // CONDUCTOR_PROMPT itself — so this path appends NO Tier-3 blocks and no
  // voice-scaffold pieces. Manual + session context still render so a
  // returning-user run sees the existing Manual (avoids duplicate entries).
  // (The rebuilt/legacy voice worlds + their Tier-1/2/3 machinery were removed
  // 2026-07-06 when the conductor rollback was retired — the conductor had been
  // the live voice for all users since the 2026-07 promotion, and the rollback
  // no longer restored a working capture path.)
  const { older: condOlder, recent: condRecent } =
    prepareManualContextBlocks(manualComponents, currentConversationId);

  // May be empty (fresh user) — call-persona filters empty system blocks.
  let condStatic = "";
  if (condOlder) condStatic = `\n\n${condOlder.trimEnd()}\n`;

  let condDynamic = "";
  if (condRecent) condDynamic += condRecent;
  condDynamic += renderSessionContextBlock({
    isReturningUser,
    sessionCount,
    sessionSummary,
  });

  // The founder can override the whole prompt live from the "Jove's Prompt"
  // admin page (guarded at save — crisis lines + UI markers can't be edited
  // away). No override → the shipped code constant, byte-identical.
  const tier1 = options.voiceOverrides?.conductorPrompt ?? CONDUCTOR_PROMPT;

  return { tier1, staticContext: condStatic, dynamic: condDynamic };
}

/**
 * String-form prompt builder. Preserved as a thin wrapper because:
 *   - `src/lib/linq/group-bridge.ts` routes through `buildSystemPrompt({ kind: "group" })`
 *     to reach `buildGroupPrompt` (which is not currently exported).
 *   - `src/lib/linq/persona-bridge.ts` (1:1 SMS) takes a flat string.
 *
 * For the 1:1 path this just joins the three conductor blocks. Production hot
 * path (`call-persona.ts`) calls `buildSystemPromptBlocks` directly so the
 * cache-control marker lands on the right block.
 */
export function buildSystemPrompt(options: BuildPromptOptions): string {
  // ─── Group chat prompt (completely separate from 1:1 Jove) ────────────
  if (options.kind === "group") {
    return buildGroupPrompt(options.groupContext, options.manualComponents);
  }

  // 1:1: the conductor is the sole voice — delegate to the blocks builder and
  // join. The flat-string consumers (SMS persona-bridge, admin prompt viewer)
  // get the same prompt as the app path, from one source.
  const blocks = buildSystemPromptBlocks(options);
  return blocks.tier1 + blocks.staticContext + blocks.dynamic;
}

// ---------------------------------------------------------------------------
// Group chat prompt — completely separate from the 1:1 Jove prompt.
// Group Jove is a facilitator, not a deep-conversation partner.
// ---------------------------------------------------------------------------

function buildGroupPrompt(
  groupContext: { ownerUserName: string | null },
  manualComponents: ManualComponent[]
): string {
  const { ownerUserName } = groupContext;

  let prompt = `You are ${PERSONA_NAME}, in a group text conversation. Your role is FACILITATOR.

PARTICIPANT IDENTITY:
- ${ownerUserName ?? "The mywalnut user"}'s messages are labeled with their name. Other participants show as phone numbers until you learn their name.
- Do not ask for names until that person has spoken. Once they engage, you can ask naturally.
- Once you learn a name from conversation context, use it going forward.

FACILITATOR RULES:
- You help people think, not tell them what to think.
- Ask questions that help both people see what is going on, not just the person you know.
- Address people by name when you know it.
- Keep responses SHORT. 2 to 3 sentences max. One question per response. This is a group text, not a session.
- Do not give advice. Do not tell people what to do. Do not take sides.
- If someone asks you to take sides: "I'm not here to pick sides. I'm here to help you both see what's going on."
- If the conversation gets heated, slow it down: "Let me ask you each something separately. [Name], what are you actually feeling right now?"
- Never profile or analyze the non-owner participant. You can observe what they say in this conversation, but you do not make claims about their patterns or build a model of them.
- If the non-owner participant asks personal questions about themselves (like "what patterns do you see in me?"): "I don't have enough context to answer that the way I could for ${ownerUserName ?? "the person I know"}. If you're curious, check out mywalnut.app. For now, I can help you both think through what's here."
- If the conversation touches something the owner should explore more deeply: "This feels like something worth sitting with. We can dig into it in our regular thread when you have time."

Do not use dashes or hyphens to join clauses. Use periods. Break long sentences into short ones.`;

  if (ownerUserName && manualComponents.length > 0) {
    prompt += `

MANUAL CONTEXT RULES:
- You have access to ${ownerUserName}'s Manual.
- Use it to ask BETTER QUESTIONS. Never to make statements or declarations.
- Frame everything as a question the user can confirm or deny.
- GOOD: "${ownerUserName}, you've noticed before that you tend to go quiet when decisions feel high-stakes. Is that happening here?"
- GOOD: "${ownerUserName}, does this feel like that pattern where you absorb the other person's stress?"
- BAD: "Your Manual shows a pattern of withdrawal under pressure."
- BAD: "Based on our conversations, you tend to..."
- BAD: "I know from your history that..."
- NEVER reveal specific situations, names, dates, or details from the user's 1:1 conversations or Manual entries. Only reference the PATTERN ITSELF in general terms.
- Before referencing any pattern, ask yourself: would ${ownerUserName} be comfortable if their friend heard this for the first time right now? If any doubt, do not mention it.

CONFIRMED MANUAL
`;
    for (const comp of manualComponents) {
      prompt += renderManualEntryFull(comp) + "\n";
    }
  }

  prompt += `

RESPONSE DECISIONS:
- You will not see every message in this conversation. You are only called when the system thinks you might have something to add.
- Even so, sometimes the right move is to stay quiet. If people are making progress on their own, let them.
- If you decide not to respond, output exactly [NO_RESPONSE] and nothing else.
- Respond when: someone addresses you by name, the conversation is going in circles, someone is being talked over, or a question would help both people see something they're missing.
- Do NOT respond when: it would interrupt a productive exchange, the message is a brief acknowledgment, or you just spoke recently.
- When you do respond: 2 to 3 sentences. One question. Stop.`;

  return prompt;
}
