import { anthropicStream } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { classifyResponse } from "@/lib/sage/classifier";
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

interface CallSageOptions {
  conversationId: string;
  userId: string;
  message: string | null;
  explorationContext?: ExplorationContext;
}

export function callSage({
  conversationId,
  userId,
  message,
  explorationContext,
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
            .then((newState) => {
              admin
                .from("conversations")
                .update({ extraction_state: newState })
                .eq("id", convId)
                .then(({ error }) => {
                  if (error)
                    console.error(
                      "[callSage] Failed to save extraction state:",
                      error
                    );
                });
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

        const systemPrompt = buildSystemPrompt(
          manualComponents || [],
          isReturningUser,
          sessionSummary,
          extractionForSage,
          isFirstCheckpoint,
          sessionCount,
          explorationContext
        );

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
        const { conversationalText, manualEntry } =
          parseManualEntryBlock(fullText);
        const entryStart = fullText.indexOf("|||MANUAL_ENTRY|||");

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
          const classification = await classifyResponse(
            conversationalText,
            recentText,
            isFirstSession
          );

          isCheckpoint = classification.isCheckpoint;
          checkpointLayer = classification.layer;
          checkpointType = classification.type;
          checkpointName = classification.name;
          processingText = classification.processingText;
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
              name: checkpointName,
              status: "pending",
              composed_content: manualEntry?.content || null,
              composed_name: manualEntry?.name || null,
              changelog: manualEntry?.changelog || null,
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
