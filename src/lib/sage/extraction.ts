import { anthropicFetch } from "@/lib/anthropic";
import { LAYERS, LAYER_NAMES } from "@/lib/manual/layers";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LayerSignal {
  signal: "none" | "emerging" | "explored" | "checkpoint_ready";
  material: string[];
  examples: string[];
  dimensions: string[];
  discovery_mode: "component" | "pattern";
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
  target_type: "component" | "pattern";
}

export interface ClinicalFlag {
  active: boolean;
  level: "crisis" | "caution" | "none";
  note: string;
}

export interface PatternChainElement {
  element: "trigger" | "internal_experience" | "response" | "payoff" | "cost";
  content: string;
  source: string; // user quote or paraphrase that evidenced this
}

export interface PatternTracking {
  active: boolean;
  layer: number | null;
  label: string; // working name for the pattern, e.g. "the shutdown loop"
  chain_elements: PatternChainElement[];
  recurrence_count: number; // how many distinct instances the user has described
}

export interface ConfirmedPattern {
  layer: number;
  name: string;
  chain_elements: PatternChainElement[];
}

export interface ExtractionState {
  layers: Record<number, LayerSignal>;
  language_bank: LanguageEntry[];
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin";
  current_thread: string;
  mode: "situation_led" | "direct_exploration" | "synthesis";
  checkpoint_gate: CheckpointGate;
  clinical_flag: ClinicalFlag;
  pattern_tracking: PatternTracking;
  confirmed_patterns: ConfirmedPattern[];
  next_prompt: string;
  sage_brief: string;
}

interface ManualComponent {
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

// ─── Default state ───────────────────────────────────────────────────────────

function defaultState(): ExtractionState {
  return {
    layers: {
      1: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      2: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      3: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      4: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
      5: { signal: "none", material: [], examples: [], dimensions: [], discovery_mode: "component" },
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
      target_type: "component",
    },
    clinical_flag: {
      active: false,
      level: "none",
      note: "",
    },
    pattern_tracking: {
      active: false,
      layer: null,
      label: "",
      chain_elements: [],
      recurrence_count: 0,
    },
    confirmed_patterns: [],
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

const EXTRACTION_SYSTEM = `You are the extraction layer for a conversational AI called Sage that builds behavioral models for late-diagnosed autistic adults. You run silently before Sage responds. Your job is to analyze what the user just said and produce structured context so Sage can have a deeper, more grounded conversation.

You receive:
- The conversation so far
- The previous extraction state (cumulative across the session)
- Any confirmed manual components the user already has
- Whether the user has ever had a checkpoint confirmed

You produce an updated extraction state. This is Sage's research brief. The quality of Sage's conversation depends entirely on the quality of your analysis.

CLINICAL FRAMEWORK GUARDRAIL
Use Schema Therapy, Attachment Theory, and Functional Analysis as internal pattern recognition frameworks. NEVER reference these frameworks by name. NEVER use clinical terminology in any field that Sage will read. Describe what you observe in the user's own language and in behavioral or somatic terms, not psychological labels. The extraction state is upstream of Sage's voice — clinical drift here causes clinical drift there.
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

Capture aggressively. If a phrase has any of the qualities above, log it. The bank is how Sage avoids paraphrasing the user into a stranger.

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

When the gate is met, identify strongest_layer: which layer has the most material, examples, and depth.

5. NEXT PROMPT
Generate a short placeholder phrase (3-6 words, lowercase, ending with "...") for the text input field. This hints at what the user could say next. Match the conversation's depth and prefer somatic openings over emotional ones:
- At surface → prompt toward behavior or body: "what did your body do..."
- At behavior → prompt toward sensation or system: "what did that feel like in you..."
- At feeling → prompt toward mechanism: "what was loading up..."
- At mechanism → prompt toward cross-context: "where else does this show up..."

Examples: "what happened after that..." / "what did your body do..." / "when did this start..." / "what stopped you..." / "what was the input like..."

6. SAGE BRIEF
Write a short paragraph (3-5 sentences) orienting Sage:
- What the user is actually describing underneath the surface topic (in behavioral or somatic terms — never clinical labels)
- What the most charged or unresolved piece is
- What Sage should push on vs leave alone
- Whether a checkpoint is approaching and what it would cover

Use the user's own language wherever possible. If you reach for a clinical word ("anxiety," "trauma," "avoidance"), stop and rewrite using what the user actually said.

7. CLINICAL FLAG
A lightweight signal that tells Sage when to engage legal guardrails. Two levels:

"crisis": User expressed suicidal ideation, self-harm intent, or intent to harm others. Sage must stop building and provide resources.

"caution": User introduced diagnostic language, asked Sage to assess a condition, or described distress that may exceed manual-building scope. Sage should stay in behavioral description and may need to offer a professional referral.

"none": Normal conversation. Clinical themes may be present but the user is not asking Sage to do anything clinical.

IMPORTANT: A user talking ABOUT depression, anxiety, trauma, etc. as part of their story is "none." A user asking Sage to ASSESS whether they have a condition, or describing experiences that clearly exceed self-understanding scope (psychotic symptoms, inability to function, active destabilization), is "caution." The bar for "caution" is high. Most conversations stay "none" even when the material is heavy.

8. MODE RECOMMENDATION
- situation_led: Default. User is telling stories, Sage is deepening.
- direct_exploration: When 2+ layers have confirmed components and there are clear gaps.
- synthesis: When all 5 layers have at least one confirmed component.

9. PATTERN TRACKING
Each layer has a discovery_mode: "component" (default) or "pattern" (after a component is confirmed on that layer).

When a layer is in "pattern" mode, you are looking for REPEATING LOOPS: sequences that play out across different situations. A pattern is NOT the same as a component. Components describe the landscape. Patterns describe the loops that run on that landscape.

PATTERN DETECTION:
When discovery_mode is "pattern" for a layer, watch for:
- Behavior or response the user has described in TWO OR MORE different contexts (recurrence)
- A sequence: something triggers → something happens internally → the user responds → there's a payoff AND a cost
- The user recognizing "I always do this" or "this keeps happening"

FUNCTIONAL ANALYSIS CHAIN (one chain, framed differently per layer):
The chain is the same five elements regardless of layer. The framing shifts.

For Layers 1, 2, 4 (standard behavioral loop):
- trigger: What activates it (situation, sensory input, person, change)
- internal_experience: What happens inside (body sensation, system state, thought, the feeling if they named one)
- response: What they do (the behavior, the action, the shutdown, the script)
- payoff: What it protects or provides (the short-term relief or function)
- cost: What it costs them (what compounds, what they lose)

For Layer 3 (${LAYER_NAMES[3]} — needs-when-unmet framing):
- trigger: A need being violated or pressure on a non-negotiable
- internal_experience: Depletion, overload, the system filling up
- response: What they do under unmet need (mask harder, withdraw, crash)
- payoff: What the need provides when met (the function it enables)
- cost: What compounds when the need stays unmet

For Layer 5 (${LAYER_NAMES[5]} — conditions-for-activation framing):
- trigger: The condition that activates the strength (the right kind of input, the right environment, the right kind of problem)
- internal_experience: What the activated state feels like (flow, focus, the system clicking on)
- response: The output (what they produce, how they show up)
- payoff: What they're capable of in that state
- cost: What activation costs, or what blocks it

The structure stays the same. The framing adapts to the layer.

Each element needs a content description AND a source (the user's exact words or a tight paraphrase of what evidenced it).

PATTERN GATE:
A pattern checkpoint is ready when:
- recurrence_count >= 2 (the user has described this loop in at least two distinct situations)
- At least 3 of 5 chain elements are filled (trigger + response + one of: internal_experience, payoff, or cost)
- The pattern belongs to a layer that already has a confirmed component (discovery_mode = "pattern")

When the pattern gate is met, set checkpoint_gate.target_type to "pattern" and checkpoint_gate.strongest_layer to the pattern's layer id.

When in component mode (no pattern tracking active), checkpoint_gate.target_type stays "component".

Respond with ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "layers": {
    "1": { "signal": "none|emerging|explored|checkpoint_ready", "material": ["specific observation"], "examples": ["concrete moment from user"], "dimensions": ["which aspects touched"], "discovery_mode": "component|pattern" },
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
    "strongest_layer": null,
    "target_type": "component|pattern"
  },
  "clinical_flag": {
    "active": false,
    "level": "none",
    "note": ""
  },
  "pattern_tracking": {
    "active": false,
    "layer": null,
    "label": "working name for pattern",
    "chain_elements": [
      { "element": "trigger|internal_experience|response|payoff|cost", "content": "description", "source": "user quote" }
    ],
    "recurrence_count": 0
  },
  "next_prompt": "3-6 word placeholder hint...",
  "sage_brief": "3-5 sentence orientation for Sage"
}

CRITICAL RULES:
- The language_bank is CUMULATIVE. Carry forward the 15 most relevant entries (prefer high-charge and recent). Only add new ones from the latest exchange. If the bank exceeds 15 entries, drop the oldest low-charge entries first.
- Layer signals are CUMULATIVE. Material and examples accumulate. Signal level only advances (none → emerging → explored → checkpoint_ready) unless a checkpoint was confirmed, in which case that layer resets for new pattern discovery.
- When a layer has a confirmed component already, its signal starts at "explored" minimum and its discovery_mode is "pattern".
- Be aggressive about capturing language. If in doubt, capture it.
- The checkpoint gate is a quality assessment. Do not count turns.
- The next_prompt must be 3-6 words, lowercase, ending with "..."
- discovery_mode is managed externally. Always carry forward the discovery_mode from the previous state for each layer. Do not change it yourself.
- pattern_tracking is cumulative. Once active, keep building chain_elements across turns. Increment recurrence_count when the user describes a new instance of the same loop. Reset pattern_tracking (active: false) after a pattern checkpoint is confirmed.
- PATTERN SATURATION: Each layer has a maximum of 2 patterns. Check the confirmed manual components to count existing patterns per layer. If a layer already has 2 confirmed patterns and you detect a third recurring loop, do NOT activate pattern_tracking. Instead, note "saturated" in the sage_brief and suggest deepening an existing pattern or exploring a different layer.
- NO CLINICAL LANGUAGE in any field Sage will read (sage_brief, current_thread, layer material). Use the user's words and behavioral/somatic descriptions, not psychological labels.`;

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
    pattern_tracking: state.pattern_tracking,
  });
  userContent += "\n\n";

  userContent += `is_first_checkpoint: ${isFirstCheckpoint}\n\n`;

  const confirmedComponentCount = manualComponents.filter(
    (c) => c.type === "component"
  ).length;

  if (confirmedComponentCount < 3) {
    userContent += `pattern_tracking_enabled: false\nDo not activate pattern tracking. The user needs at least 3 confirmed components before patterns are introduced.\n\n`;
  } else {
    userContent += `pattern_tracking_enabled: true\n\n`;
  }

  if (manualComponents.length > 0) {
    userContent += "CONFIRMED MANUAL COMPONENTS:\n";
    for (const comp of manualComponents) {
      userContent += `Layer ${comp.layer} (${LAYER_NAMES[comp.layer]}) — ${comp.type}`;
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

    // Preserve discovery_mode from previous state (managed by confirm-checkpoint,
    // not by the extraction LLM). Merge parsed layers with existing discovery_mode.
    const mergedLayers = parsed.layers || state.layers;
    for (let i = 1; i <= 5; i++) {
      if (mergedLayers[i] && state.layers[i]) {
        mergedLayers[i].discovery_mode = state.layers[i].discovery_mode;
      } else if (mergedLayers[i]) {
        mergedLayers[i].discovery_mode = mergedLayers[i].discovery_mode || "component";
      }
    }

    return {
      layers: mergedLayers,
      language_bank: parsed.language_bank || state.language_bank,
      depth: parsed.depth || state.depth,
      current_thread: parsed.current_thread || state.current_thread,
      mode: parsed.mode || state.mode,
      checkpoint_gate: parsed.checkpoint_gate || state.checkpoint_gate,
      clinical_flag: parsed.clinical_flag || state.clinical_flag,
      pattern_tracking: parsed.pattern_tracking || state.pattern_tracking,
      confirmed_patterns: state.confirmed_patterns, // managed by confirm-checkpoint, not by LLM
      next_prompt: parsed.next_prompt || "",
      sage_brief: parsed.sage_brief || "",
    };
  } catch (err) {
    console.error("[extraction] Failed:", err);
    return { ...state, next_prompt: "", sage_brief: "" };
  }
}

// ─── Format extraction state as context for Sage ─────────────────────────────

export function formatExtractionForSage(
  state: ExtractionState,
  isFirstCheckpoint: boolean,
  manualComponents?: { layer: number; type: string; name: string | null; content: string }[]
): string {
  let context = "\n── EXTRACTION CONTEXT ──\n\n";

  if (state.sage_brief) {
    context += `FIELD NOTES\n${state.sage_brief}\n\n`;
  }

  context += "LAYER SIGNALS\n";
  for (let i = 1; i <= 5; i++) {
    const layer = state.layers[i];
    if (!layer) continue;
    context += `L${i} (${LAYER_NAMES[i]}): ${layer.signal}`;
    if (layer.discovery_mode === "pattern") {
      // Check if this layer is saturated (2 patterns already confirmed)
      const layerPatternCount = manualComponents
        ? manualComponents.filter((c) => c.layer === i && c.type === "pattern").length
        : 0;
      if (layerPatternCount >= 2) {
        context += ` [pattern mode — SATURATED: 2/2 patterns]`;
      } else {
        context += ` [pattern mode]`;
      }
    }
    if (layer.material.length > 0) {
      context += ` — ${layer.material.slice(-3).join("; ")}`;
    }
    context += "\n";
  }
  context += "\n";

  const chargedLanguage = state.language_bank
    .filter((e) => e.charge === "high" || e.charge === "medium")
    .slice(-15);

  if (chargedLanguage.length > 0) {
    context += "USER'S OWN LANGUAGE (use these. They're more powerful than your paraphrase)\n";
    for (const entry of chargedLanguage) {
      context += `"${entry.phrase}" [${entry.charge}] — re: ${entry.context}\n`;
    }
    context += "\n";
  }

  // Clinical flag — placed before checkpoint gate so Sage sees it first
  const cf = state.clinical_flag;
  if (cf && cf.active) {
    if (cf.level === "crisis") {
      context += `⚠ CRISIS: ${cf.note}. Stop building. Acknowledge. Provide 988 and Crisis Text Line. Do not checkpoint.\n\n`;
    } else if (cf.level === "caution") {
      context += `⚠ CLINICAL CAUTION: ${cf.note}. Stay in behavioral description. Offer professional referral if scope is exceeded.\n\n`;
    }
  }

  // Checkpoint gate evaluation — blocked when clinical_flag is crisis
  const gate = state.checkpoint_gate;
  const isCrisis = cf && cf.active && cf.level === "crisis";
  const pt = state.pattern_tracking;
  const isPatternGate = gate.target_type === "pattern";

  // Pattern gate: recurrence >= 2 AND at least 3 of 5 chain elements filled
  const patternChainCount = pt?.chain_elements?.length || 0;
  const patternGateReady = isPatternGate && !isCrisis &&
    (pt?.recurrence_count || 0) >= 2 &&
    patternChainCount >= 3;

  // Component gate (standard or first-checkpoint)
  const componentGateReady = !isPatternGate && !isCrisis && (
    isFirstCheckpoint
      ? gate.concrete_examples >= 1 &&
        gate.has_charged_language &&
        (gate.has_mechanism || gate.has_behavior_driver_link)
      : gate.concrete_examples >= 2 &&
        gate.has_mechanism &&
        gate.has_charged_language &&
        gate.has_behavior_driver_link
  );

  const gateReady = patternGateReady || componentGateReady;

  if (isPatternGate) {
    context += `PATTERN GATE: ${patternGateReady ? "MET" : "NOT MET"}`;
    if (!patternGateReady) {
      const missing: string[] = [];
      if ((pt?.recurrence_count || 0) < 2) missing.push("need more recurrence (2+ instances)");
      if (patternChainCount < 3) missing.push(`chain incomplete (${patternChainCount}/3 minimum elements)`);
      context += ` — missing: ${missing.join(", ")}`;
    } else {
      context += ` — layer: L${gate.strongest_layer}, pattern: "${pt?.label || "unnamed"}"`;
    }
  } else {
    context += `CHECKPOINT: ${gateReady ? "READY" : "NOT READY"}`;
    if (!gateReady) {
      const missing: string[] = [];
      const minExamples = isFirstCheckpoint ? 1 : 2;
      if (gate.concrete_examples < minExamples)
        missing.push(`need ${minExamples - gate.concrete_examples} more concrete example(s)`);
      if (!gate.has_mechanism && !isFirstCheckpoint) missing.push("haven't reached mechanism yet");
      if (!gate.has_charged_language) missing.push("no charged user language captured");
      if (!gate.has_behavior_driver_link && !gate.has_mechanism)
        missing.push("no behavior-to-driver link yet");
      context += ` — missing: ${missing.join(", ")}`;
    } else {
      context += ` — strongest layer: L${gate.strongest_layer}`;
    }
  }
  context += "\n";

  if (isFirstCheckpoint && gateReady && !isPatternGate) {
    context +=
      "FIRST CHECKPOINT: This is the user's first checkpoint ever. After your observation, include the instructional wrapper explaining what just happened and how confirmation works. See prompt instructions.\n";
  }

  // Pattern chain status — shows Sage what's been collected
  if (pt && pt.active && pt.chain_elements && pt.chain_elements.length > 0) {
    context += `\nPATTERN CHAIN: "${pt.label || "unnamed"}" (L${pt.layer}, ${pt.recurrence_count} instance(s))\n`;
    const chainOrder: Array<"trigger" | "internal_experience" | "response" | "payoff" | "cost"> = [
      "trigger", "internal_experience", "response", "payoff", "cost"
    ];
    for (const el of chainOrder) {
      const found = pt.chain_elements.find((c) => c.element === el);
      if (found) {
        context += `  ✓ ${el}: ${found.content} ("${found.source}")\n`;
      } else {
        context += `  ○ ${el}: not yet identified\n`;
      }
    }
    context += "\n";
  }

  // When checkpoint is ready and the target layer already has content,
  // give Sage the existing content so it can compose an aware manual entry
  if (gateReady && gate.strongest_layer && manualComponents) {
    const layerContent = manualComponents.filter(
      (c) => c.layer === gate.strongest_layer
    );
    if (layerContent.length > 0) {
      context += "\nEXISTING CONTENT ON TARGET LAYER (your manual entry must account for this):\n";
      for (const comp of layerContent) {
        context += `[${comp.type}${comp.name ? ` — "${comp.name}"` : ""}]\n`;
        context += `${comp.content}\n\n`;
      }
      context += "Your manual entry should integrate with or deepen this existing content. If new material contradicts it, name the tension. Do not flatten it.\n";
    }
  }

  // Confirmed patterns with chain elements — gives Sage structural memory
  if (state.confirmed_patterns && state.confirmed_patterns.length > 0) {
    context += "\nCONFIRMED PATTERNS (reference these in conversation. They're part of the manual)\n";
    for (const cp of state.confirmed_patterns) {
      context += `L${cp.layer} — "${cp.name}": `;
      const chainSummary = cp.chain_elements
        .map((el) => `${el.element}: ${el.content}`)
        .join(" → ");
      context += chainSummary + "\n";
    }
    context += "\n";

    // Cross-layer refs: show connections between confirmed patterns across layers
    if (state.confirmed_patterns.length >= 2) {
      const triggers = state.confirmed_patterns
        .filter((p) => p.chain_elements.some((e) => e.element === "trigger"))
        .map((p) => ({
          layer: p.layer,
          name: p.name,
          trigger: p.chain_elements.find((e) => e.element === "trigger")!.content,
        }));

      if (triggers.length >= 2) {
        context += "CROSS-LAYER CONNECTIONS\n";
        context += "These patterns may share triggers or costs. Look for connections:\n";
        for (const t of triggers) {
          context += `  L${t.layer} "${t.name}" trigger: ${t.trigger}\n`;
        }
        context += "\n";
      }
    }
  }

  context += `DEPTH: ${state.depth} | MODE: ${state.mode}\n`;

  if (state.current_thread) {
    context += `THREAD: ${state.current_thread}\n`;
  }

  context += "── END EXTRACTION CONTEXT ──\n";

  return context;
}
