import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, TAGS, RELATIONSHIP_TAGS, sectionName } from "@/lib/manual/layers";
import { PERSONA_NAME, COMPOSITION_MODEL } from "./config";
import { deriveSummaryFromContent } from "./manual-context";

// ─── Manual entry composition (Opus) ───────────────────────────────────────

// How many trailing transcript messages the composer reads literally. See the
// recentHistory comment below — widened for the user-pulled Reflection model.
const COMPOSE_TRANSCRIPT_WINDOW = 50;

// THE ENTRY SPEC — the editable writing standard for a Manual entry: fidelity
// to the recognition that already happened in the conversation (v3, 2026-07-09,
// consolidated after a psychologist + prompt-engineering line-economics review:
// ~40% shorter, every mechanism stated once — the old "THE BAR / caught off
// guard" depth target moved to the conversation side; the written record only
// PRESERVES a recognition, it never manufactures one). Admin-editable on the
// Tuning page ("Entry voice — the bar"); resolved override-or-default at the
// call sites (voice-overrides.ts → composerEntryBar), fed in as
// `entryBarOverride`, and fails open to this constant. Everything else in the
// composer prompt below — the output schema, section assignment, the
// first-person/timeless rule, and the no-clinical-names safety rule — stays
// locked in code, so an admin edit can never drop the safety floor.
//
// KNOWING DUPLICATION (A/B scaffolding): this text also lives as the
// "## Writing the reflection" section of CONDUCTOR_PROMPT (conductor-prompt.ts)
// — composer mode reads it from HERE, conductor mode reads it from the
// conductor prompt (the compose call there sends only the machine contract).
// Change one → change both, or the A/B compares different specs. The loser's
// copy dies at winner-selection.
export const COMPOSER_ENTRY_BAR = `The entry records a recognition that ALREADY HAPPENED in the conversation — hold it in their own words so it lands again on reread, don't produce a new one. A line sharper than what they landed is yours, not theirs — cut it back. A piece that never landed stays out: an entry that says less and is entirely theirs beats a complete one they don't recognize.

- The settled thing, not the label they walked in with — where the last exchanges and the first ones disagree, the last ones are true. Stay in their frame; never add a connection they didn't close themselves.
- The title (the "name" field) is the line they'll reread: one first-person sentence, about 6-12 words, naming what they do and when it fires — picturable, their words. Not a feeling-state ("I feel alone…"), not one scene ("with him"), not a label.
- Their words verbatim — especially phrases they corrected you into, and body words ("chest tight," "went blank"). A phrase they fought for outranks one you offered; never trade a body word for a smoother one.
- One pattern, worked all the way down: what they do, when and with whom, what fires it, why they can't stop, what it costs — not a tour of the session. A strength is allowed to just be a strength: say what it's for and where it tips, never bend it into a hidden cost they didn't raise.
- Commit to the claim; the condition carries the limit. Name the situation — no "sometimes I maybe tend to" blur, and no always / never / everyone unless they used the word. Exception: a single moment isn't a pattern yet — hedge it with "I can…" or "sometimes."
- Say it, don't write it: plain declarative in their register, no crafted phrasing, no metaphor they'd have to decode back to themselves. The force is precision and their charged words.`;

/** The composed Manual entry — the shared output shape of both the classic
 *  composer (composeManualEntry) and the conductor pull path
 *  (composeEntryAsConductor). Produced by finalizeComposedEntry. */
export interface ComposedEntry {
  content: string;
  name: string;
  section: string;
  tags: string[];
  changelog: string;
  summary: string;
  key_words: string[];
}

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
  manualComponents: { section?: string | null; name: string | null; content: string }[];
  /** distinct_contexts from the latest extraction state. When 1 or 0 the
   *  entry came from a single situation, so the headline validator will
   *  enforce a "can" / "sometimes" softener — prevents over-claiming a
   *  recurring pattern from one data point. null / undefined means
   *  "unknown" (e.g. legacy extraction state without this field); the
   *  softener check is then skipped to preserve prior behavior. */
  distinctContexts?: number | null;
  /** The session's accumulated understanding, carried from the latest
   *  extraction state. The composer reads the last COMPOSE_TRANSCRIPT_WINDOW
   *  (50) transcript messages verbatim; these fields SUPPLEMENT that raw
   *  transcript (and carry anything older than the window), they don't
   *  replace it. depth is the deepest rung reached (surface → behavior →
   *  feeling → mechanism → origin); sageBrief is the running read of
   *  what's underneath; currentThread is what's live right now. All
   *  optional / nullable so legacy callers and thin states degrade
   *  gracefully. */
  depth?: string | null;
  sageBrief?: string | null;
  currentThread?: string | null;
  /** Admin-editable "entry voice" standard (THE BAR). Resolved by the caller
   *  from voice-overrides (composerEntryBar); undefined/blank falls back to the
   *  shipped COMPOSER_ENTRY_BAR. Only the quality standard is editable — the
   *  output schema, section assignment, and length/safety rules stay in code. */
  entryBarOverride?: string;
  /** Conductor pull path (pull-model Step 3): the conversation BUILT the entry
   *  in the open — a working version said aloud and refined with the user's
   *  corrections. When true, the composer's job for the BODY changes from
   *  authoring to REPRODUCING: locate the most recent user-approved working
   *  version in the transcript and carry it near-verbatim (the user's latest
   *  corrections always win). Clerical outputs (section/title/tags/summary)
   *  still follow the standard rules. False/absent = unchanged behavior for
   *  the normal pull path (no working version exists to anchor on).
   *  Deletion condition: conductor promoted → this becomes the only pull mode
   *  and the flag collapses. */
  anchorApprovedVersion?: boolean;
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
/**
 * The composer's system prompt: static except for the entry bar (the
 * admin-editable depth standard, COMPOSER_ENTRY_BAR / composer_entry_bar
 * override). Exported so the admin Tuning page renders the EXACT text the
 * composer runs on — one source of truth; the display can never drift from
 * the call. Everything dynamic (Manual catalog, language bank, transcript,
 * depth brief) rides in the USER message, not here.
 */
export function buildComposerSystemPrompt(entryBar: string): string {
  return `You compose Manual entries for a self-authored Manual. You take a checkpoint reflection from a conversationalist called ${PERSONA_NAME} plus the recent conversation, and turn it into one entry that reads as the user describing themselves to themselves — in their own words.

${buildEntrySpecBody(entryBar)}`;
}

/**
 * The entry-writing spec — the editable writing standard (COMPOSER_ENTRY_BAR:
 * fidelity, title, voice, conditionality) + the LOCKED rules (clinical-name
 * ban, first-person/timeless, section / tags / compressed summary, JSON output
 * schema). This is the one source of truth for HOW an entry gets written; it's
 * shared by two delivery framings:
 *   - the classic composer wraps it in a standalone system prompt
 *     (buildComposerSystemPrompt), where a fresh model reads the transcript from
 *     outside;
 *   - the conductor pull path (compose-as-conductor.ts) hands it to Jove as the
 *     final "write the entry now" instruction, mid-conversation, so the same
 *     voice that ran the session writes the record from full live context.
 * Editing this text changes both paths — intended.
 */
export function buildEntrySpecBody(entryBar: string): string {
  return `${entryBar}

${buildEntryMachineContract()}`;
}

/**
 * The MACHINE CONTRACT half of the entry spec: the code-locked safety rules
 * (clinical-name ban, first-person/timeless), section assignment, the closed
 * tag set, the compressed summary/key-words, and the JSON output schema. No
 * voice/quality guidance lives here — that's the editable standard above it.
 * Conductor mode sends ONLY this (plus a short mode-flip line) at pull time,
 * because its writing standard lives in the conductor prompt itself; composer
 * mode gets it via buildEntrySpecBody.
 */
export function buildEntryMachineContract(): string {
  return `LOCKED RULES (these hold no matter what the writing standard says)
- No clinical framework names, even to negate one: no "dissociation," "masking," "schema," "attachment style," "dysregulation," "executive dysfunction," "rejection sensitive dysphoria," "sensory overwhelm," "trauma response." Describe the behavior and the body instead.
- First person. No references to the session or to time. It reads the same six months from now.

SECTION (field: "section"): the entry's one home. Pick the section whose dimensions (shown in the input) best describe what the entry IS AT ITS CORE — its spine, not where the scene happens. Use one of these exact slugs:
- "relationships" — how you connect, withdraw, show care; how others read you.
- "work-money" — how you operate, mask, and hold up at work.
- "routines-structure" — the systems that hold the day up, and their collapse.
- "sensory-burnout" — what the body takes in and what it costs (load, overload, shutdown, recovery).
- "interests-flow" — where you go deep and do your best work.
Spine over scene: a sensory crash that happens at work is "sensory-burnout" (the body is the subject); a work-performance pattern is "work-money". If an entry holds BOTH the masking AND the crash/cost, the body wins → "sensory-burnout". Prefer a section that already holds related entries so this integrates rather than scatters.

ALWAYS pick exactly one of the five — every entry gets a home, including a self-to-self pattern (self-judgment, self-doubt, self-governance). Home it by its spine: where the pattern bites hardest in life (capability and self-trust → "work-money"; a body freeze/shutdown → "sensory-burnout"; suppressing your wants around people you love → "relationships"). When unsure, pick the closest of the five.

TAGS (field: "tags", array of strings, may be empty): a closed set, optional lens. Never invent tags outside it.
- "strength" — when the pattern is genuinely a capability or asset (not a costly pattern). Valid in any section.
- "romantic" / "family" / "friends" — ONLY when section is "relationships" AND the entry names which sphere. Omit otherwise.

COMPRESSED (for future reference):
- summary: one sentence, 20-40 words, third person — "they" for the user, never a gendered pronoun. The mechanism and the bind, the user's charged words kept.
- key_words: 3-6 short words the user would recognize, including their charged words. No clinical terms.

Respond with ONLY valid JSON. No markdown. No backticks.
{"content": "Depth on the one pattern...", "name": "The title — what they do", "section": "relationships", "tags": ["romantic"], "changelog": "One sentence.", "summary": "Third-person summary.", "key_words": ["word1", "word2"]}
("section" is one of the five slugs above; "tags" may be []. )`;
}

export async function composeManualEntry(
  options: ComposeManualEntryOptions
): Promise<ComposedEntry | null> {
  const {
    checkpointText,
    conversationHistory,
    languageBank,
    manualComponents,
    distinctContexts,
    depth,
    sageBrief,
    currentThread,
    entryBarOverride,
    anchorApprovedVersion,
  } = options;

  // Resolve the editable depth standard: an enabled, non-blank override wins;
  // otherwise the shipped default. Everything else in `system` is code-fixed.
  const entryBar =
    entryBarOverride && entryBarOverride.trim()
      ? entryBarOverride
      : COMPOSER_ENTRY_BAR;

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
    const entries = manualComponents.filter((c) => c.section === l.slug);
    const entriesText =
      entries.length === 0
        ? "(no entries yet)"
        : entries
            .map(
              (c) => `  [entry${c.name ? ` — "${c.name}"` : ""}]\n  ${c.content}`
            )
            .join("\n\n");
    return `${l.name} (${l.dimensions.join(", ")}):\n${entriesText}`;
  }).join("\n\n");

  const manualSection = `\nTHE USER'S MANUAL SO FAR:\n${layerCatalog}\n\nPick the section this entry belongs to based on what the entry IS at its core (the dimensions above), and how it relates to entries already in that section. Integrate with or deepen existing entries when relevant. If new material contradicts an existing entry on the chosen layer, name the tension. When a prior entry genuinely connects to this one, you may draw the connection in the user's own voice — something they can recognize showing up across situations. But the spine of THIS entry stays the pattern from THIS conversation. Do not make a previous entry's frame the backbone of the new one just because the user is returning.\n`;

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

  const system = buildComposerSystemPrompt(entryBar);

  // The auto-pushed path seeds the composer with Jove's drafted reflection.
  // The user-pulled path has none — tell the composer the truth (compose from
  // the conversation + the accumulated understanding above) rather than
  // fabricating a fake reflection, which composes better than a stale seed.
  // The CONDUCTOR pull path (anchorApprovedVersion) is different again: the
  // conversation built the entry in the open, so the body's job is
  // reproduction, not authorship — the fidelity failures this guards against
  // are documented (the purpose-run card re-wrote the approved draft back
  // into a register the user had rejected).
  const reflectionBlock = checkpointText
    ? `${PERSONA_NAME.toUpperCase()}'S CHECKPOINT REFLECTION:\n${checkpointText}`
    : anchorApprovedVersion
      ? `The user chose to capture the reflection they BUILT WITH ${PERSONA_NAME} in this conversation. A working version of the entry was said aloud during the conversation and refined through the user's own corrections — find it in the transcript above. Take the MOST RECENT version the user approved (their last "yes, that's it" — or their own rewritten version if they wrote one; the user's latest corrections always beat earlier drafts). THE BODY IS THAT APPROVED VERSION, carried near-verbatim: light stitching only where needed for it to stand alone. Never re-author it, never upgrade its register, never reintroduce a phrasing the user corrected away, and do not deepen past what they approved — for the body, faithful reproduction IS the bar. Title, section, tags, and summary follow the rules above, derived from the approved version and the conversation. If NO working version was ever said aloud (the user pulled early, mid-conversation), ignore the reproduction rule and follow the normal entry rules above — one pattern worked down to whatever depth the conversation actually reached, never a chronological retelling of the session.`
      : `The user chose to capture a reflection from this conversation. Compose the entry from the conversation above and the accumulated understanding — there is no pre-drafted reflection to polish.`;

  const userContent = `${languageSection}${manualSection}${depthSection}
RECENT CONVERSATION:
${historyText}

${reflectionBlock}

Compose the manual entry. Pick the section (one of the five), the tags, the headline, the prose. Return the JSON.`;

  const response = await anthropicFetch({
    model: COMPOSITION_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  return finalizeComposedEntry(extractResponseText(response), {
    conversationHistory,
    distinctContexts,
    // No drafted reflection in the user-pulled path — seed the title retry with
    // the accumulated understanding (falls back to the user's own words inside
    // finalize) so a hard-failing headline retries on real material.
    headlineRetrySeed: checkpointText || depthBrief,
  });
}

/**
 * Parse the model's JSON entry and apply every output guard, then return the
 * finished ComposedEntry (or null if the JSON is unusable). Shared by both the
 * classic composer and the conductor pull path so the guards — section homing,
 * tag closure, universal-tone logging, summary/key-word derivation, and the
 * headline validate-and-retry — live in ONE place regardless of who wrote the
 * entry. `headlineRetrySeed` is the material the title-only retry composes from
 * (the classic path's checkpoint/depth brief); it falls back to the user's own
 * words when absent (the conductor path passes nothing).
 */
export async function finalizeComposedEntry(
  responseText: string,
  ctx: {
    conversationHistory: { role: "user" | "assistant"; content: string }[];
    distinctContexts?: number | null;
    headlineRetrySeed?: string;
  }
): Promise<ComposedEntry | null> {
  const { conversationHistory, distinctContexts, headlineRetrySeed } = ctx;

  const cleaned = responseText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.content || typeof parsed.content !== "string") {
    return null;
  }

  // SECTION: every entry is homed on one of the five life-area sections. The
  // composition prompt always picks one; if it ever returns an absent/unknown
  // section we default to "relationships" (the catch-all) rather than dropping
  // a confirmed entry. Logged so an off-spec rate is visible.
  const SECTION_SLUGS = LAYERS.map((l) => l.slug);
  const DEFAULT_SECTION = "relationships";
  const rawSection =
    typeof parsed.section === "string" ? parsed.section.trim() : null;
  const section: string =
    rawSection && SECTION_SLUGS.includes(rawSection)
      ? rawSection
      : DEFAULT_SECTION;
  if (rawSection !== section) {
    console.warn(
      "[finalizeComposedEntry] Composition returned missing/unknown section; defaulting to relationships:",
      rawSection
    );
  }

  // TAGS: closed set; relationship sub-tags only valid inside relationships.
  const allowedTags = TAGS as readonly string[];
  const relTags = RELATIONSHIP_TAGS as readonly string[];
  const tags: string[] = (Array.isArray(parsed.tags) ? parsed.tags : [])
    .filter((t: unknown): t is string => typeof t === "string")
    .map((t: string) => t.trim())
    .filter((t: string) => allowedTags.includes(t))
    .filter((t: string) => (relTags.includes(t) ? section === "relationships" : true))
    .filter((t: string, i: number, a: string[]) => a.indexOf(t) === i);

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
      "[finalizeComposedEntry] Entry contains universal-tone words not used by user: %s",
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
      checkpointText:
        headlineRetrySeed && headlineRetrySeed.trim()
          ? headlineRetrySeed
          : userMessageText,
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
      "[finalizeComposedEntry] Headline failed validation%s: %s",
      headlineCheck.hardFail ? " (hard, retry unresolved)" : " (soft, shipped)",
      headlineCheck.reasons.join("; ")
    );
  }

  return {
    content: parsed.content,
    name: finalName,
    section,
    tags,
    changelog: parsed.changelog || `Created ${sectionName(section)} entry.`,
    summary,
    key_words: keyWords,
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
      section: string | null;
      tags?: string[] | null;
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
        p_layer: null,
        p_section: meta.section ?? null,
        p_tags: Array.isArray(meta.tags) ? meta.tags : [],
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
