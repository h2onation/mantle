import { anthropicFetch, extractResponseText, type SystemBlock } from "@/lib/anthropic";
import { COMPOSITION_MODEL } from "./config";
import { buildSystemPromptBlocks } from "./system-prompt";
import {
  buildPromptOptionsFromContext,
  type ConversationContext,
} from "./persona-pipeline";
import {
  buildEntryMachineContract,
  finalizeComposedEntry,
  type ComposedEntry,
} from "./confirm-checkpoint";

// ─── Conductor-composed Manual entry (composer mode conductor|compare) ───────
//
// The experiment: instead of a separate composer re-reading the transcript from
// outside (composeManualEntry), the CONDUCTOR itself writes the entry at pull
// time. Same voice that ran the conversation, same full live context (its exact
// cached system prompt + the whole session dialogue), plus a final instruction
// to write the entry now. Rationale: any handoff to an outside composer is a
// lossy re-derivation of an understanding the conductor already holds, and it's
// the likely source of the "entry reflects the opening label, not the settled
// material" failure. Gated by the composer-mode toggle; the loser path + this
// file are deleted once the test picks a winner. See docs/state.md.
//
// The WRITING STANDARD is not sent here: it lives in the conductor prompt
// itself ("## Writing the reflection", conductor-prompt.ts — guarded as a
// required fragment). This call sends only the mode-flip line + the machine
// contract (locked rules, section/tags, JSON schema), so the model reads the
// standard exactly once, from its own prompt.

/** The final user turn that flips the conductor from talking to writing. The
 *  how-to lives in the conductor prompt's "Writing the reflection" section;
 *  this line only flips the mode and pins the output format. */
const CONDUCTOR_ENTRY_INTRO = `The person pulled the reflection on their screen — write it now, following "Writing the reflection" above. Output ONLY the JSON described below, and nothing else.`;

/**
 * Compose a Manual entry AS the conductor. Rebuilds the conductor's exact
 * system prompt (voice + compressed Manual + session context, via the same
 * buildSystemPromptBlocks the chat route uses — including any live admin
 * override, which carries the "Writing the reflection" standard), replays the
 * full session conversation, and appends the mode-flip + machine contract as
 * the final user turn. The JSON that comes back runs through the same
 * finalizeComposedEntry guards as the composer path. Returns null on unusable
 * output (caller falls back to a retryable error), matching composeManualEntry.
 */
export async function composeEntryAsConductor(
  ctx: ConversationContext,
  opts: { distinctContexts?: number | null } = {}
): Promise<ComposedEntry | null> {
  // The conductor's real system prompt — identical to what it ran on during the
  // conversation, cache marker included, so this call rides the same warm cache.
  const blocks = buildSystemPromptBlocks(buildPromptOptionsFromContext(ctx));
  const systemBlocks: SystemBlock[] = (
    [
      { type: "text", text: blocks.tier1 },
      {
        type: "text",
        text: blocks.staticContext,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: blocks.dynamic },
    ] as SystemBlock[]
  ).filter((b) => b.text.trim().length > 0);

  // Full session dialogue (NOT the composer path's 50-message slice — the whole
  // point is the conductor keeps its complete view), then the write instruction.
  const instruction = `${CONDUCTOR_ENTRY_INTRO}\n\n${buildEntryMachineContract()}`;
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...ctx.messages,
    { role: "user", content: instruction },
  ];

  const response = await anthropicFetch({
    model: COMPOSITION_MODEL,
    max_tokens: 2048,
    system: systemBlocks,
    messages,
  });

  return finalizeComposedEntry(extractResponseText(response), {
    conversationHistory: ctx.messages,
    // The entry homes on this conversation's module.
    section: ctx.mode,
    distinctContexts: opts.distinctContexts ?? null,
  });
}
