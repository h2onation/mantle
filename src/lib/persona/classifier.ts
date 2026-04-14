import { anthropicFetch } from "@/lib/anthropic";
import { LAYERS } from "@/lib/manual/layers";
import { PERSONA_NAME } from "@/lib/persona/config";

// Built once at module load — interpolated into the classifier prompt below.
// Imports from the canonical layer definitions so a rename in
// src/lib/manual/layers.ts propagates here automatically.
const LAYER_GUIDE = LAYERS.map(
  (l) => `Layer ${l.id} (${l.name}): ${l.dimensions.join(", ")}`
).join("\n");

interface ClassificationResult {
  isCheckpoint: boolean;
  layer: number | null;
  name: string | null;
  processingText: string;
}

const FALLBACK: ClassificationResult = {
  isCheckpoint: false,
  layer: null,
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
  isFirstSession?: boolean
): Promise<ClassificationResult> {
  try {
    const checkpointThreshold = isFirstSession
      ? `A checkpoint is a sustained reflection (usually 60+ words for first-session users) where ${PERSONA_NAME} proposes an entry for the user's behavioral model. It traces behavior using the user's own words and specific examples. It typically ends by offering a name and asking for validation ("Does that fit?" or "What would you change?"). For first-session users, a well-formed single-thread observation with one concrete example qualifies as a checkpoint. Short observations, questions, transitions, and the post-checkpoint fork ("Two directions: Work with it / Keep building") are NOT checkpoints.`
      : `A checkpoint is a sustained reflection (usually 100+ words) where ${PERSONA_NAME} proposes an entry for the user's behavioral model. It traces behavior using the user's own words and specific examples. It typically ends by offering a name and asking for validation ("Does that fit?" or "What would you change?"). Short observations, questions, transitions, and the post-checkpoint fork ("Two directions: Work with it / Keep building") are NOT checkpoints.`;

    const response = await anthropicFetch({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `You analyze messages from a conversational AI called ${PERSONA_NAME} that builds behavioral models. Two jobs:

1. CHECKPOINT DETECTION: Is this message a checkpoint? ${checkpointThreshold}

2. PROCESSING TEXT: Generate a short phrase (5-12 words) representing what ${PERSONA_NAME} is currently tracking. Should sound like internal notes. Examples: "trust patterns... conditional, earned not given" or "the shutdown is protection, not avoidance" or "seeing a loop forming around control and withdrawal"

Respond with ONLY this JSON, no markdown, no backticks:
{"is_checkpoint":true/false,"layer":null or 1 or 2 or 3 or 4 or 5,"name":null or "The Proposed Name","processing_text":"short tracking phrase"}

Layer guide:
${LAYER_GUIDE}

If checkpoint: pick the strongest layer the entry belongs to. Extract headline if present. Layers can hold many entries — there's no "first entry" rule.`,
      messages: [
        {
          role: "user",
          content: `Recent conversation:\n${recentMessages}\n\n${PERSONA_NAME}'s latest message:\n${sageResponse}`,
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
