import { anthropicStream } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { classifyResponse } from "@/lib/sage/classifier";
import { composeManualEntry } from "@/lib/sage/confirm-checkpoint";
import type { ExplorationContext } from "@/lib/types";
import { detectTranscript } from "@/lib/utils/transcript-detection";
import { detectUrls } from "@/lib/utils/url-detection";
import { fetchUrlContent } from "@/lib/utils/fetch-url-content";
import type { FetchedContent } from "@/lib/utils/fetch-url-content";
import {
  SAGE_MODEL,
  SAGE_MAX_TOKENS,
  loadConversationContext,
  buildPromptOptionsFromContext,
  fireBackgroundExtraction,
  handleCrisisDetection,
  applyCheckpointGates,
  buildCheckpointMeta,
  validateComposedEntry,
} from "@/lib/sage/sage-pipeline";

// ── Extracted pure functions (testable without mocking) ──

/**
 * Maps DB messages (including system messages) to conversation history.
 * System messages from checkpoint actions become synthetic user messages
 * so Sage sees them naturally in the conversation flow.
 */
export function mapSystemMessages(
  dbMessages: { role: string; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (const msg of dbMessages) {
    if (msg.role === "system") {
      if (msg.content === "[User confirmed the checkpoint]") {
        history.push({
          role: "user",
          content: "I confirmed that checkpoint. That resonates.",
        });
      } else if (msg.content === "[User rejected the checkpoint]") {
        history.push({
          role: "user",
          content: "That checkpoint didn't land right for me.",
        });
      } else if (
        msg.content === "[User wants to refine the checkpoint]"
      ) {
        history.push({
          role: "user",
          content: "That's close but not quite right.",
        });
      }
    } else {
      history.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }
  return history;
}

/**
 * Applies sliding window to conversation history.
 * Keeps first 2 + last 48 messages when over 50 total.
 */
export function applySlidingWindow(
  messages: { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  if (messages.length > 50) {
    const first2 = messages.slice(0, 2);
    const last48 = messages.slice(-48);
    return [...first2, ...last48];
  }
  return messages;
}

// Crisis phrases — must be specific enough to avoid false positives.
// Removed overly broad phrases that trigger on normal relationship distress:
//   "make it stop", "can't do this anymore", "don't want to be here"
// These appear constantly in non-crisis conversations about difficult emotions.
const CRISIS_PHRASES = [
  "kill myself",
  "hurt myself",
  "want to die",
  "end my life",
  "suicide",
  "self-harm",
  "better off without me",
  "no point anymore",
  "want to disappear",
  "not worth living",
  "no reason to keep going",
  "tired of being alive",
  "wish i wouldn't wake up",
  "wish i wouldnt wake up",
  "don't want to be here anymore",
  "dont want to be here anymore",
  "what's the point of living",
  "whats the point of living",
  "don't want to exist",
  "dont want to exist",
  "no point in living",
  "end it all",
  "don't want to wake up",
  "dont want to wake up",
  "nothing left for me",
  "can't go on like this",
  "cant go on like this",
];

export function detectCrisisInUserMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => lower.includes(phrase));
}

interface CallSageOptions {
  conversationId: string;
  userId: string;
  message: string | null;
  explorationContext?: ExplorationContext;
  promptAuth?: boolean;
}

export function callSage({
  conversationId,
  userId,
  message,
  explorationContext,
  promptAuth,
}: CallSageOptions): ReadableStream {
  const admin = createAdminClient();
  const convId = conversationId;
  const encoder = new TextEncoder();

  function emitError(controller: ReadableStreamDefaultController, msg: string) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`
      )
    );
    controller.close();
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // 1. Save user message
        if (message !== null) {
          const { error: msgError } = await admin
            .from("messages")
            .insert({
              conversation_id: convId,
              role: "user",
              content: message,
            });

          if (msgError) {
            emitError(controller, "Failed to save message. Try again.");
            return;
          }
        }

        // 2. Load shared conversation context (DB reads + user state + derived flags)
        const ctx = await loadConversationContext(admin, convId, userId);
        const {
          messages,
          manualComponents,
          previousExtraction,
          isFirstCheckpoint,
          turnsSinceCheckpoint,
          turnCount,
        } = ctx;

        // 3. Fire extraction in background
        const hasUserContent =
          message !== null && message !== "[Session started]";
        if (hasUserContent) {
          fireBackgroundExtraction(ctx, admin);
        }

        // 7b. URL detection — runs first, takes priority over transcript detection
        const urlDetection = message ? detectUrls(message) : null;
        let fetchedContent: FetchedContent | null = null;

        if (urlDetection?.hasUrl) {
          // Fetch the first URL (5-second timeout built into fetchUrlContent)
          fetchedContent = await fetchUrlContent(urlDetection.urls[0]);

          if (process.env.NODE_ENV !== "production") {
            console.log(
              "[sage-debug] URL fetched: %s | success: %s | title: %s",
              urlDetection.urls[0],
              fetchedContent.success,
              fetchedContent.title || "(none)"
            );
          }
        }

        // 7c. Transcript detection — only if no URL detected
        const transcriptDetection =
          message && !urlDetection?.hasUrl ? detectTranscript(message) : null;

        // 8. Build system prompt (shared base + web-specific fields)
        const systemPrompt = buildSystemPrompt({
          ...buildPromptOptionsFromContext(ctx),
          explorationContext,
          transcriptContext: transcriptDetection,
          contentContext: urlDetection?.hasUrl
            ? { urlDetection, fetchedContent }
            : null,
        });

        // 8b. Debug logging (dev only)
        if (process.env.NODE_ENV !== "production") {
          const gate = previousExtraction?.checkpoint_gate;
          const depth = previousExtraction?.depth;
          const mode = previousExtraction?.mode;
          const brief = previousExtraction?.sage_brief;
          const strongest = gate?.strongest_layer;

          console.log("[sage-debug] Turn %d | Depth: %s | Mode: %s | Since CP: %d", turnCount, depth || "none", mode || "none", turnsSinceCheckpoint);

          if (gate) {
            const gateMet = isFirstCheckpoint
              ? gate.concrete_examples >= 1 && gate.has_charged_language && (gate.has_mechanism || gate.has_behavior_driver_link)
              : gate.concrete_examples >= 2 && gate.has_mechanism && gate.has_charged_language && gate.has_behavior_driver_link;

            console.log("[sage-debug] Gate: examples=%d mechanism=%s charged=%s driver=%s strongest=L%s | Met: %s (first: %s)",
              gate.concrete_examples, gate.has_mechanism, gate.has_charged_language,
              gate.has_behavior_driver_link, strongest || "?", gateMet, isFirstCheckpoint);
          }

          if (brief) {
            console.log("[sage-debug] Brief: %s", brief.substring(0, 150));
          }
        }

        // 9. Stream Sage response (no inline manual-entry sentinel — composition
        //    is always handled server-side after the stream completes).
        let fullText = "";

        const flushSafe = (text: string) => {
          if (text) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text_delta", text })}\n\n`
              )
            );
          }
        };

        const rawStream = await anthropicStream({
          model: SAGE_MODEL,
          max_tokens: SAGE_MAX_TOKENS,
          system: systemPrompt,
          messages,
        });

        const reader = rawStream.getReader();
        const decoder = new TextDecoder();
        let streamBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                const text = event.delta.text;
                fullText += text;
                flushSafe(text);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        if (!fullText) {
          emitError(
            controller,
            "Sage lost the thread. Try sending that again."
          );
          return;
        }

        // 10. Conversational text is the full Sage response (no inline sentinel).
        let conversationalText = fullText;

        // 10b. Crisis detection — output validation + logging
        if (message !== null) {
          const crisis = handleCrisisDetection(
            message,
            conversationalText,
            convId,
            userId,
            admin
          );
          if (crisis.crisisDetected && crisis.responseText !== conversationalText) {
            // Crisis resources were appended — flush to client
            const appended = crisis.responseText.slice(conversationalText.length);
            flushSafe(appended);
          }
          conversationalText = crisis.responseText;
        }

        // 11. Save Sage's response (conversational part only)
        const { data: savedResponse } = await admin
          .from("messages")
          .insert({
            conversation_id: convId,
            role: "assistant",
            content: conversationalText,
          })
          .select("id")
          .single();

        const messageId = savedResponse?.id || null;

        // 11b. Save extraction snapshot (defensive — column may not exist yet)
        if (messageId && previousExtraction) {
          admin
            .from("messages")
            .update({ extraction_snapshot: previousExtraction })
            .eq("id", messageId)
            .then(({ error }) => {
              if (error && !error.message.includes("extraction_snapshot")) {
                console.error("[callSage] Failed to save extraction snapshot:", error);
              }
            });
        }

        // 12. Classification: always run the classifier on the conversational text.
        //     Composition is handled separately by composeManualEntry below.
        let isCheckpoint = false;
        let checkpointLayer: number | null = null;
        let checkpointType: string | null = null;
        let checkpointName: string | null = null;
        let processingText = "listening...";

        {
          const last4 = messages.slice(-4);
          const recentText = last4
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n\n");

          const isFirstSession =
            !manualComponents || manualComponents.length === 0;
          const layersWithComponents = (manualComponents || [])
            .filter((c) => c.type === "component")
            .map((c) => c.layer);
          const classification = await classifyResponse(
            conversationalText,
            recentText,
            isFirstSession,
            layersWithComponents
          );

          isCheckpoint = classification.isCheckpoint;
          checkpointLayer = classification.layer;
          checkpointType = classification.type;
          checkpointName = classification.name;
          processingText = classification.processingText;
        }

        // 12b. Shared checkpoint gates (layer guards + material quality + turn-count)
        if (isCheckpoint && checkpointLayer) {
          const gateResult = applyCheckpointGates(
            { layer: checkpointLayer, type: checkpointType || "component", name: checkpointName || "" },
            manualComponents,
            turnsSinceCheckpoint,
            previousExtraction,
            isFirstCheckpoint
          );
          isCheckpoint = gateResult.isCheckpoint;
          checkpointLayer = gateResult.layer;
          checkpointType = gateResult.type;
          checkpointName = gateResult.name;
        }

        // 12b-log. Checkpoint detection debug log (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.log("[sage-debug] %s", isCheckpoint
            ? `CHECKPOINT: L${checkpointLayer} ${checkpointType} "${checkpointName}"`
            : "No checkpoint this turn");
        }

        // 12c. Composition: when the classifier detects a checkpoint, always
        //      compose the polished manual entry server-side so composed_content
        //      is ready at confirmation. The main Sage prompt no longer carries
        //      composition rules — they live in confirm-checkpoint.ts.
        let composedEntry: {
          content: string;
          name: string;
          changelog: string;
        } | null = null;

        if (isCheckpoint && checkpointLayer) {
          try {
            const existingLayerContent = (manualComponents || []).filter(
              (c) => c.layer === checkpointLayer
            );

            composedEntry = await composeManualEntry({
              checkpointText: conversationalText,
              conversationHistory: messages,
              languageBank: previousExtraction?.language_bank || [],
              layer: checkpointLayer,
              type: (checkpointType as "component" | "pattern") || "component",
              name: checkpointName,
              existingLayerContent:
                existingLayerContent.length > 0
                  ? existingLayerContent
                  : undefined,
            });

            // Soft post-validation: log structural drift without blocking.
            if (composedEntry?.content) {
              const validation = validateComposedEntry(
                composedEntry.content,
                (checkpointType as "component" | "pattern") || "component"
              );
              if (!validation.ok) {
                console.warn(
                  "[callSage] Composed entry structural drift: %s",
                  validation.warnings.join("; ")
                );
              }
            }
          } catch (err) {
            console.error(
              "[callSage] Composition failed, saving without composed_content:",
              err
            );
          }
        }

        // 13. Update message metadata
        if (messageId) {
          const updateData: Record<string, unknown> = {
            processing_text: processingText,
          };

          if (isCheckpoint) {
            updateData.is_checkpoint = true;
            updateData.checkpoint_meta = buildCheckpointMeta(
              { isCheckpoint, layer: checkpointLayer, type: checkpointType, name: checkpointName },
              composedEntry
            );
          }

          await admin
            .from("messages")
            .update(updateData)
            .eq("id", messageId);
        }

        // 14. Emit final event
        const checkpoint = isCheckpoint
          ? {
              isCheckpoint: true,
              layer: checkpointLayer,
              type: checkpointType,
              name: checkpointName,
            }
          : null;

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "message_complete",
              messageId,
              conversationId: convId,
              checkpoint,
              processingText,
              nextPrompt: previousExtraction?.next_prompt || "",
              ...(promptAuth ? { promptAuth: true } : {}),
            })}\n\n`
          )
        );

        controller.close();
      } catch (err) {
        const isTimeout =
          err instanceof Error && err.name === "AbortError";
        const msg = isTimeout
          ? "Sage took too long to respond. Try again."
          : "Sage lost the thread. Try sending that again.";
        console.error("[callSage] Error:", err);
        emitError(controller, msg);
      }
    },
  });
}
