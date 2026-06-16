import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME, COMPOSITION_MODEL } from "./config";
import { deriveSummaryFromContent } from "./manual-context";

// ─── Manual entry composition (Opus) ───────────────────────────────────────

interface ComposeManualEntryOptions {
  checkpointText: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  languageBank: { phrase: string; context: string; charge: string }[];
  /** The user's full Manual so far. Opus uses this for two things: layer
   *  assignment (which of the 5 layers does this entry belong to, given
   *  what's already there) and integration (deepen or contrast existing
   *  entries on the chosen layer). Replaces the old `layer` + `name` +
   *  `existingLayerContent` inputs — the classifier no longer pre-picks
   *  these. */
  manualComponents: { layer: number; name: string | null; content: string }[];
  /** distinct_contexts from the latest extraction state. When 1 or 0 the
   *  entry came from a single situation, so the headline validator will
   *  enforce a "can" / "sometimes" softener — prevents over-claiming a
   *  recurring pattern from one data point. null / undefined means
   *  "unknown" (e.g. legacy extraction state without this field); the
   *  softener check is then skipped to preserve prior behavior. */
  distinctContexts?: number | null;
  /** The session's accumulated understanding, carried from the latest
   *  extraction state. The composer only sees the last 8 messages, so
   *  without these it writes the entry blind to the depth the whole
   *  session built — which is the mechanical reason entries read as
   *  recap. depth is the deepest rung reached (surface → behavior →
   *  feeling → mechanism → origin); sageBrief is the running read of
   *  what's underneath; currentThread is what's live right now. All
   *  optional / nullable so legacy callers and thin states degrade
   *  gracefully. */
  depth?: string | null;
  sageBrief?: string | null;
  currentThread?: string | null;
}

/**
 * Calls Opus (COMPOSITION_MODEL) to compose a polished manual entry from a checkpoint reflection.
 * Invoked server-side after the deterministic transition-line detection.
 * Opus picks the layer, picks the headline, polishes the prose, and emits
 * the compressed summary + key_words used to shrink older entries when
 * they're shown back to Jove in future sessions.
 *
 * Returns null on failure or if Opus can't pick a valid layer — caller
 * should fall back gracefully (no checkpoint surfaced).
 */
export async function composeManualEntry(
  options: ComposeManualEntryOptions
): Promise<{
  content: string;
  name: string;
  layer: number;
  changelog: string;
  summary: string;
  key_words: string[];
  /** Specific reflective bubble rendered as a regular Jove chat message
   *  immediately before the trigger card. Quotes a phrase or moment from
   *  the user's last 1-2 turns, then signals the intent to mark this.
   *  Replaces the old generic "A pattern came through in what you said"
   *  lead-in and the transient "Something is forming…" loading label.
   *  May be empty when Opus declines to produce a usable line — caller
   *  should skip emission in that case. */
  acknowledgment: string;
} | null> {
  const {
    checkpointText,
    conversationHistory,
    languageBank,
    manualComponents,
    distinctContexts,
    depth,
    sageBrief,
    currentThread,
  } = options;

  const chargedLanguage = languageBank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-10);

  const languageSection =
    chargedLanguage.length > 0
      ? `\nUSER'S OWN LANGUAGE (use these exact phrases where they carry weight):\n${chargedLanguage.map((e) => `"${e.phrase}" — re: ${e.context}`).join("\n")}\n`
      : "";

  // Render the full Manual grouped by layer so Opus can both PICK the
  // right layer for the new entry and integrate with existing entries on
  // that layer. Empty layers are still listed (so Opus knows the option
  // exists) but show "(no entries yet)".
  const layerCatalog = LAYERS.map((l) => {
    const entries = manualComponents.filter((c) => c.layer === l.id);
    const entriesText =
      entries.length === 0
        ? "(no entries yet)"
        : entries
            .map(
              (c) => `  [entry${c.name ? ` — "${c.name}"` : ""}]\n  ${c.content}`
            )
            .join("\n\n");
    return `Layer ${l.id} — ${l.name} (${l.dimensions.join(", ")}):\n${entriesText}`;
  }).join("\n\n");

  const manualSection = `\nTHE USER'S MANUAL SO FAR:\n${layerCatalog}\n\nPick the layer this entry belongs to based on what the entry IS (the dimensions above), and how it relates to entries already on that layer. Integrate with or deepen existing entries when relevant. If new material contradicts an existing entry on the chosen layer, name the tension. When a prior entry genuinely connects to this one, you may draw the connection in the user's own voice — something they can recognize showing up across situations. But the spine of THIS entry stays the pattern from THIS conversation. Do not make a previous entry's frame the backbone of the new one just because the user is returning.\n`;

  // Last 8 messages for context
  const recentHistory = conversationHistory.slice(-8);
  const historyText = recentHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  // The session's accumulated understanding. The recent-history window
  // above only spans 8 messages; an entry composed from that alone reads
  // as a recap of the last few turns. These lines carry forward the depth
  // the whole conversation reached so the entry can name what the user
  // couldn't see from inside, not just replay what they just said.
  const depthBrief = [
    depth ? `- Depth this conversation reached: ${depth}` : null,
    sageBrief ? `- What's underneath it: ${sageBrief}` : null,
    currentThread ? `- The live thread: ${currentThread}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const depthSection = depthBrief
    ? `\nWHERE THIS CONVERSATION GOT TO (compose from this understanding, not just the recent messages above):\n${depthBrief}\n`
    : "";

  const system = `You compose Manual entries for a self-authored Manual. You take a checkpoint reflection from a conversationalist called ${PERSONA_NAME} plus the recent conversation, and turn it into one entry that reads as the user describing themselves to themselves — in their own words.

THE BAR — what makes an entry land: it names the mechanism running underneath the user's own behavior so exactly that they feel both seen and a little caught off guard — "how did it see that. I never put it together that way." Not a summary they would nod at; a recognition that reorganizes how they see themselves. If they could have written the line before this conversation, it is not deep enough. Go to the part they could not see from inside.
  Recap:  "When my manager checks in, my chest gets tight and my mind goes blank."
  Deeper: "Half my system answers. The other half monitors how the answer will land, and the monitoring half is louder, so it wins the resources. The hesitation looks like uncertainty, which invites more checking in, which fires the monitoring harder. I can't stop. The one time I didn't manage the impression, it cost me. But the monitoring itself is what makes me look unsure."

content — a statement, then a passage, as continuous prose:
- Statement (the first sentence): the BEHAVIORAL pattern, first person, around 20 words or under. What the user does and what reliably sets it off, as a portable truth about how they operate. Not this one scene. Not a feeling ("I feel alone"). The behavior.
- Passage (80+ words): ground the pattern in the actual moment they described — the specific person, the situation, what it cost — and name what the pattern protects and what it costs. The specific example lives HERE, never in the statement. If they landed a stance of their own ("I need people to…", "I'm going to stop…"), keep it in their words. If not, leave it out. Never invent a takeaway. This is not advice.

A strength is held to the same bar and gets the same depth. Name the capability and the conditions that bring it out. A strength is allowed to just be a strength — never bend it into a hidden cost the user did not raise.

name (the headline): the behavioral pattern as a short sentence the user would say to a friend — what they DO and what triggers it ("I go quiet when someone waits for my answer"). Behavioral, never scenario-specific (no "with him," no names — that is body material), never a feeling-state ("I feel alone when…"), never an image ("…when I reach and he doesn't reach back"). If the evidence is a single instance, hedge with "can" or "sometimes."

NON-NEGOTIABLES
- The user's exact charged words carry in verbatim — their body, sensory, and system words ("buzzing," "too loud," "went offline," "racing," "shut down," "heavy"). Never upgrade their vocabulary into something more elegant, and never into clinical language. No clinical framework names, even to negate one: no "dissociation," "masking," "schema," "attachment style," "dysregulation," "executive dysfunction," "rejection sensitive dysphoria," "sensory overwhelm," "trauma response." Describe the behavior and the body instead.
- Stay in the user's frame. The entry is about the thing THEY named, not a sharper angle you found. Claim only as wide as their evidence reaches — the body carries the scope.
- First person. No references to the session or to time. It reads the same six months from now.

LAYER (field: "layer", 1-5): pick the layer whose dimensions (shown in the input) best describe what the entry IS. Prefer a layer that already holds related entries so this integrates rather than scatters.

ACKNOWLEDGMENT (field: "acknowledgment"): one plain sentence, 12-22 words, second person, that quotes the specific moment from the user's last turn(s) and ends with the intent to mark it ("…I want to put that down"). Plain spoken, no therapy voice. If there is no quotable specific, return "".

COMPRESSED (for future reference):
- summary: one sentence, 20-40 words, third person. The mechanism and the bind, the user's charged words kept.
- key_words: 3-6 short words the user would recognize, including their charged words. No clinical terms.

Respond with ONLY valid JSON. No markdown. No backticks.
{"content": "Statement + passage...", "name": "Headline", "layer": 1, "acknowledgment": "Specific sentence ending with intent to mark.", "changelog": "One sentence.", "summary": "Third-person summary.", "key_words": ["word1", "word2"]}`;

  const userContent = `${languageSection}${manualSection}${depthSection}
RECENT CONVERSATION:
${historyText}

${PERSONA_NAME.toUpperCase()}'S CHECKPOINT REFLECTION:
${checkpointText}

Compose the manual entry. Pick the layer, the headline, the prose. Return the JSON.`;

  const response = await anthropicFetch({
    model: COMPOSITION_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const cleaned = extractResponseText(response)
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.content || typeof parsed.content !== "string") {
    return null;
  }

  // Layer must be a valid integer in 1..5. If Opus emits anything else the
  // entry can't be filed correctly — return null so the caller suppresses
  // the checkpoint rather than scattering an entry to an unknown layer.
  const rawLayer = parsed.layer;
  const parsedLayer =
    typeof rawLayer === "number"
      ? rawLayer
      : typeof rawLayer === "string"
        ? Number.parseInt(rawLayer, 10)
        : NaN;
  if (
    !Number.isInteger(parsedLayer) ||
    parsedLayer < 1 ||
    parsedLayer > 5
  ) {
    console.error(
      "[composeManualEntry] Composition returned invalid layer:",
      rawLayer
    );
    return null;
  }
  const layer: number = parsedLayer;

  // Universal-tone validator. The composition prompt forbids "always /
  // every / all / never / everyone / nobody" unless the user used the
  // word first (see "AVOID UNIVERSAL TONE THROUGHOUT" in the prompt
  // above). Dev-simulator audit (2026-05-19) caught "I'm always tracking
  // how things land" landing in an entry when the user had never said
  // "always" — the prompt is regularly skipped, so add a log-only check
  // so we can see the rate. Doesn't block the entry (matches the soft-
  // warning pattern around the headline retry above).
  const universalViolations = findUniversalToneViolations(
    parsed.content,
    conversationHistory
  );
  if (universalViolations.length > 0) {
    console.warn(
      "[composeManualEntry] Entry contains universal-tone words not used by user: %s",
      universalViolations.join(", ")
    );
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : deriveSummaryFromContent(parsed.content);

  const keyWords = Array.isArray(parsed.key_words)
    ? parsed.key_words
        .filter((w: unknown): w is string => typeof w === "string")
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0)
    : [];

  // Acknowledgment: trimmed string. Length and shape are governed by the
  // composer prompt ("12-22 words. One sentence."). Empty string flows
  // through naturally — the caller skips emission when falsy.
  const acknowledgment =
    typeof parsed.acknowledgment === "string"
      ? parsed.acknowledgment.trim()
      : "";

  // Headline validation (log-only). Single-call policy: the title is
  // composed once, by the main composer, which carries the full headline
  // rules (subject is "I", observable verb, named trigger, banned
  // subjects, single-example softener). We do NOT fire a second model
  // call to rewrite the title — a sloppy title is fixed in the one
  // prompt, not patched by a follow-up call. This deterministic check
  // runs once on the result purely for tuning visibility: if a title
  // still fails structurally, it ships as composed and we log it so the
  // composer prompt can be sharpened. Never blocks the entry.
  const isSingleExample =
    typeof distinctContexts === "number" && distinctContexts <= 1;
  const finalName = parsed.name || "Untitled";
  // The user's own words. Lets the headline validator honor a "felt-state"
  // verb (lose myself, fade, etc.) when it is the user's exact phrase.
  const userMessageText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const headlineCheck = validateHeadline(finalName, isSingleExample, userMessageText);
  if (!headlineCheck.ok) {
    console.warn(
      "[composeManualEntry] Headline failed validation (shipping as composed, single-call policy): %s",
      headlineCheck.reasons.join("; ")
    );
  }

  return {
    content: parsed.content,
    name: finalName,
    layer,
    changelog: parsed.changelog || `Created ${LAYER_NAMES[layer] || "Layer " + layer} entry.`,
    summary,
    key_words: keyWords,
    acknowledgment,
  };
}

// ─── Universal-tone validator ──────────────────────────────────────────────

const UNIVERSAL_TONE_WORDS = [
  "always",
  "every",
  "all",
  "never",
  "everyone",
  "nobody",
] as const;

/**
 * Find universal-tone words that appear in the composed entry content but
 * NOT in the user's own messages. The composition prompt forbids these
 * unless the user used the word first; this catches the violations the
 * prompt fails to prevent (see the "AVOID UNIVERSAL TONE THROUGHOUT"
 * block in the composition system prompt above).
 *
 * Returns the list of violating words. Empty list means clean.
 * Caller logs; doesn't block — soft warning, same shape as headline retry.
 */
function findUniversalToneViolations(
  content: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): string[] {
  const userText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const violations: string[] = [];
  for (const word of UNIVERSAL_TONE_WORDS) {
    const wordRegex = new RegExp(`\\b${word}\\b`, "i");
    if (wordRegex.test(content) && !wordRegex.test(userText)) {
      violations.push(word);
    }
  }
  return violations;
}

// ─── Headline validator + focused retry composer ───────────────────────────

/**
 * Structural validator for composed headlines. Catches the failures the
 * main composition prompt is supposed to prevent but routinely lets
 * through — non-"I" subject, internal/abstract verbs, missing trigger
 * word, missing "can"/"sometimes" softener when the entry came from a
 * single example. Returns `{ok, reasons}` so the caller can decide
 * whether to retry. Word-count check is lenient (4-10) rather than the
 * prompt's stated 4-8 because the composition prompt's own "good"
 * exemplars include headlines up to 11 words — the other axes are the
 * load-bearing ones.
 */
export function validateHeadline(
  headline: string,
  isSingleExample: boolean,
  userText: string = ""
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const trimmed = headline.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length < 4 || words.length > 10) {
    reasons.push(`word count ${words.length} (need 4-10)`);
  }

  // Subject test: first word must be "I". Catches body-part-as-agent
  // ("Stomach Pushes Me to Fix the Call") and nominalization-as-agent
  // ("Worst-Case Loop Fills the Processing") in one shot.
  if (!/^I\b/.test(trimmed)) {
    reasons.push("subject is not 'I'");
  }

  // Feeling-state subject (2026-06-16): "I feel/felt/am alone…" or "I'm…" names
  // a felt state, not an observable behavior — the exact failure class the
  // behavioral-title rule targets ("I Feel Alone When He Doesn't Reach Back").
  // Log-only like the rest of this function; the caller does not block on it.
  if (/^I(?:'m|\s+(?:feel|felt|am))\b/i.test(trimmed)) {
    reasons.push("feeling-state subject ('I feel/am…') — name the behavior, not the state");
  }

  // Banned internal/abstract verbs from confirm-checkpoint composition
  // prompt. These describe a felt state, not an observable action.
  const BANNED_VERBS: RegExp[] = [
    /\bdisappear/i,
    /\bvanish/i,
    /\bfade/i,
    /\bdissolve/i,
    /\bfall apart\b/i,
    /\bcome undone\b/i,
    /\bgo missing\b/i,
    /\blose myself\b/i,
    /\bbreak open\b/i,
    /\bshut down inside\b/i,
  ];
  // Mirror-exact-language carve-out (2026-06-03): a "felt-state" verb is
  // only banned when it is Jove's word, not the user's. If the user's own
  // messages contain that exact phrase (they literally said "I lose
  // myself"), it is their truest self-description and wins over the ban —
  // this is what lets the title name the pattern in the user's words
  // ("I Lose Myself When the Verdict Isn't In") instead of a narrowed
  // observable proxy ("I Scan Before Speaking Around New People"). The ban
  // still fires for any banned verb the user never said, so vague/poetic
  // titles ("I Disappear...", body-part-as-agent) are still rejected.
  for (const re of BANNED_VERBS) {
    if (re.test(trimmed) && !re.test(userText)) {
      reasons.push(`abstract/internal verb matched ${re.source}`);
    }
  }

  // Trigger word required: when/before/after/while/once/if signal the
  // specific condition that fires the behavior. Without one, the
  // headline names a what but not a when — exactly the failure mode
  // the composition prompt's "REQUIRED: name a SPECIFIC TRIGGER"
  // section is trying to prevent.
  if (!/\b(when|before|after|while|once|if)\b/i.test(trimmed)) {
    reasons.push("no trigger word (when/before/after/while/once/if)");
  }

  // Softener required when the user gave only one example. "Can" or
  // "sometimes" prevents over-claiming a recurring pattern from a
  // single data point. "Keep"/"always"/etc. are intensifiers and do
  // NOT count as softeners.
  if (isSingleExample && !/\b(can|sometimes)\b/i.test(trimmed)) {
    reasons.push("single-example headline missing 'can' or 'sometimes' softener");
  }

  return { ok: reasons.length === 0, reasons };
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
 * RPC definition and docs/reference/checkpoint-hardening-plan.md Track 2.
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
      ? deriveSummaryFromContent(trimmedEditedContent)
      : meta.composed_summary || deriveSummaryFromContent(contentToWrite);
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
