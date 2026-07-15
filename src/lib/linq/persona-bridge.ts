// ---------------------------------------------------------------------------
// Jove bridge — connects inbound text messages to the existing Jove engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { detectTranscript } from "@/lib/utils/transcript-detection";
import { markLatency, type LatencyCollector } from "@/lib/messaging/latency";
import {
  PERSONA_MODEL,
  PERSONA_MAX_TOKENS,
  loadConversationContext,
  buildPromptOptionsFromContext,
  fireBackgroundExtraction,
  handleCrisisDetection,
  validateResponseStructure,
} from "@/lib/persona/persona-pipeline";

interface PersonaBridgeResult {
  responseText: string;
  conversationId: string;
  messageId: string | null;
}

/**
 * Processes a text-channel Jove interaction. Handles two cases:
 *
 * 1. User message (messageText provided): Save message, load context,
 *    call Jove, handle extraction + crisis, save the response.
 *
 * 2. Post-checkpoint follow-up (messageText is null): Load context
 *    (which includes the system message from confirmCheckpoint), call
 *    Jove so it generates the tee-up response. Same as web's
 *    callPersona({ message: null }).
 *
 * Capture is a pure PULL model on web (the reflection meter → compose route);
 * the text/SMS channel has no meter and no capture path until a future text
 * rebuild. Jove never proposes an entry here — the Jove-pushed checkpoint path
 * was removed 2026-07-03 (Wave 3 ship 2).
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

  // 3. Load shared conversation context (same DB reads + rules as web).
  //    surface="text": the reflection meter is web-only, so the SMS channel
  //    has no capture path until a future text rebuild.
  const ctx = await loadConversationContext(
    admin,
    conversationId,
    userId,
    "text"
  );
  markLatency(timings, "context_loaded");

  // 4. Fire extraction in background (only for real user messages). Skipped
  //    when the extraction_brief gate is OFF (ctx.extractionEnabled=false) so
  //    the SMS path honors voice-only mode like the web path.
  if (messageText !== null && ctx.extractionEnabled) {
    fireBackgroundExtraction(ctx, admin);
  }

  // 5. Build system prompt. Mirror the web path's transcript handling so a
  //    pasted thread over text gets the same TRANSCRIPT DETECTED guardrails
  //    (analytical stance + do-not-profile-others) the in-app prompt carries —
  //    otherwise a pasted conversation is treated as an ordinary message over
  //    SMS. See ADR-042 and docs/audits/prompt-injector-2026-06-01.md.
  const transcriptContext =
    messageText !== null ? detectTranscript(messageText) : null;
  const systemPrompt = buildSystemPrompt({
    ...buildPromptOptionsFromContext(ctx),
    transcriptContext,
  });

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

  // Capture is pull-only on web; the text channel has no meter and no capture
  // path until a future text rebuild. Jove never proposes an entry here.
  return { responseText, conversationId, messageId };
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
    // mode lost its DEFAULT in the modules cutover (ADR-053). Text has no
    // module picker; carry the frozen legacy slug until the text-capture
    // rebuild decides how text names a module.
    .insert({ user_id: userId, status: "active", mode: "situation" })
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
