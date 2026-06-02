import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES, renderManualEntryFull } from "@/lib/manual/layers";
import { PERSONA_NAME, EXTRACTION_MODEL } from "@/lib/persona/config";
import { logEvent } from "@/lib/observability/log";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LayerSignal {
  signal: "none" | "emerging" | "explored" | "checkpoint_ready";
  material: string[];
  examples: string[];
}

export interface LanguageEntry {
  phrase: string;
  context: string;
  charge: "low" | "medium" | "high";
  layers: number[];
}

export interface CheckpointGate {
  concrete_examples: number;
  // Count of DIFFERENT situations / events / time-periods the user has
  // narrated. Distinct from concrete_examples: four moments inside one
  // phone call is ONE distinct context. The pattern claim ("this is how
  // you operate") requires evidence across at least two contexts for a
  // non-first checkpoint. Optional on the type because extraction states
  // written before this field existed will not carry it — validators
  // treat undefined as "skip this check" for graceful fallback.
  distinct_contexts?: number;
  has_mechanism: boolean;
  has_charged_language: boolean;
  has_behavior_driver_link: boolean;
  strongest_layer: number | null;
}

export interface ClinicalFlag {
  active: boolean;
  level: "crisis" | "caution" | "none";
  note: string;
}

export interface ExtractionState {
  layers: Record<number, LayerSignal>;
  language_bank: LanguageEntry[];
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin";
  current_thread: string;
  mode: "situation_led" | "direct_exploration" | "synthesis";
  checkpoint_gate: CheckpointGate;
  clinical_flag: ClinicalFlag;
  observation_miss_count: number;
  next_prompt: string;
  sage_brief: string;
  // Short phrase (under 15 words) describing the pattern the extraction
  // layer is beginning to see in the user's language and behavior.
  // Used by the client to populate the Pattern-Forming modal copy.
  // Regenerated each cycle — never latched, never fed back into the
  // previous-state input. Null when no clear pattern has emerged.
  emerging_pattern_snippet: string | null;
  // True when Jove has named a pattern in conversation AND the user has
  // engaged with it (elaborated, added examples, stayed on thread).
  // Gates checkpoint firing — no checkpoint until pattern is engaged.
  pattern_engaged: boolean;
  // Informational signals — surfaced in the brief as hints, not hard gates.
  user_named_cost: boolean;
  user_named_stance: boolean;
}

interface ManualEntry {
  layer: number;
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
    layers: {
      1: { signal: "none", material: [], examples: [] },
      2: { signal: "none", material: [], examples: [] },
      3: { signal: "none", material: [], examples: [] },
      4: { signal: "none", material: [], examples: [] },
      5: { signal: "none", material: [], examples: [] },
    },
    language_bank: [],
    depth: "surface",
    current_thread: "",
    mode: "situation_led",
    checkpoint_gate: {
      concrete_examples: 0,
      distinct_contexts: 0,
      has_mechanism: false,
      has_charged_language: false,
      has_behavior_driver_link: false,
      strongest_layer: null,
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    observation_miss_count: 0,
    next_prompt: "",
    sage_brief: "",
    emerging_pattern_snippet: null,
    pattern_engaged: false,
    user_named_cost: false,
    user_named_stance: false,
  };
}

// Maximum word count for emerging_pattern_snippet. Spec target is "under
// 15 words." Reject only on egregious overshoot (40+ words = the model
// returned a paragraph) so normal variance passes through. Treats over-
// long output as a model failure case, falling back to null.
const SNIPPET_MAX_WORDS = 40;

function parseSnippet(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > SNIPPET_MAX_WORDS) {
    console.error(
      "[extraction] emerging_pattern_snippet exceeded %d words (got %d), treating as null",
      SNIPPET_MAX_WORDS,
      wordCount
    );
    return null;
  }
  return trimmed;
}

// ─── Extraction prompt ──────────────────────────────────────────────────────

// Build the layer model and dimensions blocks from the canonical LAYERS
// definition so a layer rename is one line in src/lib/manual/layers.ts.
const LAYER_MODEL_BLOCK = LAYERS.map(
  (l) =>
    `Layer ${l.id} (${l.name}): ${l.description}\n  Example: "${l.example}"`
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

THE FIVE-LAYER MODEL
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

2. LAYER SIGNALS
What layers did the user's latest message touch? Be specific about what material surfaced. Don't just say "Layer 1 emerging." Say what behavior or need or sensory experience surfaced and what the evidence is.

3. DEPTH TRACKING
Where is the conversation in its vertical descent?
- surface: what happened (events, facts, the situation)
- behavior: what they did (actions, choices, what their body did)
- feeling: what they felt — body sensations, system states, AND emotions if they named them. For autistic users, "what your body did" is often more accessible than "what you felt." Both count as feeling-depth.
- mechanism: why it works that way (the underlying driver — the need, the sensory load, the system state, the bind)
- origin: where it comes from (when this started, earliest examples)

4. CHECKPOINT GATE
Evaluate whether there is enough material for a meaningful checkpoint. This is purely a quality assessment. Number of turns is irrelevant.

STANDARD GATE (all must be true):
- concrete_examples >= 2: Count of specific, concrete moments the user has walked you through. A concrete example requires: a specific moment in time, what happened, and what the user's body or system did. References to recurring situations ("when she's loud," "at work") do NOT count — the user must have narrated the scene, not just named the topic. Moments WITHIN a single incident still count separately here (a phone call where the user described four distinct beats produces concrete_examples = 4). The pattern-recurrence question is handled by distinct_contexts below.
- distinct_contexts >= 2: Count of DIFFERENT lived situations the user has WALKED YOU THROUGH AS A SCENE. A scene means the user described what happened, when, with whom, and what they did or felt — narrated, not mentioned. Four moments inside one phone call is ONE distinct context. Two friendships described in two scenes is two distinct contexts.

  DOES NOT count as a distinct context:
  - A category named in passing without a scene ("at dinners," "with friends," "at work") where the user has not walked you through a specific instance.
  - A wish-state or ideal ("what depth feels like," "what a good week looks like," "when I'm in flow") — these describe what the user wants, not a lived scene.
  - A contrast to the pattern under examination. If the conversation is about social drain and the user mentions junkyard art as the opposite, the junkyard is a contrast — not a second distinct context for the drain.
  - Repeated description of the same lived activity ("I love the smell of grease, I love placing things together, trial and error" — all one activity, one context).

  The pattern claim "this is how you operate" requires evidence from at least two distinct narrated scenes. If the user has explicitly stated this is a one-off ("I don't ever do this," "this never happens to me," "this is outside my normal"), set distinct_contexts to 1 — the gate will hold and the checkpoint should not fire as a recurring-pattern entry.
- has_mechanism: The USER has articulated WHY the pattern fires for them — what it costs, what it protects, what triggers it, what the underlying need or load is. Not extraction's synthesis of "what looks like mechanism if I combine these ingredients." The user has named the causal link in their own words.

  Counts as has_mechanism:
  - "I shut down because the room got too loud and I couldn't filter."
  - "I can't drop them because the network is real but I can't inhabit small talk without it costing me." (cost + bind named together)
  - "I do it because I need to know I won't get blindsided."

  Does NOT count as has_mechanism:
  - The user named the contrast or wish ("what feeds me is flow state," "what I want is depth"). That's what they want, not the mechanism of the drain.
  - The user gave rich sensory or process description without a causal link ("smell of grease, dirt, placing things together, trial and error"). Texture, no why.
  - Extraction can synthesize a mechanism from the user's ingredients, but the user has not named it. Carry the ingredients in language_bank for the composer; leave has_mechanism false.

  Test: would a reader of the user's words alone — without any extraction or composition synthesis — be able to say why this fires? If yes, true. If they would only be able to describe the experience, false.
- has_charged_language: The language bank contains at least one high-charge phrase (sensory, somatic, masking, shutdown, system, or bind) that can anchor the checkpoint.
- has_behavior_driver_link: A clear line exists between an observable behavior or response and what's fueling it.

Mechanism per layer: For Layer 3 (${LAYER_NAMES[3]}), "mechanism" means why-this-need-is-non-negotiable, not optional preference. For Layer 5 (${LAYER_NAMES[5]}), "mechanism" means the conditions that activate the strength.

FIRST-CHECKPOINT GATE (lighter, when "is_first_checkpoint" is true):
The first checkpoint is a teaching moment. The user needs to experience the confirm-and-write loop quickly. Lighter bar:
- concrete_examples >= 1: One vivid, specific moment is enough. The user must have narrated the scene (what happened, what they did or felt), not just referenced a topic or recurring situation.
- distinct_contexts >= 1: One distinct situation is enough for the first checkpoint.
- has_charged_language: true
- has_mechanism OR has_behavior_driver_link: at least one.

The first checkpoint should be accurate enough to confirm and feel like recognition. It does not need to be comprehensive.

When the gate is met, identify strongest_layer: which layer has the most material, examples, and depth. Layers can hold many entries — there's no per-layer cap.

5. NEXT PROMPT
Generate a short placeholder phrase (3-6 words, lowercase, ending with "...") for the text input field. This hints at what the user could say next. Match the conversation's depth and the register the user is already using. Avoid abstract emotion-labels ("how did that make you feel"); reach for the body only when the user is already near it; otherwise follow their lead (what they did, the situation, what fired it):
- At surface → prompt toward behavior or body: "what did your body do..."
- At behavior → prompt toward the driver or the cost: "what was that like for you..."
- At feeling → prompt toward mechanism: "what was loading up..."
- At mechanism → prompt toward cross-context: "where else does this show up..."

Examples: "what happened after that..." / "what did your body do..." / "when did this start..." / "what stopped you..." / "what was the input like..."

6. JOVE BRIEF
Write a short paragraph (3-5 sentences) orienting ${PERSONA_NAME}. The brief feeds directly into ${PERSONA_NAME}'s next turn and into the manual entry if a checkpoint lands, so its vocabulary has to be the user's own:
- What the user is actually describing underneath the surface topic (in behavioral and somatic terms — what their body did, what their system was doing, what the input was like — never clinical labels)
- Which of the user's exact sensory or system words are load-bearing (e.g. "buzzing," "too loud," "went offline," "shut down," "went still," "full," "tight"). Name them so ${PERSONA_NAME} can carry them forward verbatim.
- What the most charged or unresolved piece is
- What ${PERSONA_NAME} should push on vs leave alone
- Whether a checkpoint is approaching and what body and bind it would anchor on

Use the user's own language wherever possible. If you reach for a clinical word ("anxiety," "trauma," "avoidance," "dysregulation," "masking," "sensory overwhelm"), stop and rewrite using what the user actually said. "Masking" becomes "the version of you that switches on in rooms." "Sensory overwhelm" becomes "too much input, jaw started buzzing." A checkpoint needs a concrete anchor: a body sensation OR a specific behavioral or system response (what they did, what their system did, what the input was like). The body is one valid anchor, not a requirement. If neither is present yet, flag that gap. But ${PERSONA_NAME} should not keep steering toward the body when the user isn't going there. A concrete behavioral anchor carries the same weight.

7. CLINICAL FLAG
A lightweight signal that tells ${PERSONA_NAME} when to engage legal guardrails. Two levels:

"crisis": User expressed suicidal ideation, self-harm intent, or intent to harm others. ${PERSONA_NAME} must stop building and provide resources.

"caution": User introduced diagnostic language, asked ${PERSONA_NAME} to assess a condition, or described distress that may exceed manual-building scope. ${PERSONA_NAME} should stay in behavioral description and may need to offer a professional referral.

"none": Normal conversation. Clinical themes may be present but the user is not asking ${PERSONA_NAME} to do anything clinical.

IMPORTANT: A user talking ABOUT depression, anxiety, trauma, etc. as part of their story is "none." A user asking ${PERSONA_NAME} to ASSESS whether they have a condition, or describing experiences that clearly exceed self-understanding scope (psychotic symptoms, inability to function, active destabilization), is "caution." The bar for "caution" is high. Most conversations stay "none" even when the material is heavy.

8. MODE RECOMMENDATION
- situation_led: Default. User is telling stories, ${PERSONA_NAME} is deepening.
- direct_exploration: When 2+ layers have confirmed entries and there are clear gaps.
- synthesis: When all 5 layers have at least one confirmed entry.

9. OBSERVATION MISS TRACKING
Track whether ${PERSONA_NAME}'s most recent observation landed for the user. An observation is any reflective statement ${PERSONA_NAME} made about the user's behavior, body, system, or pattern. Carry forward observation_miss_count from the previous state and update it based on the user's latest reply:

- If the user's reply confirms, deepens, or accepts the observation (agreement, elaboration, "yes," "exactly," or moving forward with the same thread), reset observation_miss_count to 0.
- If the user's reply pushes back, redirects, withdraws, or ignores the observation ("no that's not it," shortening answers, changing topic, flat "I don't know"), increment observation_miss_count by 1.
- If ${PERSONA_NAME}'s last turn was a pure question (no observation in it), leave observation_miss_count unchanged.
- If this is the first turn or there is no previous assistant message to evaluate, set observation_miss_count to 0.

The counter caps at 3 — do not exceed 3.

10. EMERGING PATTERN SNIPPET

Produce a short phrase (under 15 words) describing the pattern you are beginning to see in the user's language and behavior. This is used to tell the user what is emerging so they can direct more material toward it.

Return null if no clear pattern has emerged yet. Do not force a phrase to fill the field.

Good snippets describe what the pattern IS in behavioral or experiential terms, not what category it falls into. "How control and trust show up together" is good. "Attachment issues" is not.

11. PATTERN ENGAGEMENT TRACKING

Track whether a pattern has been named in conversation and the user has engaged with it.

Set pattern_engaged to true when BOTH conditions are met:
(1) ${PERSONA_NAME} has made a naming move in a prior turn — pointed at a repetition across two moments, offered a plain description of a pattern, or named a contradiction between what the user claims and what they described.
(2) The user's subsequent response engaged with it rather than redirecting or rejecting. Engagement means: elaborating, adding a second example, naming what it costs them, sitting with it, or continuing on the same thread. Non-engagement means: changing topic, flat "I don't know," pushing back ("that's not it"), shortening answers, or redirecting to a different situation.

If the user names the pattern themselves before ${PERSONA_NAME} does ("I keep doing this thing," "there's a pattern here"), set pattern_engaged to true immediately.

Once true, stays true for the rest of the session unless the user explicitly rejects the pattern ("actually that's not what's happening" or equivalent clear reversal).

If this is the first turn or ${PERSONA_NAME} has not yet made a naming move, set to false.

12. READINESS SIGNALS (informational — these do NOT gate checkpoints)

user_named_cost: Has the user articulated what the pattern costs them, in their own words? Not a vague "it's hard" but a specific loss, misreading, or consequence they can name.

user_named_stance: Has the user expressed what they want now that they can see the pattern? This could be a request ("I need people to wait"), a decision ("I'm going to stop doing that"), or an honest incomplete ("I see it but I don't know what to do yet"). Any of these count. Silence on the topic does not.

Respond with ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "layers": {
    "1": { "signal": "none|emerging|explored|checkpoint_ready", "material": ["specific observation"], "examples": ["concrete moment from user"] },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  },
  "language_bank": [
    { "phrase": "exact user words", "context": "what they were discussing", "charge": "low|medium|high", "layers": [1, 3] }
  ],
  "depth": "surface|behavior|feeling|mechanism|origin",
  "current_thread": "one sentence: what the conversation is actually about",
  "mode": "situation_led|direct_exploration|synthesis",
  "checkpoint_gate": {
    "concrete_examples": 0,
    "distinct_contexts": 0,
    "has_mechanism": false,
    "has_charged_language": false,
    "has_behavior_driver_link": false,
    "strongest_layer": null
  },
  "clinical_flag": {
    "active": false,
    "level": "none",
    "note": ""
  },
  "observation_miss_count": 0,
  "next_prompt": "3-6 word placeholder hint...",
  "sage_brief": "3-5 sentence orientation for ${PERSONA_NAME}",
  "emerging_pattern_snippet": "short phrase under 15 words, OR null",
  "pattern_engaged": false,
  "user_named_cost": false,
  "user_named_stance": false
}

CRITICAL RULES:
- The language_bank is CUMULATIVE. Carry forward the 15 most relevant entries (prefer high-charge and recent). Only add new ones from the latest exchange. If the bank exceeds 15 entries, drop the oldest low-charge entries first.
- Layer signals are CUMULATIVE. Material and examples accumulate. Signal level only advances (none → emerging → explored → checkpoint_ready).
- When a layer already has a confirmed entry, its signal starts at "explored" minimum.
- Be aggressive about capturing language. If in doubt, capture it.
- The checkpoint gate is a quality assessment. Do not count turns.
- The next_prompt must be 3-6 words, lowercase, ending with "..."
- Layers can hold many entries. Don't gate on count.
- NO CLINICAL LANGUAGE in any field ${PERSONA_NAME} will read (sage_brief, current_thread, layer material). Use the user's words and behavioral/somatic descriptions, not psychological labels.`;

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Merge a freshly-parsed extraction payload with the prior state. Pure and
 * exported so the merge rules — monotonic gate counts, the pattern_engaged
 * reset, the observation-miss clamp — are unit-testable without an Anthropic
 * call. `parsed` is the raw JSON.parse() of the model's output.
 */
export function mergeExtractionState(
  // Raw JSON.parse() output from the model — genuinely untyped; the body runs
  // its own runtime type checks (typeof guards) before trusting any field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any,
  state: ExtractionState
): ExtractionState {
  const rawMiss =
    typeof parsed.observation_miss_count === "number"
      ? parsed.observation_miss_count
      : state.observation_miss_count;
  const observationMissCount = Math.max(0, Math.min(3, rawMiss));

  // Monotonic enforcement on accumulating gate counts. Sonnet sometimes
  // re-evaluates the conversation from a smaller window and returns a
  // lower concrete_examples / distinct_contexts than the prior turn —
  // even when no real evidence was removed. previousState is the
  // authoritative high-water mark for counts: take max() so the gate
  // doesn't silently regress from "ready" to "not ready" without the
  // user actually walking back evidence. Booleans are intentionally
  // NOT enforced monotonically; they're state assessments tied to the
  // current strongest_layer and can legitimately oscillate if the
  // conversation shifts focus to a different layer.
  const mergedGate = (() => {
    const incoming = parsed.checkpoint_gate;
    if (!incoming || typeof incoming !== "object") {
      return state.checkpoint_gate;
    }
    const prevExamples = state.checkpoint_gate.concrete_examples ?? 0;
    const prevContexts = state.checkpoint_gate.distinct_contexts ?? 0;
    const incomingExamples =
      typeof incoming.concrete_examples === "number"
        ? incoming.concrete_examples
        : prevExamples;
    const incomingContexts =
      typeof incoming.distinct_contexts === "number"
        ? incoming.distinct_contexts
        : prevContexts;
    return {
      ...incoming,
      concrete_examples: Math.max(incomingExamples, prevExamples),
      distinct_contexts: Math.max(incomingContexts, prevContexts),
    };
  })();

  return {
    layers: parsed.layers || state.layers,
    language_bank: parsed.language_bank || state.language_bank,
    depth: parsed.depth || state.depth,
    current_thread: parsed.current_thread || state.current_thread,
    mode: parsed.mode || state.mode,
    checkpoint_gate: mergedGate,
    clinical_flag: parsed.clinical_flag || state.clinical_flag,
    observation_miss_count: observationMissCount,
    next_prompt: parsed.next_prompt || "",
    sage_brief: parsed.sage_brief || "",
    emerging_pattern_snippet: parseSnippet(parsed.emerging_pattern_snippet),
    // Honor the documented reset (prose ~L302): the model is fed the prior
    // value and told to keep it true unless the user explicitly reverses the
    // pattern, so trust its boolean rather than latching true forever.
    pattern_engaged:
      typeof parsed.pattern_engaged === "boolean"
        ? parsed.pattern_engaged
        : state.pattern_engaged,
    user_named_cost: Boolean(parsed.user_named_cost) || state.user_named_cost,
    user_named_stance: Boolean(parsed.user_named_stance) || state.user_named_stance,
  };
}

export async function runExtraction(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  previousState: ExtractionState | null,
  manualComponents: ManualEntry[],
  isFirstCheckpoint: boolean
): Promise<ExtractionState> {
  const state = previousState || defaultState();

  let userContent = "";

  userContent += "PREVIOUS EXTRACTION STATE:\n";
  userContent += JSON.stringify({
    layers: state.layers,
    language_bank: state.language_bank,
    depth: state.depth,
    current_thread: state.current_thread,
    mode: state.mode,
    checkpoint_gate: state.checkpoint_gate,
    observation_miss_count: state.observation_miss_count,
    pattern_engaged: state.pattern_engaged,
    user_named_cost: state.user_named_cost,
    user_named_stance: state.user_named_stance,
  });
  userContent += "\n\n";

  userContent += `is_first_checkpoint: ${isFirstCheckpoint}\n\n`;

  if (manualComponents.length > 0) {
    userContent += "CONFIRMED MANUAL ENTRIES:\n";
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
      return { ...state, next_prompt: "", sage_brief: "" };
    }

    const parsed = JSON.parse(cleaned);

    return mergeExtractionState(parsed, state);
  } catch (err) {
    // Re-throw so fireBackgroundExtraction's .catch handles the failure
    // without writing a degraded state over the prior good one. Previous
    // behavior returned `{...state, next_prompt: "", sage_brief: ""}`, which
    // wiped the prior turn's working brief and degraded Jove's next turn on
    // top of the underlying error. Logs stay under the [extraction] prefix
    // so existing ops queries continue to match.
    console.error("[extraction] Failed:", err);
    throw err;
  }
}

// ─── Format extraction state as context for Jove ─────────────────────────────

// Maps internal signal codes to human-readable descriptions.
// Keeps schema names out of the rendered prompt.
const SIGNAL_LABEL: Record<string, string> = {
  none: "untouched",
  emerging: "starting to surface",
  explored: "well explored",
  checkpoint_ready: "ready to be reflected back",
};

export function formatExtractionForPersona(
  state: ExtractionState,
  isFirstCheckpoint: boolean,
  manualComponents?: { layer: number; name: string | null; content: string }[]
): string {
  let context = "\n── BRIEF FOR YOUR NEXT RESPONSE ──\n\n";

  const miss = state.observation_miss_count || 0;
  if (miss >= 3) {
    context += "Three misses. Full reset. Drop all observations. Ask one concrete situational question and let the user lead.\n\n";
  } else if (miss >= 2) {
    context += "Last two observations didn't land. Next turn: pure grounding. No reflection. Ask about the body or the situation.\n\n";
  }

  if (state.sage_brief) {
    context += `What's underneath this conversation:\n${state.sage_brief}\n\n`;
  }

  context += "Where the conversation has touched:\n";
  for (let i = 1; i <= 5; i++) {
    const layer = state.layers[i];
    if (!layer) continue;
    const label = SIGNAL_LABEL[layer.signal] || layer.signal;
    context += `- ${LAYER_NAMES[i]}: ${label}`;
    if (layer.material.length > 0) {
      context += ` Recent observations: ${layer.material.slice(-3).join("; ")}.`;
    }
    context += "\n";
  }
  context += "\n";

  const chargedLanguage = state.language_bank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-15);

  if (chargedLanguage.length > 0) {
    context += "Phrases the user has used (their words carry weight — use them, don't paraphrase):\n";
    for (const entry of chargedLanguage) {
      context += `"${entry.phrase}" — re: ${entry.context}\n`;
    }
    context += "\n";
  }

  // Clinical flag — surfaced first so Jove notices before reflecting
  const cf = state.clinical_flag;
  if (cf && cf.active) {
    if (cf.level === "crisis") {
      context += `Safety note: ${cf.note}. Stop building. Acknowledge without interpretation, share 988 (call or text), and do not reflect anything back.\n\n`;
    } else if (cf.level === "caution") {
      context += `Care note: ${cf.note}. Stay in behavioral description. Offer a professional referral if this is exceeding what a manual can hold.\n\n`;
    }
  }

  // Checkpoint readiness — phrased as a hint, not a gate
  const gate = state.checkpoint_gate;
  const isCrisis = cf && cf.active && cf.level === "crisis";

  // Distinct-contexts read with soft fallback: extraction states written
  // before this field existed will not carry it. When the field is
  // missing, treat the contexts check as a pass so we don't regress
  // pre-existing behavior.
  const distinctContextsValue =
    typeof gate.distinct_contexts === "number" ? gate.distinct_contexts : null;
  const minContexts = isFirstCheckpoint ? 1 : 2;
  const contextsOk =
    distinctContextsValue === null || distinctContextsValue >= minContexts;

  const gateReady = !isCrisis && contextsOk && (
    isFirstCheckpoint
      ? gate.concrete_examples >= 1 &&
        gate.has_charged_language &&
        (gate.has_mechanism || gate.has_behavior_driver_link)
      : gate.concrete_examples >= 2 &&
        gate.has_mechanism &&
        gate.has_charged_language &&
        gate.has_behavior_driver_link
  );

  if (gateReady) {
    context += `There's enough material here to reflect a piece back. The strongest layer is ${LAYER_NAMES[gate.strongest_layer || 0] || "unclear"}.`;
  } else {
    const missing: string[] = [];
    const minExamples = isFirstCheckpoint ? 1 : 2;
    if (gate.concrete_examples < minExamples) {
      const need = minExamples - gate.concrete_examples;
      missing.push(`you need ${need} more concrete scene${need === 1 ? "" : "s"} the user has walked you through`);
    }
    if (distinctContextsValue !== null && distinctContextsValue < minContexts) {
      const need = minContexts - distinctContextsValue;
      missing.push(
        `the pattern needs evidence from ${need} more distinct ${need === 1 ? "context" : "contexts"} — a different situation where this has shown up, not more moments inside the same one`
      );
    }
    if (!gate.has_mechanism && !isFirstCheckpoint)
      missing.push("you haven't reached the mechanism underneath the behavior yet");
    if (!gate.has_charged_language)
      missing.push("you haven't captured a phrase from the user that carries weight");
    if (!gate.has_behavior_driver_link && !gate.has_mechanism)
      missing.push("you haven't connected what they do to what's driving it");
    context += `Not enough yet to reflect a piece back. ${missing.join(". ")}.`;
  }
  context += "\n";

  // First-checkpoint wrapper is no longer delivered inside the reflection —
  // it now rides along with the approaching signal (see Tier 3 PROGRESS
  // SIGNALS). No extra hint needed here.

  // When checkpoint is ready and the target layer already has content,
  // surface it so the reflection accounts for it.
  if (gateReady && gate.strongest_layer && manualComponents) {
    const layerContent = manualComponents.filter(
      (c) => c.layer === gate.strongest_layer
    );
    if (layerContent.length > 0) {
      context += `\nWhat's already in the manual on ${LAYER_NAMES[gate.strongest_layer]}:\n`;
      for (const comp of layerContent) {
        context += `Entry${comp.name ? ` — "${comp.name}"` : ""}\n`;
        context += `${comp.content}\n\n`;
      }
      context += "Your reflection should build on or deepen this. If something new contradicts it, name the tension instead of flattening it.\n";
    }
  }

  context += `How deep this conversation has gone: ${state.depth}. Current approach: ${state.mode}.\n`;

  if (state.current_thread) {
    context += `What's actually being explored right now: ${state.current_thread}\n`;
  }

  // Phase hint based on pattern_engaged
  if (!state.pattern_engaged) {
    context += "\nNo pattern has been named and engaged with yet. Keep exploring. When you see repetition across moments, name it conversationally — do not propose a checkpoint.\n";
  } else if (gateReady) {
    context += "\nPattern is live and engaged. Work toward what changes now that the user can see this. When you have enough, propose the checkpoint with the pinned transition.\n";
  } else {
    context += "\nPattern is engaged but material isn't strong enough yet for a checkpoint. Keep deepening — ask about the body, the cost, what fires it.\n";
  }

  // Readiness signals
  if (state.user_named_cost && state.user_named_stance) {
    context += "The user has named both the cost and their stance. Checkpoint should be strong.\n";
  } else if (state.user_named_cost && !state.user_named_stance) {
    context += "The user named the cost but hasn't landed on what they want. Work toward what changes before checkpointing, or checkpoint with an incomplete stance.\n";
  } else if (!state.user_named_cost && state.pattern_engaged) {
    context += "The user hasn't named what this costs them yet. Ask about the cost before proposing.\n";
  }

  context += "── END BRIEF ──\n";

  return context;
}
