// ---------------------------------------------------------------------------
// Sage bridge — connects inbound text messages to the existing Sage engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { classifyResponse } from "@/lib/sage/classifier";
import { composeManualEntry } from "@/lib/sage/confirm-checkpoint";
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

interface SageBridgeResult {
  responseText: string;
  conversationId: string;
  messageId: string | null;
  checkpointText: string | null;
}

/**
 * Processes a text-channel Sage interaction. Handles two cases:
 *
 * 1. User message (messageText provided): Save message, load context,
 *    call Sage, handle extraction/crisis/checkpoints. Full pipeline.
 *
 * 2. Post-checkpoint follow-up (messageText is null): Load context
 *    (which includes the system message from confirmCheckpoint), call
 *    Sage so it generates the tee-up response. Same as web's
 *    callSage({ message: null }).
 */
export async function processTextMessage(
  userId: string,
  messageText: string | null,
  existingConversationId?: string
): Promise<SageBridgeResult> {
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
      console.error("[sage-bridge] Failed to save user message:", insertError);
      throw new Error("Failed to save message");
    }
  }

  // 3. Load shared conversation context (same DB reads + rules as web)
  const ctx = await loadConversationContext(admin, conversationId, userId);

  // 4. Fire extraction in background (only for real user messages)
  if (messageText !== null) {
    fireBackgroundExtraction(ctx, admin);
  }

  // 5. Build system prompt (shared options from context, no channel-specific fields)
  const systemPrompt = buildSystemPrompt(buildPromptOptionsFromContext(ctx));

  // 6. Call Sage non-streaming (text doesn't need SSE)
  const response = await anthropicFetch({
    model: SAGE_MODEL,
    max_tokens: SAGE_MAX_TOKENS,
    system: systemPrompt,
    messages: ctx.messages,
  });

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

  // 10. Save Sage's response with channel: "text"
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

  const messageId = savedResponse?.id || null;

  // Save extraction snapshot
  if (messageId && ctx.previousExtraction) {
    admin
      .from("messages")
      .update({ extraction_snapshot: ctx.previousExtraction })
      .eq("id", messageId)
      .then(({ error }) => {
        if (error && !error.message.includes("extraction_snapshot")) {
          console.error(
            "[sage-bridge] Failed to save extraction snapshot:",
            error
          );
        }
      });
  }

  // 11. Checkpoint detection — always run the classifier on the conversational
  //     text. Composition is handled server-side by composeManualEntry below.
  let checkpointText: string | null = null;
  let isCheckpoint = false;
  let checkpointLayer: number | null = null;
  let checkpointName: string | null = null;

  if (messageId) {
    const last4 = ctx.messages.slice(-4);
    const recentText = last4.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const isFirstSession = !ctx.manualComponents || ctx.manualComponents.length === 0;

    const classification = await classifyResponse(
      responseText,
      recentText,
      isFirstSession
    );

    isCheckpoint = classification.isCheckpoint;
    checkpointLayer = classification.layer;
    checkpointName = classification.name;
  }

  // 11b. Shared checkpoint gates (material quality + turn-count)
  if (isCheckpoint && checkpointLayer) {
    const gateResult = applyCheckpointGates(
      { layer: checkpointLayer, name: checkpointName || "" },
      ctx.manualComponents,
      ctx.turnsSinceCheckpoint,
      ctx.previousExtraction,
      ctx.isFirstCheckpoint
    );
    isCheckpoint = gateResult.isCheckpoint;
    checkpointLayer = gateResult.layer;
    checkpointName = gateResult.name;
  }

  // 11c. Composition — always compose the manual entry server-side when a
  //      checkpoint is detected so composed_content is ready at confirmation.
  let composedEntry: { content: string; name: string; changelog: string } | null = null;

  if (isCheckpoint && checkpointLayer) {
    try {
      const existingLayerContent = (ctx.manualComponents || []).filter(
        (c) => c.layer === checkpointLayer
      );

      composedEntry = await composeManualEntry({
        checkpointText: responseText,
        conversationHistory: ctx.messages,
        languageBank: ctx.previousExtraction?.language_bank || [],
        layer: checkpointLayer,
        name: checkpointName,
        existingLayerContent: existingLayerContent.length > 0 ? existingLayerContent : undefined,
      });

      if (composedEntry?.content) {
        const validation = validateComposedEntry(composedEntry.content);
        if (!validation.ok) {
          console.warn(
            "[sage-bridge] Composed entry structural drift: %s",
            validation.warnings.join("; ")
          );
        }
      }
    } catch (err) {
      console.error("[sage-bridge] Composition failed:", err);
    }
  }

  // 11d. Save checkpoint metadata and build confirmation text
  if (isCheckpoint && checkpointLayer && messageId) {
    const meta = buildCheckpointMeta(
      { isCheckpoint, layer: checkpointLayer, name: checkpointName },
      composedEntry
    );

    await admin
      .from("messages")
      .update({
        is_checkpoint: true,
        checkpoint_meta: meta,
      })
      .eq("id", messageId);

    // Build the text checkpoint message — only show name + question
    // (the user already read the insight in Sage's conversational response)
    const name = meta.name || checkpointName || "Untitled";
    checkpointText =
      `Does this feel right?\n\n` +
      `"${name}"\n\n` +
      `Reply YES to write to manual, NOT QUITE to refine, or NO to discard.`;

    console.log(
      "[sage-bridge] checkpoint_detected layer=%d name=%s message_id=%s",
      checkpointLayer,
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
    console.warn("[sage-bridge] Insert race, re-querying:", error.message);
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

  console.error("[sage-bridge] Failed to create conversation:", error);
  throw new Error("Failed to create conversation");
}
