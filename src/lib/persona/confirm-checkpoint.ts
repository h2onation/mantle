import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME } from "./config";

// ─── Manual entry composition (Sonnet) ─────────────────────────────────────

interface ComposeManualEntryOptions {
  checkpointText: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  languageBank: { phrase: string; context: string; charge: string }[];
  layer: number;
  name: string | null;
  existingLayerContent?: { name: string | null; content: string }[];
}

/**
 * Calls Sonnet to compose a polished manual entry from a checkpoint reflection.
 * Always invoked server-side after the classifier flags a checkpoint.
 * Returns null on failure — caller should fall back gracefully.
 *
 * Also returns a compressed representation (summary + key_words) used to
 * shrink older entries when they're shown back to Jove in future sessions.
 * See prepareManualContext in system-prompt.ts for how these are consumed.
 */
export async function composeManualEntry(
  options: ComposeManualEntryOptions
): Promise<{
  content: string;
  name: string;
  changelog: string;
  summary: string;
  key_words: string[];
} | null> {
  const {
    checkpointText,
    conversationHistory,
    languageBank,
    layer,
    name,
    existingLayerContent,
  } = options;

  const chargedLanguage = languageBank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-10);

  const languageSection =
    chargedLanguage.length > 0
      ? `\nUSER'S OWN LANGUAGE (use these exact phrases where they carry weight):\n${chargedLanguage.map((e) => `"${e.phrase}" — re: ${e.context}`).join("\n")}\n`
      : "";

  const existingSection =
    existingLayerContent && existingLayerContent.length > 0
      ? `\nEXISTING ENTRIES ON THIS LAYER (your new entry must account for these):\n${existingLayerContent.map((c) => `[entry${c.name ? ` — "${c.name}"` : ""}]\n${c.content}`).join("\n\n")}\n\nIntegrate with or deepen existing entries. If new material contradicts them, name the tension.\n`
      : "";

  // Last 8 messages for context
  const recentHistory = conversationHistory.slice(-8);
  const historyText = recentHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const system = `You compose manual entries for a self-authored Manual. You receive a checkpoint reflection from a conversationalist called ${PERSONA_NAME} and the recent conversation. Your job is to distill this into a structured entry that reads as the user describing themselves to themselves.

THE ENTRY (field: "content")
Statement + passage as continuous prose. The statement is the first sentence: one line, first person, the truest description of the pattern. Hard cap around 20 words. Below that the rhythm carries it.

The passage follows immediately. 80+ words. It makes these moves in any order:
- Specificity in the first half. A concrete situation the user described, not an abstract claim.
- A reframe somewhere. The pattern is not what it looks like on the surface. Name what it actually is.
- Conditions or texture. When it fires hardest. What makes it different from the surface read. The user's own noticing.
- What changes now. If the conversation produced a clear stance ("I need people to X" or "I'm going to stop doing Y"), land it in the passage. If the user sees the pattern but hasn't landed on a stance, use their own words about where they are. If they said nothing about stance, omit. Do not fabricate a takeaway. This is not advice or a treatment plan. It flows naturally in the prose, not as a separate section.

VOICE RULES:
- First person. The user is the author. "I" not "You."
- No phrase a person wouldn't use about themselves out loud, to someone they trust, on a normal day. Read every sentence back and ask: would a person actually say this about themselves? "I turn away before the reach" — no. "I turn away before they can ask me" — yes. Plain spoken language. No nominalizations ("the reach," "the ask," "the pull"). Use verbs, not nouns pretending to be verbs.
- No session references ("I told ${PERSONA_NAME}," "we talked about," "in this conversation"). The entry reads the same six months from now.
- Use the user's exact charged phrases verbatim. Their sensory and system words ("buzzing," "too loud," "shut down," "went offline," "full," "tight," "crashed," "too close," "heavy") carry into the entry without translation. Do not upgrade their vocabulary.
- Grounded in their specific examples and moments. Not abstract.
- Somatic anchor REQUIRED in the passage. If the user described a body sensation or system state anywhere in the conversation, it must appear. The body is the evidence the mechanism is real.
- NOT A RECAP. Go one level deeper than what was said. The user should read the entry and think "I knew most of this but I couldn't see THAT part." Never summarize the conversation.
- No clinical framework names. No "schema," "attachment style," "dysregulation," "sensory processing disorder," "executive dysfunction," "rejection sensitive dysphoria," "avoidance," "trauma response." Describe the behavior and the body instead. "I shut down" not "I dissociate." "A second version of me switches on" not "I mask." "The room got too loud" not "sensory overwhelm."
- No time references. No "right now," "currently," "at this stage," "these days." The entry describes how I operate, period.
- BIND REQUIRED in the passage. What the pattern protects AND what it costs. Both.
- Do not use dashes or hyphens to join clauses. Use periods.
- Write like a field note, not literature. Flat, honest, direct. If a sentence sounds like it belongs in a poem or an essay, rewrite it plain.

HEADLINE (field: "name"):
4-8 words. Flatly descriptive. Says what the mechanism IS in behavioral or body terms. Plain subject-verb. No poetry, no imagery, no literary flair.
Good: "Voice Goes When Pressure Lands," "Second Version Switches On in Rooms," "Body Locks Before Being Asked"
Bad: "The Masking Loop," "Sensory Overwhelm Pattern," "Turned Away Before the Ask," clinical labels, metaphors, nominalizations ("the ask," "the reach," "the pull"), poetic titles like "Gaps Open and the Reach Fires." If the title sounds like a poem or uses a noun where a verb belongs, rewrite it plain.

COMPRESSED REPRESENTATION (for future reference):
- summary: one sentence, 20-40 words, third-person. Mechanism and bind briefly. User's charged words preserved. If a clear stance emerged, mention it.
- key_words: 3-6 short words or bigrams the user would use to recognize this entry. Include charged sensory/system words they used. Do not include clinical terms.

EXEMPLARS:

Wrong (passage): "When my manager checks in, my chest gets tight. My mind goes blank even though I know the answer."
Right (passage): "Half my system answers. The other half monitors how the answer will land. The monitoring half is louder, so it wins the resources. I hesitate. The hesitation looks like uncertainty, which invites more checking in, which fires the monitoring harder. I can't stop monitoring because the one time I didn't manage the impression, it cost me. But the monitoring itself is what makes me look unsure."

Respond with ONLY valid JSON. No markdown. No backticks.
{"content": "Statement + passage...", "name": "Headline", "changelog": "One sentence.", "summary": "Third-person summary.", "key_words": ["word1", "word2"]}`;

  const userContent = `Layer: ${layer} (${LAYER_NAMES[layer] || "Unknown"})
${name ? `Proposed name: "${name}"` : "No name proposed — choose one."}
${languageSection}${existingSection}
RECENT CONVERSATION:
${historyText}

${PERSONA_NAME.toUpperCase()}'S CHECKPOINT REFLECTION:
${checkpointText}

Compose the manual entry.`;

  const response = await anthropicFetch({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const cleaned = rawText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.content || typeof parsed.content !== "string") {
    return null;
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : deriveSummaryFallback(parsed.content);

  const keyWords = Array.isArray(parsed.key_words)
    ? parsed.key_words
        .filter((w: unknown): w is string => typeof w === "string")
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
    : [];

  return {
    content: parsed.content,
    name: parsed.name || name || "Untitled",
    changelog: parsed.changelog || `Created Layer ${layer} entry.`,
    summary,
    key_words: keyWords,
  };
}

/**
 * Fallback when the composition model forgets to emit a summary: take the
 * first sentence of content and trim it to roughly the expected length. Not
 * ideal — but better than a null summary that breaks the compressed block.
 */
function deriveSummaryFallback(content: string): string {
  const firstSentence = content.split(/(?<=[.!?])\s+/)[0] || content;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= 240) return trimmed;
  return trimmed.slice(0, 237).trimEnd() + "...";
}

interface ConfirmCheckpointOptions {
  messageId: string;
  conversationId: string;
  userId: string;
  /** User-edited content from the review overlay. Overrides composed_content
   *  when present so the user's words land in their Manual verbatim. */
  editedContent?: string | null;
  /** User-edited entry title from the review overlay. Overrides composed_name. */
  editedName?: string | null;
}

/**
 * Confirms a checkpoint. Idempotent and transactional — safe to call any
 * number of times with the same messageId.
 *
 * Loads the checkpoint message, extracts composed fields (with fallbacks),
 * then delegates all writes to the confirm_checkpoint_write Postgres
 * function, which in one transaction: inserts the manual_entries row,
 * flips the message status to "confirmed", and inserts the system message.
 *
 * Returns:
 *   success: true, componentId, wasAlreadyConfirmed: false — first-time confirm
 *   success: true, componentId, wasAlreadyConfirmed: true — already confirmed (idempotent)
 *   success: false, error — message missing, non-pending terminal state, or DB failure
 *
 * See supabase/migrations/20260417000003_confirm_idempotency.sql for the
 * RPC definition and docs/checkpoint-hardening-plan.md Track 2.
 */
export async function confirmCheckpoint({
  messageId,
  userId,
  editedContent,
  editedName,
}: ConfirmCheckpointOptions): Promise<{
  success: boolean;
  error?: string;
  componentId?: string;
  wasAlreadyConfirmed?: boolean;
}> {
  const admin = createAdminClient();

  try {
    // 1. Load the checkpoint message so we can pull composed content,
    //    name, summary, key_words from checkpoint_meta. The RPC handles
    //    its own status check + lock; we only read here.
    const { data: message, error: msgError } = await admin
      .from("messages")
      .select("content, checkpoint_meta")
      .eq("id", messageId)
      .single();

    if (msgError || !message?.checkpoint_meta) {
      return { success: false, error: "Checkpoint not found." };
    }

    const meta = message.checkpoint_meta as {
      layer: number;
      name: string | null;
      status: string;
      composed_content: string | null;
      composed_name: string | null;
      changelog: string | null;
      composed_summary: string | null;
      composed_key_words: string[] | null;
    };

    // 2. Compute final field values with fallbacks. This stays in TS
    //    rather than the SQL function — composition fallback logic is
    //    business logic, not a transaction concern.
    //    Strip crisis resources from fallback content (prevents
    //    contamination of manual entries when composition didn't run).
    const CRISIS_RESOURCES_PATTERN =
      "\n\nIf you're in crisis or need immediate support, please reach out to";
    let fallbackContent = message.content;
    if (!meta.composed_content && fallbackContent) {
      const crisisIdx = fallbackContent.indexOf(CRISIS_RESOURCES_PATTERN);
      if (crisisIdx !== -1) {
        fallbackContent = fallbackContent.substring(0, crisisIdx).trimEnd();
      }
    }
    // User-edited content from the review overlay takes precedence over
    // composed_content. The user is the author — their words land in the
    // Manual verbatim. When edits are present we also recompute the summary
    // fallback so the compressed view reflects the edited text, and clear
    // composed key_words (they were derived from the unedited content).
    const trimmedEditedContent = editedContent?.trim();
    const trimmedEditedName = editedName?.trim();
    const contentToWrite =
      trimmedEditedContent || meta.composed_content || fallbackContent;
    const nameToWrite =
      trimmedEditedName || meta.composed_name || meta.name || "Untitled";
    const summaryToWrite = trimmedEditedContent
      ? deriveSummaryFallback(trimmedEditedContent)
      : meta.composed_summary || deriveSummaryFallback(contentToWrite);
    const keyWordsToWrite = trimmedEditedContent
      ? null
      : Array.isArray(meta.composed_key_words) && meta.composed_key_words.length > 0
        ? meta.composed_key_words
        : null;

    // 3. Atomic write via Postgres function. FOR UPDATE locks the
    //    message row so concurrent calls serialize; partial unique
    //    index on (user_id, source_message_id) prevents duplicates.
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "confirm_checkpoint_write",
      {
        p_message_id: messageId,
        p_user_id: userId,
        p_layer: meta.layer,
        p_name: nameToWrite,
        p_content: contentToWrite,
        p_summary: summaryToWrite,
        p_key_words: keyWordsToWrite,
      }
    );

    if (rpcError) {
      // Error codes raised by the function map to user-facing messages.
      // The exception message bubbles through the Supabase client as
      // `error.message`. P0002 = checkpoint_not_found, P0001 = not_pending.
      const msg = rpcError.message || "";
      if (msg.includes("checkpoint_not_found")) {
        return { success: false, error: "Checkpoint not found." };
      }
      if (msg.includes("checkpoint_not_pending")) {
        return { success: false, error: "Checkpoint was rejected or refined." };
      }
      console.error("[confirmCheckpoint] RPC failed:", rpcError);
      return {
        success: false,
        error: "Failed to write entry to manual.",
      };
    }

    const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    if (!row?.entry_id) {
      console.error("[confirmCheckpoint] RPC returned no entry id:", rpcResult);
      return { success: false, error: "Failed to write entry to manual." };
    }

    return {
      success: true,
      componentId: row.entry_id as string,
      wasAlreadyConfirmed: Boolean(row.was_already_confirmed),
    };
  } catch (err) {
    console.error("[confirmCheckpoint] Error:", err);
    return { success: false, error: "Something went wrong." };
  }
}
