import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, renderManualEntryFull } from "@/lib/manual/layers";
import { PERSONA_NAME, EXTRACTION_MODEL } from "@/lib/persona/config";
import { logEvent } from "@/lib/observability/log";
// DEPTH_LEVELS is the single source of truth for the ordered shallow→deep depth
// scale, also used by the checkpoint gate's depth-floor comparison. Imported
// here so the monotonic-depth merge below ranks depth the same way the gate does.
import { DEPTH_LEVELS } from "@/lib/persona/checkpoint-tuning";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LanguageEntry {
  phrase: string;
  context: string;
  charge: "low" | "medium" | "high";
  layers: number[];
}

export interface CheckpointGate {
  // Count of DIFFERENT situations / events / time-periods the user has
  // narrated. The only surviving gate field — read by the save-time composer
  // (compose route) to decide whether the headline needs a "can" / "sometimes"
  // softener (one vivid scene shouldn't over-claim a recurring pattern). The
  // rest of the old ripeness scorecard was removed with the Jove-pushed
  // checkpoint gate (2026-07-03). Optional: pre-existing states may lack it.
  distinct_contexts?: number;
}

export interface ClinicalFlag {
  active: boolean;
  level: "crisis" | "caution" | "none";
  note: string;
}

export interface ExtractionState {
  language_bank: LanguageEntry[];
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin";
  current_thread: string;
  checkpoint_gate: CheckpointGate;
  clinical_flag: ClinicalFlag;
  sage_brief: string;
}

interface ManualEntry {
  layer?: number | null;
  section?: string | null;
  name: string | null;
  content: string;
}

// How many recent messages the extraction Sonnet call sees. Extraction is
// cumulative — earlier signals are already folded into previous state — but
// a larger window lets the extractor spot a mechanism that developed across
// the last several turns rather than only the latest exchange.
export const EXTRACTION_MESSAGE_WINDOW = 12;

// ─── Default state ───────────────────────────────────────────────────────────

function defaultState(): ExtractionState {
  return {
    language_bank: [],
    depth: "surface",
    current_thread: "",
    checkpoint_gate: {
      distinct_contexts: 0,
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    sage_brief: "",
  };
}

// ─── Extraction prompt ──────────────────────────────────────────────────────

// Build the layer model and dimensions blocks from the canonical LAYERS
// definition so a layer rename is one line in src/lib/manual/layers.ts.
const LAYER_MODEL_BLOCK = LAYERS.map(
  (l) =>
    `${l.name}: ${l.description}\n  Example: "${l.example}"`
).join("\n");


const EXTRACTION_SYSTEM = `You are the extraction layer for a conversational AI called ${PERSONA_NAME} that builds Manuals for late-diagnosed autistic adults. You run silently before ${PERSONA_NAME} responds. Your job is to analyze what the user just said and produce structured context so ${PERSONA_NAME} can have a deeper, more grounded conversation.

You receive:
- The conversation so far
- The previous extraction state (cumulative across the session)
- Any confirmed manual entries the user already has
- Whether the user has ever had a checkpoint confirmed

You produce an updated extraction state. This is ${PERSONA_NAME}'s research brief. The quality of ${PERSONA_NAME}'s conversation depends entirely on the quality of your analysis.

CLINICAL FRAMEWORK GUARDRAIL
Use Schema Therapy, Attachment Theory, and Functional Analysis as internal pattern recognition frameworks. NEVER reference these frameworks by name. NEVER use clinical terminology in any field that ${PERSONA_NAME} will read. Describe what you observe in the user's own language and in behavioral or somatic terms, not psychological labels. The extraction state is upstream of ${PERSONA_NAME}'s voice — clinical drift here causes clinical drift there.
- "fear of abandonment" → "your brain predicted the worst when they went quiet"
- "emotional avoidance" → "you stopped feeling it so you could keep going"
- "attachment anxiety" → "when you're not sure where you stand, everything gets loud"

THE FIVE SECTIONS
${LAYER_MODEL_BLOCK}

YOUR ANALYSIS PRIORITIES

1. LANGUAGE BANK (most important)
Capture the user's exact phrases that carry weight. Not your paraphrase. Their words. For autistic users, the phrases that matter most are:
- Sensory language: buzzing, loud, heavy, full, too close, crashed, tight, bright, sharp, racing, hot, prickle, lit up, pounding, electric
- Masking language: the version people see, the performance, being "on," translating myself, the script
- Shutdown language: went offline, system full, crashed, hit a wall, gray out, blank, frozen
- System language: my brain does this, recalculating, map got erased, runs differently, processing
- Body language: my body did X, went still, jaw locked, chest tight, hands moved on their own
- Bind language: looks like X but it's actually Y, I can't [thing] without [other thing]
- Emotional language IF the user used it first: "it gutted me," "I just shut down" (do not introduce emotion words on their behalf)
- Contradictions between what they claim and what they describe
- Moments of visible heat or charge in the text

Capture aggressively. If a phrase has any of the qualities above, log it. The bank is how ${PERSONA_NAME} avoids paraphrasing the user into a stranger.

2. DEPTH TRACKING
Where is the conversation in its vertical descent?
- surface: what happened (events, facts, the situation)
- behavior: what they did (actions, choices, what their body did)
- feeling: what they felt — body sensations, system states, AND emotions if they named them. For autistic users, "what your body did" is often more accessible than "what you felt." Both count as feeling-depth.
- mechanism: why it works that way (the underlying driver — the need, the sensory load, the system state, the bind)
- origin: where it comes from (when this started, earliest examples)

3. DISTINCT CONTEXTS
Count the DIFFERENT lived situations the user has WALKED YOU THROUGH AS A SCENE (distinct_contexts). A scene means the user described what happened, when, with whom, and what they did or felt — narrated, not mentioned. Four moments inside one phone call is ONE distinct context. Two friendships described in two scenes is two distinct contexts. This is informational, read at save time so a composed entry's headline doesn't over-claim a recurring pattern from a single scene. It is NOT a gate.

  DOES NOT count as a distinct context:
  - A category named in passing without a scene ("at dinners," "with friends," "at work") where the user has not walked you through a specific instance.
  - A wish-state or ideal ("what depth feels like," "what a good week looks like," "when I'm in flow") — these describe what the user wants, not a lived scene.
  - A contrast to the pattern under examination. If the conversation is about social drain and the user mentions junkyard art as the opposite, the junkyard is a contrast — not a second distinct context for the drain. BUT a contrast is high-value data: an exception is what pins what TYPE of situation or person actually triggers the pattern (what the exception lacks is what the type is). Log the user's contrast language in language_bank and name it in the brief as the exception that defines the type — it just does not advance distinct_contexts.
  - Repeated description of the same lived activity ("I love the smell of grease, I love placing things together, trial and error" — all one activity, one context).

  If the user has explicitly stated this is a one-off ("I don't ever do this," "this never happens to me," "this is outside my normal"), set distinct_contexts to 1 so the composed entry doesn't frame it as a recurring pattern.

4. JOVE BRIEF
Write a short paragraph (3-5 sentences) orienting the entry composition. The brief feeds into the manual entry when a checkpoint lands, so its vocabulary has to be the user's own:
- What the user is actually describing underneath the surface topic (in behavioral and somatic terms — what their body did, what their system was doing, what the input was like — never clinical labels)
- Which of the user's exact sensory or system words are load-bearing (e.g. "buzzing," "too loud," "went offline," "shut down," "went still," "full," "tight"). Name them so ${PERSONA_NAME} can carry them forward verbatim.
- What the most charged or unresolved piece is
- If the user has passed a judgment on themselves ("lazy," "in the wrong," "broken"), name it in their words — and whether it is still standing or the conversation has overturned it
- What ${PERSONA_NAME} should push on vs leave alone
- Whether a checkpoint is approaching and what body and bind it would anchor on

Use the user's own language wherever possible. If you reach for a clinical word ("anxiety," "trauma," "avoidance," "dysregulation," "masking," "sensory overwhelm"), stop and rewrite using what the user actually said. "Masking" becomes "the version of you that switches on in rooms." "Sensory overwhelm" becomes "too much input, jaw started buzzing." A checkpoint needs a concrete anchor: a body sensation OR a specific behavioral or system response (what they did, what their system did, what the input was like). The body is one valid anchor, not a requirement. If neither is present yet, flag that gap. But ${PERSONA_NAME} should not keep steering toward the body when the user isn't going there. A concrete behavioral anchor carries the same weight.

5. CLINICAL FLAG
A lightweight signal that tells ${PERSONA_NAME} when to engage legal guardrails. Two levels:

"crisis": User expressed suicidal ideation, self-harm intent, or intent to harm others. ${PERSONA_NAME} must stop building and provide resources.

"caution": User introduced diagnostic language, asked ${PERSONA_NAME} to assess a condition, or described distress that may exceed manual-building scope. ${PERSONA_NAME} should stay in behavioral description and may need to offer a professional referral.

"none": Normal conversation. Clinical themes may be present but the user is not asking ${PERSONA_NAME} to do anything clinical.

IMPORTANT: A user talking ABOUT depression, anxiety, trauma, etc. as part of their story is "none." A user asking ${PERSONA_NAME} to ASSESS whether they have a condition, or describing experiences that clearly exceed self-understanding scope (psychotic symptoms, inability to function, active destabilization), is "caution." The bar for "caution" is high. Most conversations stay "none" even when the material is heavy.

Respond with ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "language_bank": [
    { "phrase": "exact user words", "context": "what they were discussing", "charge": "low|medium|high", "layers": [1, 3] }
  ],
  "depth": "surface|behavior|feeling|mechanism|origin",
  "current_thread": "one sentence: what the conversation is actually about",
  "checkpoint_gate": {
    "distinct_contexts": 0
  },
  "clinical_flag": {
    "active": false,
    "level": "none",
    "note": ""
  },
  "sage_brief": "3-5 sentence orientation for the entry composition"
}

CRITICAL RULES:
- The language_bank is CUMULATIVE. Carry forward the 15 most relevant entries (prefer high-charge and recent). Only add new ones from the latest exchange. If the bank exceeds 15 entries, drop the oldest low-charge entries first.
- Be aggressive about capturing language from the live conversation. If in doubt, capture it.
- The language_bank holds ONLY the user's words from the conversation transcript below. The CONFIRMED MANUAL ENTRIES are context for recognizing when the current conversation echoes an existing pattern ("same shape as...") — they are NOT bank candidates. Never copy a phrase into language_bank because you saw it in a Manual entry. Capture a phrase only when the user says it in THIS conversation (even if the same phrase also appears in the Manual — what matters is that they said it here, now).
- NO CLINICAL LANGUAGE in any field that reaches ${PERSONA_NAME} or the entry (sage_brief, current_thread). Use the user's words and behavioral/somatic descriptions, not psychological labels.`;

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Coerce a model-supplied layer id to a number in 1..5, or null.
 *
 * The extraction model intermittently emits `language_bank[].layers` ids as
 * strings ("1") instead of numbers (1). Left uncoerced, a string id breaks
 * numeric membership checks downstream (`[1].includes("1") === false`).
 * Normalize at the parse boundary so the whole pipeline compares numbers to
 * numbers. (Originally added for the 2026-06-03 doom-loop incident.)
 */
export function toLayerNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Coerce a model-supplied layer list to clean numbers, dropping anything
 *  that isn't a valid 1..5 layer id. See toLayerNumber. */
export function coerceLayerList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(toLayerNumber)
    .filter((n): n is number => n !== null);
}

/** Charge ordering low < medium < high, so a phrase's charge can be held at its
 *  high-water mark rather than regressing. */
const CHARGE_RANK: Record<LanguageEntry["charge"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Max low-charge phrases retained in the accumulated bank. High/medium phrases
 * are NEVER capped — they're the gated, recognition-bearing material (the gate's
 * builtOnCharged check and the composer read high/medium only) and they're
 * naturally infrequent. Low-charge phrases are contextual noise the model
 * captures liberally ("if in doubt, capture it"), so they're the only source of
 * unbounded growth. Without a cap the union grows every turn and is fed back
 * into the extraction model's input each turn — inflating input over long
 * conversations. 20 keeps a useful recent-context tail for the composer/extractor
 * while bounding that growth; oldest low entries age out first.
 */
const LOW_CHARGE_CAP = 20;

/**
 * Accumulate the language bank instead of replacing it (mirrors the monotonic
 * count guard in mergeExtractionState). Sonnet re-reads the conversation from a
 * smaller window each turn and can return a smaller bank — silently dropping a
 * charged phrase captured earlier, which then fails the gate's
 * builtOnCharged-on-candidate-layer check (persona-pipeline.ts) and suppresses
 * an otherwise-ready checkpoint.
 *
 * Union by phrase (case/space-insensitive key). For a phrase seen in both:
 *   - keep the freshest text + context (incoming wins, it's iterated last),
 *   - hold charge at the MAX of the two (a phrase that was high/medium can't
 *     silently downgrade — same regression the count guard prevents),
 *   - union the layer ids.
 * Earlier-only phrases persist; charge per phrase is preserved, never flattened.
 *
 * Growth bound: high/medium phrases are unbounded; low-charge entries are capped
 * at LOW_CHARGE_CAP, evicting oldest first. Map insertion order is oldest→newest
 * (re-emitting an existing phrase updates it in place without moving it), so the
 * surviving low entries are simply the most recent ones.
 */
export function mergeLanguageBank(
  prev: LanguageEntry[],
  incoming: LanguageEntry[]
): LanguageEntry[] {
  const byPhrase = new Map<string, LanguageEntry>();
  for (const entry of [...prev, ...incoming]) {
    if (!entry || typeof entry.phrase !== "string") continue;
    const key = entry.phrase.trim().toLowerCase();
    if (!key) continue;
    const existing = byPhrase.get(key);
    if (!existing) {
      byPhrase.set(key, { ...entry });
      continue;
    }
    const existingRank = CHARGE_RANK[existing.charge] ?? 0;
    const incomingRank = CHARGE_RANK[entry.charge] ?? 0;
    byPhrase.set(key, {
      phrase: entry.phrase,
      context: entry.context,
      charge: incomingRank >= existingRank ? entry.charge : existing.charge,
      layers: Array.from(
        new Set([...(existing.layers || []), ...(entry.layers || [])])
      ),
    });
  }

  // Growth bound: keep every high/medium phrase, cap low-charge to the most
  // recent LOW_CHARGE_CAP. Values iterate oldest→newest, so the low entries to
  // drop are the oldest ones beyond the cap.
  const all = Array.from(byPhrase.values());
  const low = all.filter((e) => (CHARGE_RANK[e.charge] ?? 0) === 0);
  if (low.length <= LOW_CHARGE_CAP) return all;
  const evict = new Set(low.slice(0, low.length - LOW_CHARGE_CAP));
  return all.filter((e) => !evict.has(e));
}

/**
 * Merge a freshly-parsed extraction payload with the prior state. Pure and
 * exported so the merge rules — monotonic distinct_contexts, language-bank
 * accumulation, depth high-water mark — are unit-testable without an
 * Anthropic call. `parsed` is the raw JSON.parse() of the model's output.
 */
export function mergeExtractionState(
  // Raw JSON.parse() output from the model — genuinely untyped; the body runs
  // its own runtime type checks (typeof guards) before trusting any field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any,
  state: ExtractionState
): ExtractionState {
  // Monotonic enforcement on distinct_contexts. Sonnet sometimes re-evaluates
  // from a smaller window and returns a lower count than a prior turn even
  // when no evidence was walked back; previousState is the authoritative
  // high-water mark, so take max().
  const mergedGate = (() => {
    const incoming = parsed.checkpoint_gate;
    if (!incoming || typeof incoming !== "object") {
      return state.checkpoint_gate;
    }
    const prevContexts = state.checkpoint_gate.distinct_contexts ?? 0;
    const incomingContexts =
      typeof incoming.distinct_contexts === "number"
        ? incoming.distinct_contexts
        : prevContexts;
    // distinct_contexts is monotonic (never regress the high-water mark). It's
    // the only surviving gate field — read at save time by the composer.
    return { distinct_contexts: Math.max(incomingContexts, prevContexts) };
  })();

  // Monotonic depth — the same regression guard the gate counts get above.
  // Sonnet can re-read a calm exchange from a smaller window and report a
  // shallower depth than the conversation already reached; DEPTH_LEVELS is the
  // ordered shallow→deep scale, so keep whichever index is higher. An absent or
  // invalid parsed.depth (indexOf === -1) falls back to prior state, preserving
  // the old `parsed.depth || state.depth` fallback while never regressing.
  const mergedDepth = (() => {
    const incomingIdx = DEPTH_LEVELS.indexOf(parsed.depth);
    const prevIdx = DEPTH_LEVELS.indexOf(state.depth);
    return incomingIdx > prevIdx ? parsed.depth : state.depth;
  })();

  return {
    // Accumulate (union) the language bank, don't replace — a charged phrase
    // captured earlier must not silently drop out when a later small-window
    // extraction returns a smaller set (see mergeLanguageBank). Each entry's
    // layer ids are coerced to numbers at the boundary (toLayerNumber); a
    // non-array payload contributes nothing, so prior phrases are preserved.
    language_bank: mergeLanguageBank(
      state.language_bank,
      Array.isArray(parsed.language_bank)
        ? parsed.language_bank.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => ({ ...e, layers: coerceLayerList(e?.layers) })
          )
        : []
    ),
    depth: mergedDepth,
    current_thread: parsed.current_thread || state.current_thread,
    checkpoint_gate: mergedGate,
    clinical_flag: parsed.clinical_flag || state.clinical_flag,
    sage_brief: parsed.sage_brief || "",
  };
}

export async function runExtraction(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  previousState: ExtractionState | null,
  manualComponents: ManualEntry[],
  // Retained for signature stability across call sites; the first-checkpoint
  // lighter gate was retired 2026-06-12 (one bar for every checkpoint).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isFirstCheckpoint: boolean
): Promise<ExtractionState> {
  const state = previousState || defaultState();

  let userContent = "";

  userContent += "PREVIOUS EXTRACTION STATE:\n";
  userContent += JSON.stringify({
    language_bank: state.language_bank,
    depth: state.depth,
    current_thread: state.current_thread,
    checkpoint_gate: state.checkpoint_gate,
  });
  userContent += "\n\n";

  if (manualComponents.length > 0) {
    userContent +=
      "CONFIRMED MANUAL ENTRIES (context for threading only — do NOT extract these into language_bank; capture only what the user says in the conversation below):\n";
    for (const comp of manualComponents) {
      userContent += renderManualEntryFull(comp) + "\n";
    }
  }

  const recentHistory = conversationHistory.slice(-EXTRACTION_MESSAGE_WINDOW);
  userContent += "RECENT CONVERSATION:\n";
  for (const msg of recentHistory) {
    userContent += `${msg.role}: ${msg.content}\n\n`;
  }

  userContent += "Analyze the latest exchange and produce the updated extraction state.";

  try {
    // The EXTRACTION_SYSTEM constant is hefty (the five-layer model, all
    // analysis priorities, the JSON shape) and is identical across every
    // extraction call. Mark it as the cache prefix so subsequent turns
    // pay the cheap 0.10x cache-read price on it instead of the full
    // input rate. The user content stays uncached — that's the per-turn
    // payload.
    const response = await anthropicFetch({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: EXTRACTION_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    logEvent({
      event: "cache_performance",
      surface: "extraction",
      model: EXTRACTION_MODEL,
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      cache_creation_input_tokens: response.usage?.cache_creation_input_tokens,
      cache_read_input_tokens: response.usage?.cache_read_input_tokens,
    });

    const cleaned = extractResponseText(response)
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Detect truncated JSON (brace/bracket mismatch)
    const opens = (cleaned.match(/[{[]/g) || []).length;
    const closes = (cleaned.match(/[}\]]/g) || []).length;
    if (opens > closes) {
      console.error(
        "[extraction] Truncated JSON detected (opens: %d, closes: %d), falling back to previous state",
        opens,
        closes
      );
      return { ...state, sage_brief: "" };
    }

    const parsed = JSON.parse(cleaned);

    return mergeExtractionState(parsed, state);
  } catch (err) {
    // Re-throw so fireBackgroundExtraction's .catch handles the failure
    // without writing a degraded state over the prior good one. Previous
    // behavior returned `{...state, sage_brief: ""}`, which
    // wiped the prior turn's working brief and degraded Jove's next turn on
    // top of the underlying error. Logs stay under the [extraction] prefix
    // so existing ops queries continue to match.
    console.error("[extraction] Failed:", err);
    throw err;
  }
}
