// ---------------------------------------------------------------------------
// Jove bridge — connects inbound text messages to the existing Jove engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { detectCheckpointInResponse } from "@/lib/persona/detect-checkpoint";
import { composeManualEntry } from "@/lib/persona/confirm-checkpoint";
import { markLatency, type LatencyCollector } from "@/lib/messaging/latency";
import {
  PERSONA_MODEL,
  PERSONA_MAX_TOKENS,
  loadConversationContext,
  buildPromptOptionsFromContext,
  fireBackgroundExtraction,
  handleCrisisDetection,
  applyCheckpointGates,
  buildCheckpointMeta,
  validateComposedEntry,
  validateResponseStructure,
} from "@/lib/persona/persona-pipeline";

interface PersonaBridgeResult {
  responseText: string;
  conversationId: string;
  messageId: string | null;
  checkpointText: string | null;
}

/**
 * Processes a text-channel Jove interaction. Handles two cases:
 *
 * 1. User message (messageText provided): Save message, load context,
 *    call Jove, handle extraction/crisis/checkpoints. Full pipeline.
 *
 * 2. Post-checkpoint follow-up (messageText is null): Load context
 *    (which includes the system message from confirmCheckpoint), call
 *    Jove so it generates the tee-up response. Same as web's
 *    callPersona({ message: null }).
 */
export async function processTextMessage(
  userId: string,
  messageText: string | null,
  existingConversationId?: string,
  timings?: LatencyCollector
): Promise<PersonaBridgeResult> {
  const admin = createAdminClient();

  // 1. Find or create the user's active conversation
  const conversationId =
    existingConversationId ?? (await getOrCreateConversation(admin, userId));

  // 2. Save the inbound message (skip when message is null — post-checkpoint)
  if (messageText !== null) {
    const { error: insertError } = await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: messageText,
      channel: "text",
    });

    if (insertError) {
      console.error("[persona-bridge] Failed to save user message:", insertError);
      throw new Error("Failed to save message");
    }
  }

  // 3. Load shared conversation context (same DB reads + rules as web)
  const ctx = await loadConversationContext(admin, conversationId, userId);
  markLatency(timings, "context_loaded");

  // 4. Fire extraction in background (only for real user messages)
  if (messageText !== null) {
    fireBackgroundExtraction(ctx, admin);
  }

  // 5. Build system prompt (shared options from context, no channel-specific fields)
  const systemPrompt = buildSystemPrompt(buildPromptOptionsFromContext(ctx));

  // 6. Call Jove non-streaming (text doesn't need SSE)
  markLatency(timings, "anthropic_start");
  const response = await anthropicFetch({
    model: PERSONA_MODEL,
    max_tokens: PERSONA_MAX_TOKENS,
    system: systemPrompt,
    messages: ctx.messages,
  });
  markLatency(timings, "anthropic_returned");

  const fullText =
    response.content?.[0]?.text || "Something went wrong on my end.";

  // 7. For post-checkpoint calls, just save and return — no checkpoint/crisis handling
  if (messageText === null) {
    await admin.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: fullText,
      channel: "text",
    });

    return {
      responseText: fullText,
      conversationId,
      messageId: null,
      checkpointText: null,
    };
  }

  // 8. Conversational text is the full response.
  let responseText = fullText;

  // 9. Crisis detection (shared with web)
  const crisis = handleCrisisDetection(
    messageText,
    responseText,
    conversationId,
    userId,
    admin
  );
  responseText = crisis.responseText;

  // 10. Save Jove's response with channel: "text"
  const { data: savedResponse } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: responseText,
      channel: "text",
    })
    .select("id")
    .single();
  markLatency(timings, "reply_persisted");

  const messageId = savedResponse?.id || null;

  // Response structure validation (logs violations, does not block).
  // Runs on fullText — the raw model output — not responseText, which may
  // have had crisis 988 resources appended (CRISIS_RESOURCES contains an
  // em dash that would trip the dash_usage check).
  validateResponseStructure(fullText, messageId);

  // Save extraction snapshot
  if (messageId && ctx.previousExtraction) {
    admin
      .from("messages")
      .update({ extraction_snapshot: ctx.previousExtraction })
      .eq("id", messageId)
      .then(({ error }) => {
        if (error && !error.message.includes("extraction_snapshot")) {
          console.error(
            "[persona-bridge] Failed to save extraction snapshot:",
            error
          );
        }
      });
  }

  // 11. Checkpoint detection (deterministic). Same contract as the web
  //     channel: if Jove wrote the transition line, this turn is a
  //     checkpoint. Composition picks layer + name + summary.
  let checkpointText: string | null = null;
  let isCheckpoint = messageId
    ? detectCheckpointInResponse(responseText).isCheckpoint
    : false;

  // 11b. Shared checkpoint gates (material quality + turn-count)
  if (isCheckpoint) {
    const gateResult = applyCheckpointGates(
      ctx.turnsSinceCheckpoint,
      ctx.previousExtraction,
      ctx.isFirstCheckpoint,
      ctx.turnCount
    );
    if (!gateResult.passed) {
      isCheckpoint = false;
    }
  }

  // 11c. Composition — Opus polishes the entry, picks the layer, picks
  //      the headline. If composition fails or returns an invalid layer,
  //      suppress the checkpoint rather than file an entry under no
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
    try {
      composedEntry = await composeManualEntry({
        checkpointText: responseText,
        conversationHistory: ctx.messages,
        languageBank: ctx.previousExtraction?.language_bank || [],
        manualComponents: ctx.manualComponents || [],
      });

      if (composedEntry?.content) {
        const validation = validateComposedEntry(composedEntry.content);
        if (!validation.ok) {
          console.warn(
            "[persona-bridge] Composed entry structural drift: %s",
            validation.warnings.join("; ")
          );
        }
      }
    } catch (err) {
      console.error("[persona-bridge] Composition failed:", err);
      composedEntry = null;
    }

    if (!composedEntry) {
      isCheckpoint = false;
    }
  }

  // 11d. Save checkpoint metadata and build confirmation text
  if (isCheckpoint && composedEntry && messageId) {
    const meta = buildCheckpointMeta(composedEntry);

    await admin
      .from("messages")
      .update({
        is_checkpoint: true,
        checkpoint_meta: meta,
      })
      .eq("id", messageId);

    // Build the text checkpoint message — only show name + question
    // (the user already read the insight in Jove's conversational response)
    const name = composedEntry.name || "Untitled";
    checkpointText =
      `Does this feel right?\n\n` +
      `"${name}"\n\n` +
      `Reply YES to write to manual, NOT QUITE to refine, or NO to discard.`;

    console.log(
      "[persona-bridge] checkpoint_detected layer=%d name=%s message_id=%s",
      composedEntry.layer,
      name,
      messageId
    );
  }

  return { responseText, conversationId, messageId, checkpointText };
}

/**
 * Find the user's most recent active conversation, or create one.
 * Text messages join the existing conversation — no separate sessions.
 * Handles race condition: if two texts arrive simultaneously and both
 * try to create, the loser re-queries to find the winner's conversation.
 */
async function getOrCreateConversation(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string> {
  // Exclude group conversations — they have linq_group_chat_id set
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("linq_group_chat_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ user_id: userId, status: "active" })
    .select("id")
    .single();

  if (created) return created.id;

  // Race condition: another request created a conversation between our
  // read and write. Re-query to find it.
  if (error) {
    console.warn("[persona-bridge] Insert race, re-querying:", error.message);
    const { data: retry } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .is("linq_group_chat_id", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (retry) return retry.id;
  }

  console.error("[persona-bridge] Failed to create conversation:", error);
  throw new Error("Failed to create conversation");
}
