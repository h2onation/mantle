import { anthropicFetch } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES } from "@/lib/manual/layers";
import { PERSONA_NAME } from "@/lib/persona/config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LayerSignal {
  signal: "none" | "emerging" | "explored" | "checkpoint_ready";
  material: string[];
  examples: string[];
  dimensions: string[];
}

export interface LanguageEntry {
  phrase: string;
  context: string;
  charge: "low" | "medium" | "high";
  layers: number[];
}

export interface CheckpointGate {
  concrete_examples: number;
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
  next_prompt: string;
  sage_brief: string;
}

interface ManualComponent {
  layer: number;
  name: string | null;
  content: string;
}

// ─── Default state ───────────────────────────────────────────────────────────

function defaultState(): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [], dimensions: [] },
      2: { signal: "none", material: [], examples: [], dimensions: [] },
      3: { signal: "none", material: [], examples: [], dimensions: [] },
      4: { signal: "none", material: [], examples: [], dimensions: [] },
      5: { signal: "none", material: [], examples: [], dimensions: [] },
    },
    language_bank: [],
    depth: "surface",
    current_thread: "",
    mode: "situation_led",
    checkpoint_gate: {
      concrete_examples: 0,
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
    next_prompt: "",
    sage_brief: "",
  };
}

// ─── Extraction prompt ──────────────────────────────────────────────────────

// Build the layer model and dimensions blocks from the canonical LAYERS
// definition so a layer rename is one line in src/lib/manual/layers.ts.
const LAYER_MODEL_BLOCK = LAYERS.map(
  (l) =>
    `Layer ${l.id} (${l.name}): ${l.description}\n  Example: "${l.example}"`
).join("\n");

const DIMENSIONS_BLOCK = LAYERS.map(
  (l) => `- Layer ${l.id}: ${l.dimensions.join(", ")}`
).join("\n");

const EXTRACTION_SYSTEM = `You are the extraction layer for a conversational AI called ${PERSONA_NAME} that builds behavioral models for late-diagnosed autistic adults. You run silently before ${PERSONA_NAME} responds. Your job is to analyze what the user just said and produce structured context so ${PERSONA_NAME} can have a deeper, more grounded conversation.

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
- Sensory language: buzzing, loud, heavy, full, too close, crashed, tight, bright, sharp
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

Track dimensions within each layer:
${DIMENSIONS_BLOCK}

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
- concrete_examples >= 2: At least two specific, concrete moments from the user's life (not abstract claims like "I'm always overloaded" but real situations they walked through). A concrete example requires: a specific moment in time, what happened, and what the user's body or system did. References to recurring situations ("when she's loud," "at work") do NOT count. The user must have narrated the scene, not just named the topic.
- has_mechanism: The conversation has reached WHY, not just WHAT. There's a connection between an observed behavior or state and an underlying driver — a need, a sensory load, a system state, a bind.
- has_charged_language: The language bank contains at least one high-charge phrase (sensory, somatic, masking, shutdown, system, or bind) that can anchor the checkpoint.
- has_behavior_driver_link: A clear line exists between an observable behavior or response and what's fueling it.

Mechanism per layer: For Layer 3 (${LAYER_NAMES[3]}), "mechanism" means why-this-need-is-non-negotiable, not optional preference. For Layer 5 (${LAYER_NAMES[5]}), "mechanism" means the conditions that activate the strength.

FIRST-CHECKPOINT GATE (lighter, when "is_first_checkpoint" is true):
The first checkpoint is a teaching moment. The user needs to experience the confirm-and-write loop quickly. Lighter bar:
- concrete_examples >= 1: One vivid, specific moment is enough. The user must have narrated the scene (what happened, what they did or felt), not just referenced a topic or recurring situation.
- has_charged_language: true
- has_mechanism OR has_behavior_driver_link: at least one.

The first checkpoint should be accurate enough to confirm and feel like recognition. It does not need to be comprehensive.

When the gate is met, identify strongest_layer: which layer has the most material, examples, and depth. Layers can hold many entries — there's no per-layer cap.

5. NEXT PROMPT
Generate a short placeholder phrase (3-6 words, lowercase, ending with "...") for the text input field. This hints at what the user could say next. Match the conversation's depth and prefer somatic openings over emotional ones:
- At surface → prompt toward behavior or body: "what did your body do..."
- At behavior → prompt toward sensation or system: "what did that feel like in you..."
- At feeling → prompt toward mechanism: "what was loading up..."
- At mechanism → prompt toward cross-context: "where else does this show up..."

Examples: "what happened after that..." / "what did your body do..." / "when did this start..." / "what stopped you..." / "what was the input like..."

6. SAGE BRIEF
Write a short paragraph (3-5 sentences) orienting ${PERSONA_NAME}. The brief feeds directly into ${PERSONA_NAME}'s next turn and into the manual entry if a checkpoint lands, so its vocabulary has to be the user's own:
- What the user is actually describing underneath the surface topic (in behavioral and somatic terms — what their body did, what their system was doing, what the input was like — never clinical labels)
- Which of the user's exact sensory or system words are load-bearing (e.g. "buzzing," "too loud," "went offline," "shut down," "went still," "full," "tight"). Name them so ${PERSONA_NAME} can carry them forward verbatim.
- What the most charged or unresolved piece is
- What ${PERSONA_NAME} should push on vs leave alone
- Whether a checkpoint is approaching and what body and bind it would anchor on

Use the user's own language wherever possible. If you reach for a clinical word ("anxiety," "trauma," "avoidance," "dysregulation," "masking," "sensory overwhelm"), stop and rewrite using what the user actually said. "Masking" becomes "the version of you that switches on in rooms." "Sensory overwhelm" becomes "too much input, jaw started buzzing." If the user did not describe a body response, the brief should flag that gap — ${PERSONA_NAME} needs to ask about the body before a checkpoint can land.

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

Respond with ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "layers": {
    "1": { "signal": "none|emerging|explored|checkpoint_ready", "material": ["specific observation"], "examples": ["concrete moment from user"], "dimensions": ["which aspects touched"] },
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
  "next_prompt": "3-6 word placeholder hint...",
  "sage_brief": "3-5 sentence orientation for ${PERSONA_NAME}"
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

export async function runExtraction(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  previousState: ExtractionState | null,
  manualComponents: ManualComponent[],
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
  });
  userContent += "\n\n";

  userContent += `is_first_checkpoint: ${isFirstCheckpoint}\n\n`;

  if (manualComponents.length > 0) {
    userContent += "CONFIRMED MANUAL ENTRIES:\n";
    for (const comp of manualComponents) {
      userContent += `Layer ${comp.layer} (${LAYER_NAMES[comp.layer]})`;
      if (comp.name) userContent += ` — "${comp.name}"`;
      userContent += `:\n${comp.content}\n\n`;
    }
  }

  // Only send last 6 messages (3 exchanges). Extraction is cumulative —
  // previous state already contains all signals from earlier turns.
  const recentHistory = conversationHistory.slice(-6);
  userContent += "RECENT CONVERSATION:\n";
  for (const msg of recentHistory) {
    userContent += `${msg.role}: ${msg.content}\n\n`;
  }

  userContent += "Analyze the latest exchange and produce the updated extraction state.";

  try {
    const response = await anthropicFetch({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const cleaned = rawText
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

    return {
      layers: parsed.layers || state.layers,
      language_bank: parsed.language_bank || state.language_bank,
      depth: parsed.depth || state.depth,
      current_thread: parsed.current_thread || state.current_thread,
      mode: parsed.mode || state.mode,
      checkpoint_gate: parsed.checkpoint_gate || state.checkpoint_gate,
      clinical_flag: parsed.clinical_flag || state.clinical_flag,
      next_prompt: parsed.next_prompt || "",
      sage_brief: parsed.sage_brief || "",
    };
  } catch (err) {
    console.error("[extraction] Failed:", err);
    return { ...state, next_prompt: "", sage_brief: "" };
  }
}

// ─── Format extraction state as context for Sage ─────────────────────────────

// Maps internal signal codes to human-readable descriptions.
// Keeps schema names out of the rendered prompt.
const SIGNAL_LABEL: Record<string, string> = {
  none: "untouched",
  emerging: "starting to surface",
  explored: "well explored",
  checkpoint_ready: "ready to be reflected back",
};

export function formatExtractionForSage(
  state: ExtractionState,
  isFirstCheckpoint: boolean,
  manualComponents?: { layer: number; name: string | null; content: string }[]
): string {
  let context = "\n── BRIEF FOR YOUR NEXT RESPONSE ──\n\n";

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
      context += ` Recent threads: ${layer.material.slice(-3).join("; ")}.`;
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

  // Clinical flag — surfaced first so Sage notices before reflecting
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

  const gateReady = !isCrisis && (
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
    if (!gate.has_mechanism && !isFirstCheckpoint)
      missing.push("you haven't reached the mechanism underneath the behavior yet");
    if (!gate.has_charged_language)
      missing.push("you haven't captured a phrase from the user that carries weight");
    if (!gate.has_behavior_driver_link && !gate.has_mechanism)
      missing.push("you haven't connected what they do to what's driving it");
    context += `Not enough yet to reflect a piece back. ${missing.join(". ")}.`;
  }
  context += "\n";

  if (isFirstCheckpoint && gateReady) {
    context +=
      "Note: this would be the user's very first reflection. After your observation, include the one-time wrapper explaining how confirmation works.\n";
  }

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

  context += "── END BRIEF ──\n";

  return context;
}
