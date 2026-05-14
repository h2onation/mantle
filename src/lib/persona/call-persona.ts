import { anthropicStream } from "@/lib/anthropic";
import { parseAnthropicStream } from "@/lib/anthropic-sse";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONA_NAME } from "@/lib/persona/config";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { detectCheckpointInResponse } from "@/lib/persona/detect-checkpoint";
import { composeManualEntry } from "@/lib/persona/confirm-checkpoint";
import type { ExplorationContext } from "@/lib/types";
import { detectTranscript } from "@/lib/utils/transcript-detection";
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
  dbMessages: { role: string; content: string; metadata?: Record<string, unknown> | null }[]
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
      const isChipTap =
        msg.role === "user" &&
        msg.metadata &&
        (msg.metadata as Record<string, unknown>).chip_response === true;
      history.push({
        role: msg.role as "user" | "assistant",
        content: isChipTap
          ? `[selected from options] ${msg.content}`
          : msg.content,
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
  isChipResponse?: boolean;
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

type PostConfirmCtx = NonNullable<CallPersonaOptions["postConfirmContext"]>;

/** Deterministic fallback for the post-confirm follow-up message when the
 *  LLM call fails. The forward question is the load-bearing piece — every
 *  confirm should propel the conversation, not dead-end on a stamp line.
 *  Mirrors the structure of the prompt-driven version (pinned copy + a
 *  forward question) but uses generic question text so the template is
 *  context-agnostic. */
function buildPostConfirmFallback(
  mode: "first-message-2" | "subsequent-single",
  ctx: PostConfirmCtx | null | undefined
): string | null {
  if (!ctx) return null;

  if (mode === "first-message-2") {
    return [
      `That went into ${ctx.layerName}. Four other places still empty — they fill as more shows up.`,
      "A real Manual takes time. It is not a quiz. You will carry it, return to it, sharpen it. No rush. Just show up. Come back daily for the first two weeks — that is the window where it starts to hold together.",
      "What's still open in this for you?",
    ].join("\n\n");
  }

  if (mode === "subsequent-single") {
    return [
      `In. A working name: "${ctx.proposedHeadline}." Yours to change.`,
      ctx.entriesSummary,
      "What's still open in this for you?",
    ].join("\n\n");
  }

  return null;
}

export function callPersona({
  conversationId,
  userId,
  message,
  explorationContext,
  promptAuth,
  isChipResponse,
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
              metadata: isChipResponse ? { chip_response: true } : {},
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
          mode: conversationMode,
        } = ctx;

        // 3. Fire extraction in background
        const hasUserContent =
          message !== null && message !== "[Session started]";
        if (hasUserContent) {
          fireBackgroundExtraction(ctx, admin);
        }

        // 7b. Transcript detection — passive fallback for pasted content
        // in non-upload conversations. Upload mode gets its own Tier 3
        // block and doesn't need regex detection.
        const transcriptDetection =
          message && ctx.mode !== "upload" ? detectTranscript(message) : null;

        // 8. Build system prompt (shared base + web-specific fields +
        //    Phase 7-High post-confirm mode when invoked from the
        //    confirm route for a post-confirm follow-up turn).
        const systemPrompt = buildSystemPrompt({
          ...buildPromptOptionsFromContext(ctx),
          explorationContext,
          transcriptContext: transcriptDetection,
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

        await parseAnthropicStream(rawStream, {
          onTextDelta: (text) => {
            fullText += text;
            flushSafe(text);
          },
        });

        if (!fullText) {
          emitError(
            controller,
            `${PERSONA_NAME} lost the thread. Try sending that again.`
          );
          return;
        }

        // 10. Conversational text is the full Sage response.
        let conversationalText = fullText;

        // 10a. Chip extraction — strip quick-reply chips before crisis check.
        // Jove may append a ---chips--- block with tappable options in
        // guided-intake mode. Parse them out so cleanContent and DB
        // storage get text-only, and the chip array rides the SSE event.
        const chipDelimiter = "\n---chips---\n";
        let parsedChips: string[] = [];
        const chipIdx = conversationalText.indexOf(chipDelimiter);
        if (chipIdx !== -1) {
          const chipBlock = conversationalText.slice(chipIdx + chipDelimiter.length);
          parsedChips = chipBlock
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .slice(0, 6);
          conversationalText = conversationalText.slice(0, chipIdx);
        }

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
          .select("id")
          .single();

        const messageId = savedResponse?.id || null;

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

        // 12. Checkpoint detection (deterministic). The transition line
        //     "I want to put something in your Manual" is the contract
        //     with the user — if Jove wrote it, this turn is a checkpoint.
        //     No probabilistic classifier sits between Jove's words and
        //     the card. Layer + name + summary all come from the
        //     composition Opus call below.
        //
        //     Skipped for post-confirm follow-up calls — Jove is producing
        //     scaffolding for a JUST-confirmed entry, not proposing a new
        //     one, and would risk double-checkpointing if the post-confirm
        //     language happened to contain the transition phrase.
        let isCheckpoint = false;
        const processingText = "listening...";

        if (postConfirmMode === null) {
          isCheckpoint = detectCheckpointInResponse(conversationalText).isCheckpoint;
        }

        // 12b. Shared checkpoint gates (material quality + turn-count).
        //      Cheap to gate here before paying for the composition call.
        if (isCheckpoint) {
          const gateResult = applyCheckpointGates(
            turnsSinceCheckpoint,
            previousExtraction,
            isFirstCheckpoint,
            turnCount
          );
          if (!gateResult.passed) {
            isCheckpoint = false;
          }
        }

        // 12b-log. Checkpoint detection debug log (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[persona-debug] %s",
            isCheckpoint ? "CHECKPOINT detected" : "No checkpoint this turn"
          );
        }

        // 12c. Composition: when the detector says yes (and gates pass),
        //      call Opus to compose the polished entry. Opus picks the
        //      layer based on the entry content + the existing Manual,
        //      picks the headline, polishes the prose, and emits the
        //      compressed summary + key_words. If composition fails OR
        //      Opus picks an invalid layer, suppress the checkpoint —
        //      better to silently skip than to file an entry under no
        //      layer.
        let composedEntry: {
          content: string;
          name: string;
          layer: number;
          changelog: string;
          summary: string;
          key_words: string[];
        } | null = null;

        if (isCheckpoint) {
          // Emit a transient `composing` event so the client can show a
          // "Something is forming…" label inside the typing indicator
          // during the ~10-15s Opus composition wait. This replaces the
          // previously-persisted "lead-in" assistant message — the
          // forming label is not a chat bubble, has no DB row, and is
          // cleared automatically when the trigger card's
          // message_complete event arrives next.
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "composing",
                text: "Something is forming…",
              })}\n\n`
            )
          );

          try {
            composedEntry = await composeManualEntry({
              checkpointText: conversationalText,
              conversationHistory: messages,
              languageBank: previousExtraction?.language_bank || [],
              manualComponents: manualComponents || [],
            });

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
              "[callPersona] Composition failed, suppressing checkpoint:",
              err
            );
            composedEntry = null;
          }

          if (!composedEntry) {
            isCheckpoint = false;
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
              composedEntry,
              checkpointRefinementCount
            );
          }

          await admin
            .from("messages")
            .update(updateData)
            .eq("id", messageId);
        }

        // 13b. (Removed) Previously a persisted "A pattern came through
        //      in what you said." lead-in assistant message was inserted
        //      here so the trigger card didn't appear cold. That bubble
        //      read as a dead chat message in the transcript and was
        //      serialized alongside the card rather than replaced by it.
        //      Replaced upstream (see step 12c) with a transient
        //      `composing` SSE event that drives a "Something is forming…"
        //      label inside the typing indicator during the composition
        //      wait. The label clears automatically when the trigger
        //      card's message_complete event lands.

        // 14. Emit final event
        const checkpoint = isCheckpoint && composedEntry
          ? {
              isCheckpoint: true,
              layer: composedEntry.layer,
              name: composedEntry.name,
              // Surface the refinement_count to the client so the
              // ceiling card UI fires on the third+ attempt without
              // requiring a separate fetch. Track A Phase 7-Mid.
              refinement_count: checkpointRefinementCount,
              // Polished entry text shown in the review overlay so the
              // user sees the exact prose that will land in their Manual.
              composed_content: composedEntry.content,
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
              mode: conversationMode,
              ...(parsedChips.length > 0 ? { chips: parsedChips } : {}),
              ...(promptAuth ? { promptAuth: true } : {}),
            })}\n\n`
          )
        );

        controller.close();
      } catch (err) {
        console.error("[callPersona] Error:", err);

        // Post-confirm streams are scaffolding on top of an already-completed
        // save. By the time we reach this catch, the manual_entries row has
        // been written and (for first-lifetime confirmations) the templated
        // Message 1 stamp has already been emitted via prependedMessages.
        // Surfacing "Jove lost the thread" here would tell the user their
        // entry failed when it didn't, and the chat-level retry button
        // would re-send a stale user message into a successful-confirm
        // context.
        //
        // Instead of closing silently (which leaves the user staring at
        // Message 1 with no forward question), emit a deterministic
        // fallback Message 2 so the conversation always tees up next
        // movement. Sonnet wins when it works; the template wins when
        // Sonnet doesn't.
        if (postConfirmMode !== null) {
          const fallbackText = buildPostConfirmFallback(
            postConfirmMode,
            postConfirmContext
          );
          if (fallbackText) {
            try {
              const { data: fallbackRow } = await admin
                .from("messages")
                .insert({
                  conversation_id: convId,
                  role: "assistant",
                  content: fallbackText,
                })
                .select("id")
                .single();
              if (fallbackRow?.id) {
                emitInlineMessage(controller, fallbackRow.id, fallbackText);
              }
            } catch (fallbackErr) {
              console.error(
                "[callPersona] Post-confirm fallback emission failed:",
                fallbackErr
              );
            }
          }
          try {
            controller.close();
          } catch {
            // controller may already be closed if the error fired after
            // a partial enqueue; ignore.
          }
          return;
        }

        const isTimeout =
          err instanceof Error && err.name === "AbortError";
        const msg = isTimeout
          ? `${PERSONA_NAME} took too long to respond. Try again.`
          : `${PERSONA_NAME} lost the thread. Try sending that again.`;
        emitError(controller, msg);
      }
    },
  });
}
