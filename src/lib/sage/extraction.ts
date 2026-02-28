import { anthropicFetch } from "@/lib/anthropic";

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

export interface ExtractionState {
  layers: Record<number, LayerSignal>;
  language_bank: LanguageEntry[];
  depth: "surface" | "behavior" | "feeling" | "mechanism" | "origin";
  current_thread: string;
  mode: "situation_led" | "direct_exploration" | "synthesis";
  checkpoint_gate: CheckpointGate;
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
    next_prompt: "",
    sage_brief: "",
  };
}

// ─── Extraction prompt ──────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are the extraction layer for a conversational AI called Sage that builds behavioral models. You run silently before Sage responds. Your job is to analyze what the user just said and produce structured context so Sage can have a deeper, more grounded conversation.

You receive:
- The conversation so far
- The previous extraction state (cumulative across the session)
- Any confirmed manual components the user already has
- Whether the user has ever had a checkpoint confirmed

You produce an updated extraction state. This is Sage's research brief. The quality of Sage's conversation depends entirely on the quality of your analysis.

THE FIVE-LAYER MODEL
Layer 1 (What Drives You): Needs, values, motivation. What they protect. What they compete for under pressure. Patterns driven by threatened needs or violated values.
Layer 2 (Your Self Perception): Beliefs about self, identity, emotional processing. How self-image shapes decisions. Patterns driven by belief activation or emotional overload.
Layer 3 (Your Reaction System): Internal operating system under pressure. Beliefs about the world, protective strategies, coping responses. Patterns driven by belief activation or emotional overload.
Layer 4 (How You Operate): Thinking style, decision-making, energy management, handling complexity. Patterns driven by operational defaults creating unintended consequences.
Layer 5 (Your Relationship to Others): Communication, trust, repair, conflict patterns. How others actually experience them. Patterns that play out between people.

YOUR ANALYSIS PRIORITIES

1. LANGUAGE BANK (most important)
Capture the user's exact phrases that carry weight. Not your paraphrase. Their words. Especially:
- Metaphors they use for themselves ("I'm the fixer," "never ending pit of need")
- Emotional language ("it gutted me," "I just shut down")
- Self-descriptions ("I've always been the one who...")
- Contradictions between what they claim and what they describe
- Moments of visible heat or charge in the text

2. LAYER SIGNALS
What layers did the user's latest message touch? Be specific about what material surfaced. Don't just say "Layer 1 emerging" — say what need or value you're seeing signal for and what the evidence is.

Track dimensions within each layer:
- Layer 1: core needs, values hierarchy, what they protect, what they sacrifice, what they compete for
- Layer 2: self-beliefs (positive and negative), identity narratives, emotional awareness, emotional processing style, gap between who they are and who they think they should be
- Layer 3: world-beliefs, threat detection patterns, protective strategies, coping defaults, what triggers the system
- Layer 4: thinking style, decision patterns, energy management, complexity handling, procrastination/avoidance, operational strengths and blind spots
- Layer 5: communication defaults, trust mechanics, repair behavior, conflict patterns, what others experience vs what user intends

3. DEPTH TRACKING
Where is the conversation in its vertical descent?
- surface: what happened (events, facts)
- behavior: what they did (actions, choices)
- feeling: what they felt (emotions, body responses)
- mechanism: why they do it (the underlying driver, the belief or need fueling the behavior)
- origin: where it comes from (when this pattern started, earliest examples)

4. CHECKPOINT GATE
Evaluate whether there is enough material for a meaningful checkpoint. This is purely a quality assessment. Number of turns is irrelevant.

STANDARD GATE (all must be true):
- concrete_examples >= 2: At least two specific, concrete moments from the user's life (not abstract claims like "I'm always anxious" but real situations they walked through)
- has_mechanism: The conversation has reached WHY, not just WHAT. There's a connection between surface behavior and an underlying driver, need, or belief.
- has_charged_language: The language bank contains at least one high-charge phrase that can anchor the checkpoint.
- has_behavior_driver_link: A clear line exists between an observable behavior and what's fueling it.

FIRST-CHECKPOINT GATE (lighter, when "is_first_checkpoint" is true):
The first checkpoint is a teaching moment. The user needs to experience the confirm-and-write loop quickly. Lighter bar:
- concrete_examples >= 1: One vivid, specific moment is enough.
- has_charged_language: true
- has_mechanism OR has_behavior_driver_link: at least one.

The first checkpoint should be accurate enough to confirm and feel like recognition. It does not need to be comprehensive.

When the gate is met, identify strongest_layer: which layer has the most material, examples, and depth.

5. NEXT PROMPT
Generate a short placeholder phrase (3-6 words, lowercase, ending with "...") for the text input field. This hints at what the user could say next. Match the conversation's depth:
- At surface → prompt toward behavior or feeling: "what did you do next..."
- At behavior → prompt toward feeling: "how did that land..."
- At feeling → prompt toward mechanism: "what were you protecting..."
- At mechanism → prompt toward cross-context: "where else does this show up..."

Examples: "what happened after that..." / "who else sees this in you..." / "when did this start..." / "what stopped you..." / "how did that feel..."

6. SAGE BRIEF
Write a short paragraph (3-5 sentences) orienting Sage:
- What the user is actually talking about underneath the surface topic
- What the most charged or unresolved piece is
- What Sage should push on vs leave alone
- Whether a checkpoint is approaching and what it would cover

7. MODE RECOMMENDATION
- situation_led: Default. User is telling stories, Sage is deepening.
- direct_exploration: When 2+ layers have confirmed components and there are clear gaps.
- synthesis: When all 5 layers have at least one confirmed component.

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
  "next_prompt": "3-6 word placeholder hint...",
  "sage_brief": "3-5 sentence orientation for Sage"
}

CRITICAL RULES:
- The language_bank is CUMULATIVE. Carry forward the 15 most relevant entries (prefer high-charge and recent). Only add new ones from the latest exchange. If the bank exceeds 15 entries, drop the oldest low-charge entries first.
- Layer signals are CUMULATIVE. Material and examples accumulate. Signal level only advances (none → emerging → explored → checkpoint_ready) unless a checkpoint was confirmed, in which case that layer resets for new pattern discovery.
- When a layer has a confirmed component already, its signal starts at "explored" minimum.
- Be aggressive about capturing language. If in doubt, capture it.
- The checkpoint gate is a quality assessment. Do not count turns.
- The next_prompt must be 3-6 words, lowercase, ending with "..."`;

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
    const layerNames: Record<number, string> = {
      1: "What Drives You",
      2: "Your Self Perception",
      3: "Your Reaction System",
      4: "How You Operate",
      5: "Your Relationship to Others",
    };
    userContent += "CONFIRMED MANUAL COMPONENTS:\n";
    for (const comp of manualComponents) {
      userContent += `Layer ${comp.layer} (${layerNames[comp.layer]}) — ${comp.type}`;
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
  const layerNames: Record<number, string> = {
    1: "What Drives You",
    2: "Your Self Perception",
    3: "Your Reaction System",
    4: "How You Operate",
    5: "Your Relationship to Others",
  };

  let context = "\n── EXTRACTION CONTEXT ──\n\n";

  if (state.sage_brief) {
    context += `FIELD NOTES\n${state.sage_brief}\n\n`;
  }

  context += "LAYER SIGNALS\n";
  for (let i = 1; i <= 5; i++) {
    const layer = state.layers[i];
    if (!layer) continue;
    context += `L${i} (${layerNames[i]}): ${layer.signal}`;
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
    context += "USER'S OWN LANGUAGE (use these — they're more powerful than your paraphrase)\n";
    for (const entry of chargedLanguage) {
      context += `"${entry.phrase}" [${entry.charge}] — re: ${entry.context}\n`;
    }
    context += "\n";
  }

  // Checkpoint gate evaluation
  const gate = state.checkpoint_gate;
  const gateReady = isFirstCheckpoint
    ? gate.concrete_examples >= 1 &&
      gate.has_charged_language &&
      (gate.has_mechanism || gate.has_behavior_driver_link)
    : gate.concrete_examples >= 2 &&
      gate.has_mechanism &&
      gate.has_charged_language &&
      gate.has_behavior_driver_link;

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
  context += "\n";

  if (isFirstCheckpoint && gateReady) {
    context +=
      "FIRST CHECKPOINT: This is the user's first checkpoint ever. After your observation, include the instructional wrapper explaining what just happened and how confirmation works. See prompt instructions.\n";
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
      context += "Your manual entry should integrate with or deepen this existing content. If new material contradicts it, name the tension — do not flatten it.\n";
    }
  }

  context += `DEPTH: ${state.depth} | MODE: ${state.mode}\n`;

  if (state.current_thread) {
    context += `THREAD: ${state.current_thread}\n`;
  }

  context += "── END EXTRACTION CONTEXT ──\n";

  return context;
}
