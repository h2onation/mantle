// ---------------------------------------------------------------------------
// Sage bridge — connects inbound text messages to the existing Sage engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { parseManualEntryBlock } from "@/lib/sage/call-sage";
import {
  SAGE_MODEL,
  SAGE_MAX_TOKENS,
  loadConversationContext,
  fireBackgroundExtraction,
  handleCrisisDetection,
  applyCheckpointGates,
  buildCheckpointMeta,
} from "@/lib/sage/sage-pipeline";

interface SageBridgeResult {
  responseText: string;
  conversationId: string;
  messageId: string | null;
  checkpointText: string | null;
}

/**
 * Processes an inbound text message through the Sage pipeline.
 * Reuses the same extraction, prompt building, and conversation logic
 * as the web app, but collects the response non-streaming and skips
 * checkpoint classification (Path A only — no Haiku classifier fallback).
 */
export async function processTextMessage(
  userId: string,
  messageText: string
): Promise<SageBridgeResult> {
  const admin = createAdminClient();

  // 1. Find or create the user's active conversation
  const conversationId = await getOrCreateConversation(admin, userId);

  // 2. Save the inbound message with channel: "text"
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

  // 3. Load shared conversation context (same DB reads + rules as web)
  const ctx = await loadConversationContext(admin, conversationId, userId);

  // 4. Fire extraction in background (same as web — doesn't block response)
  fireBackgroundExtraction(ctx, admin);

  // 5. Build system prompt (text doesn't pass explorationContext/transcriptContext/contentContext)
  const systemPrompt = buildSystemPrompt({
    manualComponents: ctx.manualComponents,
    isReturningUser: ctx.isReturningUser,
    sessionSummary: ctx.sessionSummary,
    extractionContext: ctx.extractionForSage,
    isFirstCheckpoint: ctx.isFirstCheckpoint,
    sessionCount: ctx.sessionCount,
    turnCount: ctx.turnCount,
    hasPatternEligibleLayer: ctx.hasPatternEligibleLayer,
    checkpointApproaching: ctx.checkpointApproaching,
  });

  // 6. Call Sage non-streaming (text doesn't need SSE)
  const response = await anthropicFetch({
    model: SAGE_MODEL,
    max_tokens: SAGE_MAX_TOKENS,
    system: systemPrompt,
    messages: ctx.messages,
  });

  const fullText =
    response.content?.[0]?.text || "Something went wrong on my end.";

  // Parse manual entry block if present (same parser as web)
  const parsed = parseManualEntryBlock(fullText);
  let responseText = parsed.conversationalText;
  const manualEntry = parsed.manualEntry;

  // 7. Crisis detection (shared with web)
  const crisis = handleCrisisDetection(
    messageText,
    responseText,
    conversationId,
    userId,
    admin
  );
  responseText = crisis.responseText;

  // 8. Save Sage's response with channel: "text"
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

  // 9. Handle checkpoint — apply shared gates, save metadata, build confirmation text
  let checkpointText: string | null = null;

  if (manualEntry && messageId) {
    // Apply shared checkpoint gates (layer guards + turn-count suppression)
    const gateResult = applyCheckpointGates(
      manualEntry,
      ctx.manualComponents,
      ctx.turnsSinceCheckpoint
    );

    if (gateResult.isCheckpoint) {
      // Update manualEntry type if gates corrected it
      if (gateResult.type !== manualEntry.type) {
        manualEntry.type = gateResult.type!;
      }

      // Save checkpoint metadata (shared builder — same shape as web)
      const meta = buildCheckpointMeta(gateResult, manualEntry, null);

      await admin
        .from("messages")
        .update({
          is_checkpoint: true,
          checkpoint_meta: meta,
        })
        .eq("id", messageId);

      // Build the text checkpoint message — only show name + question
      // (the user already read the insight in Sage's conversational response)
      const isPattern = gateResult.type === "pattern";
      const question = isPattern ? "Does this resonate?" : "Does this feel right?";
      const name = meta.name || manualEntry.name;
      checkpointText =
        `${question}\n\n` +
        `"${name}"\n\n` +
        `Reply YES to write to manual, NOT QUITE to refine, or NO to discard.`;

      console.log(
        "[sage-bridge] checkpoint_detected layer=%d type=%s name=%s message_id=%s",
        gateResult.layer,
        gateResult.type,
        name,
        messageId
      );
    } else {
      console.log(
        "[sage-bridge] checkpoint_suppressed layer=%d turns_since=%d",
        manualEntry.layer,
        ctx.turnsSinceCheckpoint
      );
    }
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
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
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
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (retry) return retry.id;
  }

  console.error("[sage-bridge] Failed to create conversation:", error);
  throw new Error("Failed to create conversation");
}
