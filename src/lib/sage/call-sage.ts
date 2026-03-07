import { anthropicStream } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { classifyResponse } from "@/lib/sage/classifier";
import { composeManualEntry } from "@/lib/sage/confirm-checkpoint";
import {
  runExtraction,
  formatExtractionForSage,
  type ExtractionState,
} from "@/lib/sage/extraction";
import type { ExplorationContext } from "@/lib/types";

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

/**
 * Parses the |||MANUAL_ENTRY||| ... |||END_MANUAL_ENTRY||| block
 * from Sage's full response text. Returns the conversational text
 * (before delimiter) and the parsed manual entry JSON (if valid).
 */
export function parseManualEntryBlock(fullText: string): {
  conversationalText: string;
  manualEntry: {
    layer: number;
    type: string;
    name: string;
    content: string;
    changelog: string;
  } | null;
} {
  const entryDelimiter = "|||MANUAL_ENTRY|||";
  const endDelimiter = "|||END_MANUAL_ENTRY|||";
  const entryStart = fullText.indexOf(entryDelimiter);

  if (entryStart === -1) {
    return { conversationalText: fullText, manualEntry: null };
  }

  const conversationalText = fullText.substring(0, entryStart).trimEnd();
  const jsonStart = entryStart + entryDelimiter.length;
  const jsonEnd = fullText.indexOf(endDelimiter);

  if (jsonEnd === -1) {
    return { conversationalText, manualEntry: null };
  }

  const jsonStr = fullText.substring(jsonStart, jsonEnd).trim();
  try {
    return { conversationalText, manualEntry: JSON.parse(jsonStr) };
  } catch {
    return { conversationalText, manualEntry: null };
  }
}

/**
 * Creates a streaming delimiter buffer that prefix-matches against a delimiter string.
 * Holds back tokens that could be the start of the delimiter so the client
 * never sees the delimiter or anything after it.
 */
export function createDelimiterBuffer(delimiter: string) {
  let pendingBuffer = "";
  let delimiterFound = false;

  return {
    /**
     * Process an incoming text chunk. Returns the safe text to flush
     * (text confirmed NOT to be part of the delimiter).
     * Returns null if the delimiter has been found (suppress all further output)
     * or if nothing safe to flush yet.
     */
    process(text: string): string | null {
      if (delimiterFound) return null;

      pendingBuffer += text;

      // Check if pending buffer contains the full delimiter
      const delimIdx = pendingBuffer.indexOf(delimiter);
      if (delimIdx !== -1) {
        const safe = pendingBuffer.substring(0, delimIdx);
        delimiterFound = true;
        pendingBuffer = "";
        return safe || null;
      }

      // Check if the end of the pending buffer could be the start of the delimiter
      let prefixMatch = 0;
      for (
        let i = 1;
        i <= Math.min(pendingBuffer.length, delimiter.length);
        i++
      ) {
        if (pendingBuffer.endsWith(delimiter.substring(0, i))) {
          prefixMatch = i;
        }
      }

      if (prefixMatch > 0) {
        // Hold back the potential prefix, flush everything before it
        const safe = pendingBuffer.substring(
          0,
          pendingBuffer.length - prefixMatch
        );
        pendingBuffer = pendingBuffer.substring(
          pendingBuffer.length - prefixMatch
        );
        return safe || null;
      }

      // No match possible — flush everything
      const safe = pendingBuffer;
      pendingBuffer = "";
      return safe;
    },

    /** Flush any remaining buffered text (call at stream end) */
    flush(): string | null {
      if (delimiterFound) return null;
      const remaining = pendingBuffer;
      pendingBuffer = "";
      return remaining || null;
    },

    /** Whether the delimiter has been found */
    get found(): boolean {
      return delimiterFound;
    },
  };
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

const CRISIS_RESOURCES =
  "\n\nIf you're in crisis or need immediate support, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988. You can also text HOME to 741741 to reach the Crisis Text Line. Both are free, confidential, and available now.";

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

        // 2. Parallel DB reads: history + manual components + extraction state
        const [historyResult, manualResult, extractionResult] =
          await Promise.all([
            admin
              .from("messages")
              .select("role, content")
              .eq("conversation_id", convId)
              .order("created_at", { ascending: true }),
            admin
              .from("manual_components")
              .select("layer, type, name, content")
              .eq("user_id", userId),
            admin
              .from("conversations")
              .select("extraction_state, summary")
              .eq("id", convId)
              .single(),
          ]);

        // 3. Build history from DB messages
        const history = mapSystemMessages(historyResult.data || []);

        // 4. Sliding window: first 2 + last 48 if over 50
        let messages = applySlidingWindow(history);

        if (messages.length === 0) {
          messages = [{ role: "user", content: "[Session started]" }];
        }

        const manualComponents = manualResult.data;

        // 5. Determine returning user + session context
        const isReturningUser =
          (manualComponents && manualComponents.length > 0) || false;
        const isFirstCheckpoint = !isReturningUser;

        // Session summary already loaded in the parallel fetch above
        const sessionSummary: string | null =
          extractionResult.data?.summary ?? null;
        let sessionCount = 1;

        if (isReturningUser) {
          // Only need conversation count — fire a single query
          const { count } = await admin
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);

          sessionCount = count || 1;
        }

        // 6. Extraction state from parallel fetch
        const previousExtraction: ExtractionState | null =
          extractionResult.data?.extraction_state ?? null;

        // 7. Fire extraction in background — runs in parallel with Sage stream.
        //    Sage uses the PREVIOUS turn's extraction state (already loaded).
        //    Updated state saves to DB for the next turn.
        const hasUserContent =
          message !== null && message !== "[Session started]";

        if (hasUserContent) {
          runExtraction(
            messages,
            previousExtraction,
            manualComponents || [],
            isFirstCheckpoint
          )
            .then(async (newState) => {
              // Re-read current extraction_state to pick up any discovery_mode
              // changes made by confirmCheckpoint() while extraction was running.
              const { data: currentConv } = await admin
                .from("conversations")
                .select("extraction_state")
                .eq("id", convId)
                .single();

              if (currentConv?.extraction_state) {
                const currentState =
                  currentConv.extraction_state as ExtractionState;
                // Preserve the current discovery_mode (may have been flipped by confirmCheckpoint)
                for (let i = 1; i <= 5; i++) {
                  if (newState.layers[i] && currentState.layers[i]) {
                    newState.layers[i].discovery_mode =
                      currentState.layers[i].discovery_mode;
                  }
                }
                // Preserve confirmed_patterns (managed by confirmCheckpoint, not extraction)
                newState.confirmed_patterns =
                  currentState.confirmed_patterns || [];
              }

              const { error } = await admin
                .from("conversations")
                .update({ extraction_state: newState })
                .eq("id", convId);

              if (error)
                console.error(
                  "[callSage] Failed to save extraction state:",
                  error
                );
            })
            .catch((err) =>
              console.error(
                "[callSage] Background extraction failed:",
                err
              )
            );
        }

        // 8. Build system prompt using PREVIOUS extraction state (no waiting)
        const extractionForSage = previousExtraction
          ? formatExtractionForSage(
              previousExtraction,
              isFirstCheckpoint,
              manualComponents || []
            )
          : "";

        // Derive conditional-loading flags from data already in memory
        const turnCount = messages.length;
        const hasPatternEligibleLayer = previousExtraction
          ? Object.values(previousExtraction.layers).some(
              (l) => l.discovery_mode === "pattern"
            )
          : false;
        const checkpointApproaching = previousExtraction
          ? Object.values(previousExtraction.layers).some(
              (l) =>
                l.signal === "emerging" ||
                l.signal === "explored" ||
                l.signal === "checkpoint_ready"
            )
          : false;

        const systemPrompt = buildSystemPrompt({
          manualComponents: manualComponents || [],
          isReturningUser,
          sessionSummary,
          extractionContext: extractionForSage,
          isFirstCheckpoint,
          sessionCount,
          explorationContext,
          turnCount,
          hasPatternEligibleLayer,
          checkpointApproaching,
        });

        // 8b. Debug logging (dev only)
        if (process.env.NODE_ENV !== "production") {
          const gate = previousExtraction?.checkpoint_gate;
          const depth = previousExtraction?.depth;
          const mode = previousExtraction?.mode;
          const brief = previousExtraction?.sage_brief;
          const strongest = gate?.strongest_layer;

          console.log("[sage-debug] Turn %d | Depth: %s | Mode: %s", turnCount, depth || "none", mode || "none");

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

        // 9. Stream Sage response with delimiter buffer
        let fullText = "";
        const delimBuffer = createDelimiterBuffer("|||MANUAL_ENTRY|||");

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
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
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

                const safe = delimBuffer.process(text);
                if (safe) flushSafe(safe);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Flush any remaining buffer that wasn't a delimiter
        const remaining = delimBuffer.flush();
        if (remaining) flushSafe(remaining);

        if (!fullText) {
          emitError(
            controller,
            "Sage lost the thread. Try sending that again."
          );
          return;
        }

        // 10. Parse and strip manual entry block if present
        const parsed = parseManualEntryBlock(fullText);
        const { manualEntry } = parsed;
        let conversationalText = parsed.conversationalText;
        const entryStart = fullText.indexOf("|||MANUAL_ENTRY|||");

        // 10b. Crisis detection — output validation + logging
        if (message !== null && detectCrisisInUserMessage(message)) {
          const sageIncluded988 = fullText.includes("988");

          if (!sageIncluded988) {
            fullText += CRISIS_RESOURCES;
            conversationalText += CRISIS_RESOURCES;

            // Flush the appended crisis resources to the client
            flushSafe(CRISIS_RESOURCES);
          }

          console.log("[callSage] CRISIS DETECTED", {
            timestamp: new Date().toISOString(),
            conversation_id: convId,
            crisis_detected: true,
            sage_included_988: sageIncluded988,
          });

          admin
            .from("safety_events")
            .insert({
              conversation_id: convId,
              user_id: userId,
              crisis_detected: true,
              sage_included_988: sageIncluded988,
              created_at: new Date().toISOString(),
            })
            .then(({ error }) => {
              if (error)
                console.error(
                  "[callSage] Failed to log safety event:",
                  error
                );
            });
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

        // 12. Classification: skip Haiku classifier when manual entry is present
        //     (Sage already decided it's a checkpoint and provided all metadata)
        let isCheckpoint = false;
        let checkpointLayer: number | null = null;
        let checkpointType: string | null = null;
        let checkpointName: string | null = null;
        let processingText = "listening...";

        if (manualEntry) {
          // Manual entry = Sage produced a checkpoint with all metadata
          isCheckpoint = true;
          checkpointLayer = manualEntry.layer;
          checkpointType = manualEntry.type;
          checkpointName = manualEntry.name;
          // Derive processingText from extraction brief instead of Haiku call
          processingText =
            previousExtraction?.current_thread || "checkpoint reached...";
        } else {
          // No manual entry — run classifier as normal
          const last4 = history.slice(-4);
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

        // 12b. Hard guard: enforce component/pattern layer rules.
        //      Rule 1: First entry on any layer must be a component.
        //      Rule 2: Only one component per layer — force to pattern if component exists.
        if (isCheckpoint && checkpointLayer) {
          const layerHasComponent = (manualComponents || []).some(
            (c) => c.layer === checkpointLayer && c.type === "component"
          );

          if (checkpointType === "pattern" && !layerHasComponent) {
            // Rule 1: No component on this layer yet — force to component
            checkpointType = "component";
            if (manualEntry) {
              manualEntry.type = "component";
            }
          } else if (checkpointType === "component" && layerHasComponent) {
            // Rule 2: Component already exists — force to pattern
            checkpointType = "pattern";
            if (manualEntry) {
              manualEntry.type = "pattern";
            }
          }
        }

        // 12b-log. Checkpoint detection debug log (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.log("[sage-debug] %s", isCheckpoint
            ? `CHECKPOINT: L${checkpointLayer} ${checkpointType} "${checkpointName}" via ${manualEntry ? "Path A" : "Path B"}`
            : "No checkpoint this turn");
        }

        // 12c. Path B composition: when classifier detected a checkpoint but
        //      Sage didn't produce a |||MANUAL_ENTRY||| block, compose the
        //      manual entry now so composed_content is ready at confirmation.
        let composedEntry: {
          content: string;
          name: string;
          changelog: string;
        } | null = null;

        const hasComposedContent =
          manualEntry?.content && manualEntry.content.length > 0;

        if (isCheckpoint && checkpointLayer && !hasComposedContent) {
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
          } catch (err) {
            console.error(
              "[callSage] Path B composition failed, saving without composed_content:",
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
            updateData.checkpoint_meta = {
              layer: checkpointLayer,
              type: checkpointType,
              name: composedEntry?.name || manualEntry?.name || checkpointName,
              status: "pending",
              composed_content:
                manualEntry?.content || composedEntry?.content || null,
              composed_name:
                manualEntry?.name || composedEntry?.name || null,
              changelog:
                manualEntry?.changelog || composedEntry?.changelog || null,
            };
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
              cleanContent:
                entryStart !== -1 ? conversationalText : undefined,
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
