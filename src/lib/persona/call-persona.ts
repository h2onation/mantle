import { anthropicStream } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONA_NAME } from "@/lib/persona/config";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { classifyResponse } from "@/lib/persona/classifier";
import { composeManualEntry } from "@/lib/persona/confirm-checkpoint";
import type { ExplorationContext } from "@/lib/types";
import { detectTranscript } from "@/lib/utils/transcript-detection";
import { detectUrls } from "@/lib/utils/url-detection";
import { fetchUrlContent } from "@/lib/utils/fetch-url-content";
import type { FetchedContent } from "@/lib/utils/fetch-url-content";
import {
  PERSONA_MODEL,
  PERSONA_MAX_TOKENS,
  loadConversationContext,
  buildPromptOptionsFromContext,
  fireBackgroundExtraction,
  handleCrisisDetection,
  applyCheckpointGates,
  buildCheckpointMeta,
  computeInheritedRefinementCount,
  validateComposedEntry,
  validateResponseStructure,
} from "@/lib/persona/persona-pipeline";

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
      } else if (msg.content === "[User let the checkpoint go]") {
        // Track A Phase 7-Mid: refinement-ceiling defer. Distinct
        // from rejection — the user has already explained twice
        // what was off and is choosing to set it aside, not
        // saying it missed entirely. POST-REJECTION fixed line
        // does not fire for this message.
        history.push({
          role: "user",
          content:
            "I'll let that one go for now. We can come back to it.",
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

/**
 * Messages that are server-templated (not LLM-generated) and should be
 * emitted as their own message_complete events BEFORE the main LLM
 * stream begins. Used by Track A Phase 7-High's 7e flow to deliver the
 * first-lifetime Message 1 stamp ("In. A working name: ...") without
 * an LLM call.
 *
 * Each entry produces one message_complete event with checkpoint: null
 * (bubble render on the client). The checkpoint payload is intentionally
 * NOT configurable here — a checkpoint must always come from the
 * classifier + composer path, never shortcut through prependedMessages.
 * The type enforces this at compile time.
 */
export interface PrependedAssistantMessage {
  messageId: string;
  content: string;
}

interface CallPersonaOptions {
  conversationId: string;
  userId: string;
  message: string | null;
  explorationContext?: ExplorationContext;
  promptAuth?: boolean;
  /** Track A Phase 7-High — messages to emit on this stream before the
   *  main LLM response starts. Each is rendered as a normal assistant
   *  bubble (checkpoint: null). Empty / undefined = no prepends. */
  prependedMessages?: PrependedAssistantMessage[];
  /** Track A Phase 7-High — when set, this invocation is a post-confirm
   *  follow-up call, not a regular chat turn. Classifier, composer,
   *  and checkpoint_meta writes are skipped. The system prompt loads
   *  a mode-specific pinned-template block via buildSystemPrompt's
   *  postConfirmMode option. */
  postConfirmMode?: "first-message-2" | "subsequent-single" | null;
  postConfirmContext?: {
    layerName: string;
    proposedHeadline: string;
    entriesSummary: string;
  } | null;
}

export function callPersona({
  conversationId,
  userId,
  message,
  explorationContext,
  promptAuth,
  prependedMessages,
  postConfirmMode = null,
  postConfirmContext = null,
}: CallPersonaOptions): ReadableStream {
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

  /**
   * Emit a single message_complete SSE event for a server-authored
   * (non-LLM) assistant message. Used by prependedMessages at stream
   * start AND by the 7f subsequent-checkpoint transition insert. Never
   * carries a checkpoint payload — checkpoints must flow through the
   * classifier + composer path, not this helper.
   */
  function emitInlineMessage(
    controller: ReadableStreamDefaultController,
    messageId: string,
    content: string
  ) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "message_complete",
          messageId,
          conversationId: convId,
          checkpoint: null,
          processingText: "",
          cleanContent: content,
        })}\n\n`
      )
    );
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // 0. Emit prepended assistant messages (Track A Phase 7-High).
        //    Used by 7e to deliver the first-lifetime Message 1 stamp
        //    before the Message 2 LLM stream begins. Each prepend fires
        //    as an independent message_complete event with checkpoint:
        //    null so the client renders them as normal bubbles.
        if (prependedMessages && prependedMessages.length > 0) {
          for (const pre of prependedMessages) {
            emitInlineMessage(controller, pre.messageId, pre.content);
          }
        }

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
              "[persona-debug] URL fetched: %s | success: %s | title: %s",
              urlDetection.urls[0],
              fetchedContent.success,
              fetchedContent.title || "(none)"
            );
          }
        }

        // 7c. Transcript detection — only if no URL detected
        const transcriptDetection =
          message && !urlDetection?.hasUrl ? detectTranscript(message) : null;

        // 8. Build system prompt (shared base + web-specific fields +
        //    Phase 7-High post-confirm mode when invoked from the
        //    confirm route for a post-confirm follow-up turn).
        const systemPrompt = buildSystemPrompt({
          ...buildPromptOptionsFromContext(ctx),
          explorationContext,
          transcriptContext: transcriptDetection,
          contentContext: urlDetection?.hasUrl
            ? { urlDetection, fetchedContent }
            : null,
          postConfirmMode,
          postConfirmContext,
        });

        // 8b. Debug logging (dev only)
        if (process.env.NODE_ENV !== "production") {
          const gate = previousExtraction?.checkpoint_gate;
          const depth = previousExtraction?.depth;
          const mode = previousExtraction?.mode;
          const brief = previousExtraction?.sage_brief;
          const strongest = gate?.strongest_layer;

          console.log("[persona-debug] Turn %d | Depth: %s | Mode: %s | Since CP: %d", turnCount, depth || "none", mode || "none", turnsSinceCheckpoint);

          if (gate) {
            const gateMet = isFirstCheckpoint
              ? gate.concrete_examples >= 1 && gate.has_charged_language && (gate.has_mechanism || gate.has_behavior_driver_link)
              : gate.concrete_examples >= 2 && gate.has_mechanism && gate.has_charged_language && gate.has_behavior_driver_link;

            console.log("[persona-debug] Gate: examples=%d mechanism=%s charged=%s driver=%s strongest=L%s | Met: %s (first: %s)",
              gate.concrete_examples, gate.has_mechanism, gate.has_charged_language,
              gate.has_behavior_driver_link, strongest || "?", gateMet, isFirstCheckpoint);
          }

          if (brief) {
            console.log("[persona-debug] Brief: %s", brief.substring(0, 150));
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
          model: PERSONA_MODEL,
          max_tokens: PERSONA_MAX_TOKENS,
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
            `${PERSONA_NAME} lost the thread. Try sending that again.`
          );
          return;
        }

        // 10. Conversational text is the full Sage response.
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

        // 11. Save Sage's response (conversational part only).
        //     Include created_at so the 7f transition insert below can
        //     offset its own timestamp to sort before this row in
        //     time-ordered queries.
        const { data: savedResponse } = await admin
          .from("messages")
          .insert({
            conversation_id: convId,
            role: "assistant",
            content: conversationalText,
          })
          .select("id, created_at")
          .single();

        const messageId = savedResponse?.id || null;
        const savedResponseCreatedAt: string | null =
          savedResponse?.created_at ?? null;

        // 11a. Response structure validation (logs violations, does not block).
        //      Runs on fullText — the raw model output — not conversationalText,
        //      which may have had crisis 988 resources appended. CRISIS_RESOURCES
        //      contains an em dash that would trip the dash_usage check.
        validateResponseStructure(fullText, messageId);

        // 11b. Save extraction snapshot. The column is guaranteed present
        //      in the 20260417 squash baseline; any error here is a real
        //      DB failure, not schema drift.
        if (messageId && previousExtraction) {
          admin
            .from("messages")
            .update({ extraction_snapshot: previousExtraction })
            .eq("id", messageId)
            .then(({ error }) => {
              if (error) {
                console.error("[callPersona] Failed to save extraction snapshot:", error);
              }
            });
        }

        // 12. Classification: run the classifier on the conversational
        //     text. Skipped for post-confirm follow-up calls — Jove is
        //     producing scaffolding for a JUST-confirmed entry, not
        //     proposing a new one, so classifier output would be
        //     noise (and would risk double-checkpointing if the
        //     LLM's post-confirm language triggered a false positive).
        //     Composition is handled separately by composeManualEntry
        //     below, also gated on isCheckpoint.
        let isCheckpoint = false;
        let checkpointLayer: number | null = null;
        let checkpointName: string | null = null;
        let processingText = "listening...";

        if (postConfirmMode === null) {
          const last4 = messages.slice(-4);
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
          checkpointName = classification.name;
          processingText = classification.processingText;
        }

        // 12b. Shared checkpoint gates (material quality + turn-count)
        if (isCheckpoint && checkpointLayer) {
          const gateResult = applyCheckpointGates(
            { layer: checkpointLayer, name: checkpointName || "" },
            manualComponents,
            turnsSinceCheckpoint,
            previousExtraction,
            isFirstCheckpoint
          );
          isCheckpoint = gateResult.isCheckpoint;
          checkpointLayer = gateResult.layer;
          checkpointName = gateResult.name;
        }

        // 12b-log. Checkpoint detection debug log (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.log("[persona-debug] %s", isCheckpoint
            ? `CHECKPOINT: L${checkpointLayer} "${checkpointName}"`
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
          summary: string;
          key_words: string[];
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
              name: checkpointName,
              existingLayerContent:
                existingLayerContent.length > 0
                  ? existingLayerContent
                  : undefined,
            });

            // Soft post-validation: log structural drift without blocking.
            if (composedEntry?.content) {
              const validation = validateComposedEntry(composedEntry.content);
              if (!validation.ok) {
                console.warn(
                  "[callPersona] Composed entry structural drift: %s",
                  validation.warnings.join("; ")
                );
              }
            }
          } catch (err) {
            console.error(
              "[callPersona] Composition failed, saving without composed_content:",
              err
            );
          }
        }

        // 12d. Track A Phase 7-Mid: refinement_count chain inheritance.
        //      Look up the most recent prior checkpoint in this
        //      conversation. If its status was "refined", inherit the
        //      count; otherwise start at 0. The value is the FINAL
        //      refinement_count for this new checkpoint (no +1 here —
        //      incrementing happens at action time on the prior
        //      checkpoint, see /api/checkpoint/confirm). Lifted to
        //      this scope so the SSE message_complete payload below
        //      can also surface it to the client.
        let checkpointRefinementCount = 0;
        if (isCheckpoint && messageId) {
          const { data: priorCheckpoint } = await admin
            .from("messages")
            .select("checkpoint_meta")
            .eq("conversation_id", convId)
            .eq("is_checkpoint", true)
            .neq("id", messageId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          checkpointRefinementCount = computeInheritedRefinementCount(
            priorCheckpoint?.checkpoint_meta as
              | { status?: string; refinement_count?: number }
              | null
          );
        }

        // 13. Update message metadata
        if (messageId) {
          const updateData: Record<string, unknown> = {
            processing_text: processingText,
          };

          if (isCheckpoint) {
            updateData.is_checkpoint = true;
            updateData.checkpoint_meta = buildCheckpointMeta(
              { isCheckpoint, layer: checkpointLayer, name: checkpointName },
              composedEntry,
              checkpointRefinementCount
            );
          }

          await admin
            .from("messages")
            .update(updateData)
            .eq("id", messageId);
        }

        // 13b. Subsequent-checkpoint transition (Track A Phase 7-High /
        //      7f). Before the checkpoint card's message_complete
        //      fires, emit a separate inline message with the static
        //      transition line — but only when the user has at least
        //      one prior confirmed entry (i.e. this is NOT the first
        //      lifetime checkpoint; Modal 3 handles that case).
        //
        //      The transition is a normal assistant message in the
        //      conversation, persisted so it appears on reload and
        //      flows into future Jove context naturally. Its created_at
        //      is set 1 second earlier than the checkpoint message's
        //      created_at so time-ordered fetches return the transition
        //      first on reload. (The checkpoint message was inserted
        //      earlier in this flow; moving that insert later would
        //      ripple through messageId-dependent code, and the 1 s
        //      offset is a pragmatic shortcut.)
        if (
          isCheckpoint &&
          manualComponents &&
          manualComponents.length >= 1 &&
          savedResponseCreatedAt
        ) {
          const TRANSITION_LINE =
            "Something else is forming. Let me put this one in front of you.";
          const transitionCreatedAt = new Date(
            new Date(savedResponseCreatedAt).getTime() - 1000
          ).toISOString();
          const { data: transitionRow } = await admin
            .from("messages")
            .insert({
              conversation_id: convId,
              role: "assistant",
              content: TRANSITION_LINE,
              created_at: transitionCreatedAt,
            })
            .select("id")
            .single();
          if (transitionRow?.id) {
            emitInlineMessage(controller, transitionRow.id, TRANSITION_LINE);
          }
        }

        // 14. Emit final event
        const checkpoint = isCheckpoint
          ? {
              isCheckpoint: true,
              layer: checkpointLayer,
              name: checkpointName,
              // Surface the refinement_count to the client so the
              // ceiling card UI fires on the third+ attempt without
              // requiring a separate fetch. Track A Phase 7-Mid.
              refinement_count: checkpointRefinementCount,
            }
          : null;

        // Modal 2 trigger inputs. Use previousExtraction (one-turn lag)
        // since current-turn extraction runs in parallel and isn't ready
        // when this event fires. Same pattern as nextPrompt above.
        const hasLayerEmergingOrBeyond = previousExtraction
          ? Object.values(previousExtraction.layers).some(
              (l) => l.signal !== "none"
            )
          : false;

        // cleanContent is mandatory when earlier message_complete events
        // (prepended Message 1, or the 7f transition) have fired in
        // this stream — the client resets its text buffer on each
        // message_complete, so fullText is empty by the time this
        // final event arrives. Always sending cleanContent keeps the
        // client correct regardless of whether earlier events fired.
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "message_complete",
              messageId,
              conversationId: convId,
              checkpoint,
              processingText,
              cleanContent: conversationalText,
              nextPrompt: previousExtraction?.next_prompt || "",
              emergingPatternSnippet:
                previousExtraction?.emerging_pattern_snippet ?? null,
              hasLayerEmergingOrBeyond,
              concreteExamples:
                previousExtraction?.checkpoint_gate.concrete_examples ?? 0,
              ...(promptAuth ? { promptAuth: true } : {}),
            })}\n\n`
          )
        );

        controller.close();
      } catch (err) {
        const isTimeout =
          err instanceof Error && err.name === "AbortError";
        const msg = isTimeout
          ? `${PERSONA_NAME} took too long to respond. Try again.`
          : `${PERSONA_NAME} lost the thread. Try sending that again.`;
        console.error("[callPersona] Error:", err);
        emitError(controller, msg);
      }
    },
  });
}
