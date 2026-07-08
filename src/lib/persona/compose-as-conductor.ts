import { anthropicFetch, extractResponseText, type SystemBlock } from "@/lib/anthropic";
import { COMPOSITION_MODEL } from "./config";
import { buildSystemPromptBlocks } from "./system-prompt";
import {
  buildPromptOptionsFromContext,
  type ConversationContext,
} from "./persona-pipeline";
import {
  buildEntrySpecBody,
  finalizeComposedEntry,
  COMPOSER_ENTRY_BAR,
  type ComposedEntry,
} from "./confirm-checkpoint";

// ─── Conductor-composed Manual entry (COMPOSER_MODE=conductor|compare) ───────
//
// The experiment: instead of a separate composer re-reading the transcript from
// outside (composeManualEntry), the CONDUCTOR itself writes the entry at pull
// time. Same voice that ran the conversation, same full live context (its exact
// cached system prompt + the whole session dialogue), plus a final instruction
// to write the entry now. Rationale: any handoff to an outside composer is a
// lossy re-derivation of an understanding the conductor already holds, and it's
// the likely source of the "entry reflects the opening label, not the settled
// material" failure. Gated by COMPOSER_MODE; the loser path + this file are
// deleted once the test picks a winner. See docs/state.md.

/** The final user turn that flips the conductor from talking to writing. Framed
 *  as a step-out-and-record move, then handed the shared entry spec so the
 *  output schema and quality bar are identical to the classic composer. */
const CONDUCTOR_ENTRY_INTRO = `The conversation above is complete — the person has recognized the pattern and wants to keep this reflection. Step out of the back-and-forth now and write it down as their Manual entry: the one pattern the two of you found, in their own words, drawn from everything worked out above. Don't deepen past what they recognized and don't add anything new — this is the record of what landed, not a fresh reach. Output ONLY the JSON described below, and nothing else.`;

/**
 * Compose a Manual entry AS the conductor. Rebuilds the conductor's exact
 * system prompt (voice + compressed Manual + session context, via the same
 * buildSystemPromptBlocks the chat route uses), replays the full session
 * conversation, and appends the write-the-entry instruction as the final user
 * turn. The JSON that comes back runs through the same finalizeComposedEntry
 * guards as the classic path. Returns null on unusable output (caller falls
 * back to a retryable error), matching composeManualEntry.
 */
export async function composeEntryAsConductor(
  ctx: ConversationContext,
  opts: { entryBarOverride?: string; distinctContexts?: number | null } = {}
): Promise<ComposedEntry | null> {
  const entryBar =
    opts.entryBarOverride && opts.entryBarOverride.trim()
      ? opts.entryBarOverride
      : COMPOSER_ENTRY_BAR;

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

  // Full session dialogue (NOT the classic path's 50-message slice — the whole
  // point is the conductor keeps its complete view), then the write instruction.
  const instruction = `${CONDUCTOR_ENTRY_INTRO}\n\n${buildEntrySpecBody(entryBar)}`;
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
    distinctContexts: opts.distinctContexts ?? null,
  });
}
