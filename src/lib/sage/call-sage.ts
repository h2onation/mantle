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
        const history: { role: "user" | "assistant"; content: string }[] = [];
        if (historyResult.data) {
          for (const msg of historyResult.data) {
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
        }

        // 4. Sliding window: first 2 + last 48 if over 50
        let messages = history;
        if (messages.length > 50) {
          const first2 = messages.slice(0, 2);
          const last48 = messages.slice(-48);
          messages = [...first2, ...last48];
        }

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
        const DELIMITER = "|||MANUAL_ENTRY|||";

        // Buffer for prefix-matching against the delimiter.
        // We hold back tokens that could be the start of the delimiter
        // so the client never sees |||MANUAL_ENTRY||| or the JSON after it.
        let pendingBuffer = "";
        let delimiterFound = false;

        const flushSafe = (text: string) => {
          // Send text that is confirmed safe (not part of delimiter)
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

                // ── Delimiter buffer logic ──
                if (delimiterFound) {
                  // Already past delimiter — silently accumulate, don't send
                  continue;
                }

                pendingBuffer += text;

                // Check if pending buffer contains the full delimiter
                const delimIdx = pendingBuffer.indexOf(DELIMITER);
                if (delimIdx !== -1) {
                  // Found it! Flush everything before the delimiter, suppress the rest
                  const safe = pendingBuffer.substring(0, delimIdx);
                  flushSafe(safe);
                  delimiterFound = true;
                  pendingBuffer = "";
                  continue;
                }

                // Check if the end of the pending buffer could be the start of the delimiter
                let prefixMatch = 0;
                for (
                  let i = 1;
                  i <= Math.min(pendingBuffer.length, DELIMITER.length);
                  i++
                ) {
                  if (pendingBuffer.endsWith(DELIMITER.substring(0, i))) {
                    prefixMatch = i;
                  }
                }

                if (prefixMatch > 0) {
                  // Hold back the potential prefix, flush everything before it
                  const safe = pendingBuffer.substring(
                    0,
                    pendingBuffer.length - prefixMatch
                  );
                  flushSafe(safe);
                  pendingBuffer = pendingBuffer.substring(
                    pendingBuffer.length - prefixMatch
                  );
                } else {
                  // No match possible — flush everything
                  flushSafe(pendingBuffer);
                  pendingBuffer = "";
                }
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Flush any remaining buffer that wasn't a delimiter
        if (!delimiterFound && pendingBuffer) {
          flushSafe(pendingBuffer);
        }

        if (!fullText) {
          emitError(
            controller,
            "Sage lost the thread. Try sending that again."
          );
          return;
        }

        // 10. Parse and strip manual entry block if present
        let conversationalText = fullText;
        let manualEntry: {
          layer: number;
          type: string;
          name: string;
          content: string;
          changelog: string;
        } | null = null;

        const entryDelimiter = "|||MANUAL_ENTRY|||";
        const endDelimiter = "|||END_MANUAL_ENTRY|||";
        const entryStart = fullText.indexOf(entryDelimiter);

        if (entryStart !== -1) {
          conversationalText = fullText.substring(0, entryStart).trimEnd();
          const jsonStart = entryStart + entryDelimiter.length;
          const jsonEnd = fullText.indexOf(endDelimiter);
          if (jsonEnd !== -1) {
            const jsonStr = fullText.substring(jsonStart, jsonEnd).trim();
            try {
              manualEntry = JSON.parse(jsonStr);
            } catch {
              console.error("[callSage] Failed to parse manual entry JSON");
            }
          }
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
