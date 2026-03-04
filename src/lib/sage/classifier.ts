import { anthropicFetch } from "@/lib/anthropic";

interface ClassificationResult {
  isCheckpoint: boolean;
  layer: number | null;
  type: "component" | "pattern" | null;
  name: string | null;
  processingText: string;
}

const FALLBACK: ClassificationResult = {
  isCheckpoint: false,
  layer: null,
  type: null,
  name: null,
  processingText: "listening...",
};

/**
 * Cleans raw classifier text (strips markdown backticks), parses JSON,
 * maps fields, and validates checkpoint integrity (layer required).
 */
export function cleanAndParseClassification(
  rawText: string
): ClassificationResult {
  const cleaned = rawText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  const result: ClassificationResult = {
    isCheckpoint: Boolean(parsed.is_checkpoint),
    layer: parsed.layer ?? null,
    type: parsed.type ?? null,
    name: parsed.name ?? null,
    processingText: parsed.processing_text || "listening...",
  };

  // Invalid checkpoint if no layer
  if (result.isCheckpoint && result.layer === null) {
    result.isCheckpoint = false;
  }

  return result;
}

export async function classifyResponse(
  sageResponse: string,
  recentMessages: string,
  isFirstSession?: boolean,
  layersWithComponents?: number[]
): Promise<ClassificationResult> {
  try {
    const checkpointThreshold = isFirstSession
      ? `A checkpoint is a sustained reflection (usually 60+ words for first-session users) where Sage proposes a component or pattern of the user's behavioral model. It traces behavior using the user's own words and specific examples. It typically ends by offering a name and asking for validation ("Does that fit?" or "What would you change?"). For first-session users, a well-formed single-thread observation with one concrete example qualifies as a checkpoint. Short observations, questions, transitions, and the post-checkpoint fork ("Two directions: Work with it / Keep building") are NOT checkpoints.`
      : `A checkpoint is a sustained reflection (usually 100+ words) where Sage proposes a component or pattern of the user's behavioral model. It traces behavior using the user's own words and specific examples. It typically ends by offering a name and asking for validation ("Does that fit?" or "What would you change?"). Short observations, questions, transitions, and the post-checkpoint fork ("Two directions: Work with it / Keep building") are NOT checkpoints.`;

    const response = await anthropicFetch({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `You analyze messages from a conversational AI called Sage that builds behavioral models. Two jobs:

1. CHECKPOINT DETECTION: Is this message a checkpoint? ${checkpointThreshold}

2. PROCESSING TEXT: Generate a short phrase (5-12 words) representing what Sage is currently tracking. Should sound like internal notes. Examples: "trust patterns... conditional, earned not given" or "the shutdown is protection, not avoidance" or "seeing a loop forming around control and withdrawal"

Respond with ONLY this JSON, no markdown, no backticks:
{"is_checkpoint":true/false,"layer":null or 1 or 2 or 3 or 4 or 5,"type":null or "component" or "pattern","name":null or "The Proposed Name","processing_text":"short tracking phrase"}

Layer guide:
Layer 1 (What Drives You): needs, values, motivation, what they protect, what they compete for under pressure
Layer 2 (Your Self Perception): beliefs about self, identity, emotional processing, how self-image shapes decisions
Layer 3 (Your Reaction System): internal operating system under pressure, beliefs about the world, protective strategies, coping responses
Layer 4 (How You Operate): thinking style, decision-making, energy management, handling complexity, operational defaults
Layer 5 (Your Relationship to Others): communication, trust, repair, conflict patterns, how others actually experience them

If checkpoint: pick strongest layer. Recurring loop (trigger → response → cost) = "pattern". Broader narrative = "component". Extract headline if present.

TYPE RULE: The first entry on any layer MUST be "component". Only classify as "pattern" if the layer already has a confirmed component.${layersWithComponents && layersWithComponents.length > 0 ? ` Layers with confirmed components (eligible for patterns): ${layersWithComponents.join(", ")}. All other layers: type must be "component".` : ` No layers have confirmed components yet. Type is always "component".`}`,
      messages: [
        {
          role: "user",
          content: `Recent conversation:\n${recentMessages}\n\nSage's latest message:\n${sageResponse}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      return cleanAndParseClassification(rawText);
    } catch (parseErr) {
      console.error(
        "[classifier] JSON parse failed. Raw text:",
        rawText,
        "Error:",
        parseErr
      );
      return FALLBACK;
    }
  } catch (err) {
    console.error("[classifier] API call failed:", err);
    return FALLBACK;
  }
}
