import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME, COMPOSITION_MODEL } from "./config";
import { deriveSummaryFromContent } from "./manual-context";

// ─── Manual entry composition (Opus) ───────────────────────────────────────

// How many trailing transcript messages the composer reads literally. See the
// recentHistory comment below — widened for the user-pulled Reflection model.
const COMPOSE_TRANSCRIPT_WINDOW = 50;

interface ComposeManualEntryOptions {
  /** Jove's checkpoint message in the auto-pushed path — the transition line
   *  plus the entry-shaped prose Jove drafted, which the composer polishes.
   *  ABSENT in the user-pulled (Reflection) path: there is no pre-drafted
   *  reflection, so the composer is told to compose from the conversation +
   *  accumulated understanding instead (see the userContent assembly). */
  checkpointText?: string;
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

  // Trailing transcript the composer reads literally. Widened from 8 → 50
  // for the user-pulled Reflection model: a reflection can be pulled long
  // after the scenes that earned it, so those scenes must still be in the
  // literal window (depth-meter-spec.md §13). Bounded so a marathon thread
  // can't bloat the compose call toward the edge timeout. The rest of the
  // session's depth still rides in through depthSection + the language bank.
  const recentHistory = conversationHistory.slice(-COMPOSE_TRANSCRIPT_WINDOW);
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

name (the TITLE) — THE ARTIFACT. This is the line the user sees every time they open their Manual; in the Manual list the body is collapsed behind it, so the title carries the entry's holdability. It must clear THE BAR above — the DISCOVERY, not a behavior they could have named walking in. If they could have written the title before this conversation, it is too shallow: the generic "I perform interest to stay close to people I love" fails (anyone could write that); the discovery under it — "I keep debating because going quiet feels like pulling away" — lands. A complete first-person sentence naming what they DO and what drives it — a tendency ("I tend to…") or a trigger ("I [verb] when…"). Picturable and complete: nothing left to decode ("I let myself go when something breaks" fails — go where?). About 6–12 words. Never scenario-specific (no names, no "with him" — that lives in the body), never a feeling-state ("I feel alone…"), never an image. A single instance → hedge with "can"/"sometimes".
  Lands: "I tend to stay in things I've outgrown until I'm forced to leave."

content (the body) — earns the title by developing the ONE pattern to the depth of the "Deeper" example above: follow its internal logic — what fires it, what it does, why they can't stop, what it costs — until you reach the part they could NOT have written before this conversation. One pattern, fully worked, in their charged words. Go DOWN into it; never walk ACROSS the session (the scene, then the backstory, then the cost), and never add a second pattern to hold. A specific person or scene can ground a line here, never in the title. This is depth, not length — but a flat two-sentence restatement of the title is too thin; earn the recognition the way the example does. If they landed a stance of their own ("I need people to…"), keep it in their words; if not, leave it out. Never invent a takeaway, and never summarize the conversation.

A strength is held to the same bar and gets the same depth. Name the capability and the conditions that bring it out. A strength is allowed to just be a strength — never bend it into a hidden cost the user did not raise.

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
{"content": "Depth on the one pattern...", "name": "The title — what they do", "layer": 1, "acknowledgment": "Specific sentence ending with intent to mark.", "changelog": "One sentence.", "summary": "Third-person summary.", "key_words": ["word1", "word2"]}`;

  // The auto-pushed path seeds the composer with Jove's drafted reflection.
  // The user-pulled path has none — tell the composer the truth (compose from
  // the conversation + the accumulated understanding above) rather than
  // fabricating a fake reflection, which composes better than a stale seed.
  const reflectionBlock = checkpointText
    ? `${PERSONA_NAME.toUpperCase()}'S CHECKPOINT REFLECTION:\n${checkpointText}`
    : `The user chose to capture a reflection from this conversation. Compose the entry from the conversation above and the accumulated understanding — there is no pre-drafted reflection to polish.`;

  const userContent = `${languageSection}${manualSection}${depthSection}
RECENT CONVERSATION:
${historyText}

${reflectionBlock}

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

  // Headline enforcement (2026-06-16). The title is the most-missed output:
  // the in-prompt rules don't bind under load (a real prod entry shipped a
  // feeling-state, scenario-specific title despite the prompt banning both).
  // So on a HARD failure — non-"I" subject, feeling-state subject, or a
  // banned felt-state verb the user never said — fire ONE focused title-only
  // retry. It fires only on hard failures, so the extra call is bounded to
  // the miss rate; soft issues (word count, single-example hedge) still ship
  // as composed and are logged. Delete this block if titles stop hard-failing.
  const isSingleExample =
    typeof distinctContexts === "number" && distinctContexts <= 1;
  let finalName = parsed.name || "Untitled";
  // The user's own words. Lets the validator honor a "felt-state" verb
  // (lose myself, fade, etc.) when it is the user's exact phrase.
  const userMessageText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  let headlineCheck = validateHeadline(finalName, isSingleExample, userMessageText);
  if (headlineCheck.hardFail) {
    const retried = await recomposeHeadline({
      failingTitle: finalName,
      reasons: headlineCheck.reasons,
      // No drafted reflection in the user-pulled path — seed the title retry
      // with the accumulated understanding (or the user's own words) so a
      // user-pulled entry that hard-fails its headline still retries on real
      // material rather than an empty string.
      checkpointText: checkpointText || depthBrief || userMessageText,
      userText: userMessageText,
      isSingleExample,
    });
    if (retried) {
      const retryCheck = validateHeadline(retried, isSingleExample, userMessageText);
      if (!retryCheck.hardFail) {
        finalName = retried;
        headlineCheck = retryCheck;
      }
    }
  }
  if (!headlineCheck.ok) {
    console.warn(
      "[composeManualEntry] Headline failed validation%s: %s",
      headlineCheck.hardFail ? " (hard, retry unresolved)" : " (soft, shipped)",
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
 * Structural validator for composed headlines. Splits failures into HARD
 * (unambiguous: non-"I" subject, feeling-state subject, banned felt-state
 * verb the user never said) and SOFT (word count, single-example hedge). The
 * caller RETRIES on hardFail and only logs the soft ones. The old "trigger
 * word required" check was removed 2026-06-16: behavioral titles ("I reach
 * for more depth than I get back") express the condition without a literal
 * when/before/after, so that check mis-flagged good titles. Word count is
 * lenient (4-12) for the same reason.
 */
export function validateHeadline(
  headline: string,
  isSingleExample: boolean,
  userText: string = ""
): { ok: boolean; reasons: string[]; hardFail: boolean } {
  const hard: string[] = [];
  const soft: string[] = [];
  const trimmed = headline.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // SOFT: length. Behavioral titles run a little longer than the prompt's
  // stated 4-8, so the gate is lenient and shipped-with-a-warning, not retried.
  if (words.length < 4 || words.length > 12) {
    soft.push(`word count ${words.length} (need 4-12)`);
  }

  // HARD: subject must be "I". Catches body-part-as-agent ("Stomach Pushes
  // Me…"), nominalization-as-agent ("Worst-Case Loop Fills…"), and the
  // scenario-noun-as-subject failure ("The Decisions About Him Are Ones I…").
  if (!/^I\b/.test(trimmed)) {
    hard.push("subject is not 'I'");
  }

  // HARD: feeling-state subject ("I feel/felt/am alone…" / "I'm…") names a
  // state, not the observable behavior the title must name ("I Feel Alone When
  // He Doesn't Reach Back" — the real prod failure this enforces against).
  if (/^I(?:'m|\s+(?:feel|felt|am))\b/i.test(trimmed)) {
    hard.push("feeling-state subject ('I feel/am…') — name the behavior, not the state");
  }

  // HARD: banned internal/abstract verbs (felt states, not actions) — UNLESS
  // the user said the exact word themselves, in which case their truest
  // self-description wins (mirror-exact-language carve-out, 2026-06-03):
  // "I Lose Myself When the Verdict Isn't In" stands if they said "lose
  // myself." The ban still fires for any banned verb the user never said.
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
  for (const re of BANNED_VERBS) {
    if (re.test(trimmed) && !re.test(userText)) {
      hard.push(`abstract/internal verb matched ${re.source}`);
    }
  }

  // SOFT: single-example softener. "Can"/"sometimes" prevents over-claiming a
  // recurring pattern from one data point. Logged, not retried.
  if (isSingleExample && !/\b(can|sometimes)\b/i.test(trimmed)) {
    soft.push("single-example headline missing 'can' or 'sometimes' softener");
  }

  const reasons = [...hard, ...soft];
  return { ok: reasons.length === 0, reasons, hardFail: hard.length > 0 };
}

/**
 * Focused title-only retry. Fired by composeManualEntry ONLY when
 * validateHeadline reports a hard failure — the title rules don't bind in the
 * main composition prompt under load, so a structurally-broken title gets one
 * targeted rewrite rather than shipping as-is. One small model call, only on
 * the miss path. Returns the rewritten title, or null on any failure (caller
 * keeps the original).
 */
async function recomposeHeadline(opts: {
  failingTitle: string;
  reasons: string[];
  checkpointText: string;
  userText: string;
  isSingleExample: boolean;
}): Promise<string | null> {
  const hedge = opts.isSingleExample
    ? ` Only one example was given, so hedge: start "I can…" or include "sometimes."`
    : "";
  const system = `Rewrite ONE Manual entry title so it names a BEHAVIOR.
A title is a short first-person sentence the user would say to a friend: what they DO and what sets it off ("I go quiet when someone waits for my answer"). Start with "I" and an observable verb. NEVER a feeling-state ("I feel alone…"), NEVER scenario-specific (no names, no "with him" — that lives in the entry body), NEVER an image.${hedge}
Return ONLY the rewritten title — no quotes, no surrounding punctuation, no explanation.`;
  const user = `Current title (rejected — ${opts.reasons.join("; ")}):
${opts.failingTitle}

The reflection it should title:
${opts.checkpointText}

The person's own words to draw from:
${opts.userText}`;
  try {
    const response = await anthropicFetch({
      model: COMPOSITION_MODEL,
      max_tokens: 64,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = extractResponseText(response)
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.error("[recomposeHeadline] retry failed:", err);
    return null;
  }
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
