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

export async function classifyResponse(
  sageResponse: string,
  recentMessages: string
): Promise<ClassificationResult> {
  try {
    const response = await anthropicFetch({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `You analyze messages from a conversational AI called Sage that builds behavioral models. Two jobs:

1. CHECKPOINT DETECTION: Is this message a checkpoint? A checkpoint is a sustained reflection (usually 100+ words) where Sage proposes a component or pattern of the user's behavioral model. It traces behavior using the user's own words and specific examples. It typically ends by offering a name and asking for validation ("Does that fit?" or "What would you change?"). Short observations, questions, transitions, and the post-checkpoint fork ("Two directions: Work with it / Keep building") are NOT checkpoints.

2. PROCESSING TEXT: Generate a short phrase (5-12 words) representing what Sage is currently tracking. Should sound like internal notes. Examples: "trust patterns... conditional, earned not given" or "the shutdown is protection, not avoidance" or "seeing a loop forming around control and withdrawal"

Respond with ONLY this JSON, no markdown, no backticks:
{"is_checkpoint":true/false,"layer":null or 1 or 2 or 3,"type":null or "component" or "pattern","name":null or "The Proposed Name","processing_text":"short tracking phrase"}

Layer guide:
Layer 1 (What Drives You): needs, values, motivation, what they protect
Layer 2 (How You React): beliefs, emotional processing, coping, pressure responses
Layer 3 (How You Relate): communication, trust, conflict, relational patterns

If checkpoint: pick strongest layer. Recurring loop (trigger → response → cost) = "pattern". Broader narrative = "component". Extract headline if present.`,
      messages: [
        {
          role: "user",
          content: `Recent conversation:\n${recentMessages}\n\nSage's latest message:\n${sageResponse}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown backticks if present
    const cleaned = rawText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error(
        "[classifier] JSON parse failed. Raw text:",
        rawText,
        "Error:",
        parseErr
      );
      return FALLBACK;
    }

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
  } catch (err) {
    console.error("[classifier] API call failed:", err);
    return FALLBACK;
  }
}
