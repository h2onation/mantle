// ---------------------------------------------------------------------------
// Linq message router — routes inbound text messages
// Handles keywords, user lookup, rate limiting, and dispatches to Sage bridge
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, sendTypingIndicator, markAsRead } from "./sender";
import { processTextMessage } from "./persona-bridge";
import { confirmCheckpoint } from "@/lib/persona/confirm-checkpoint";
import { insertCheckpointActionMessage } from "@/lib/persona/persona-pipeline";
import { normalizePhone } from "@/lib/utils/normalize-phone";
import { PERSONA_NAME_FORMAL } from "@/lib/persona/config";

const FALLBACK_MSG =
  "Something went wrong on my end. Try again in a minute, or open the app at mywalnut.app";

const UNKNOWN_NUMBER_MSG =
  `This is ${PERSONA_NAME_FORMAL} by mywalnut. I don't have this number connected to an account. ` +
  "If you have a mywalnut account, connect your number in Settings. " +
  "If you're new, start at mywalnut.app";

const MEDIA_ONLY_MSG =
  "I can only read text messages right now. If you want to talk something through, " +
  "try typing it out or use the dictation button on your keyboard (the microphone icon).";

const RATE_LIMIT_MSG =
  "I'm still here, just need a moment to keep up. Give me a minute.";

const KEYWORD_RESPONSES: Record<string, string> = {
  STOP: `You've been disconnected from ${PERSONA_NAME_FORMAL}. You can reconnect anytime in the mywalnut app.`,
  START:
    `To reconnect with ${PERSONA_NAME_FORMAL}, open the mywalnut app and link your phone number in Settings.`,
  HELP: `This is ${PERSONA_NAME_FORMAL} by mywalnut. Text me anytime. Reply STOP to disconnect. For the full experience, open mywalnut at mywalnut.app`,
};

// Rate limit: one unknown-number response per phone per 24 hours.
// In-memory — same limitations as webhook dedup (serverless warm instance only).
const unknownNumberCooldown = new Map<string, number>();
const UNKNOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit: max 20 messages per user per 5 minutes.
//
// In-memory rate limiter for the SMS/Linq inbound path. This runs
// independently of the Upstash HTTP rate limiter on /api/chat because
// Linq webhook messages bypass the chat API route entirely. This is
// the SMS path's own defense-in-depth.
const userMessageCounts = new Map<string, { count: number; windowStart: number }>();
const USER_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const USER_RATE_MAX = 20;

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = userMessageCounts.get(userId);

  if (!entry || now - entry.windowStart > USER_RATE_WINDOW_MS) {
    userMessageCounts.set(userId, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > USER_RATE_MAX;
}

interface InboundMessageData {
  chatId: string;
  senderPhone: string;
  parts: Array<{ type: string; value: string }>;
}

/**
 * Main entry point — called from the webhook handler on "message.received".
 */
export async function routeInboundMessage(
  data: InboundMessageData
): Promise<void> {
  const { chatId, senderPhone: rawSenderPhone, parts } = data;
  const senderPhone = normalizePhone(rawSenderPhone);
  const startTime = Date.now();

  console.log(
    "[linq-router] START chat_id=%s parts=%d",
    chatId,
    parts.length
  );

  // Extract text content
  const textParts = parts.filter((p) => p.type === "text");
  const textContent = textParts.map((p) => p.value).join("\n").trim();
  const hasMedia = parts.some((p) =>
    ["image", "audio", "video", "attachment"].includes(p.type)
  );

  console.log(
    "[linq-router] parsed has_text=%s has_media=%s",
    !!textContent,
    hasMedia
  );

  // 1. Check for STOP/START/HELP keywords FIRST
  const keyword = textContent.toUpperCase().trim();
  if (keyword in KEYWORD_RESPONSES) {
    if (keyword === "STOP") {
      await unlinkPhone(senderPhone);
    }
    await sendMessage(chatId, KEYWORD_RESPONSES[keyword]);
    console.log("[linq-router] keyword=%s", keyword);
    return;
  }

  // 2. Look up user by phone number
  const admin = createAdminClient();
  const { data: phoneRow } = await admin
    .from("phone_numbers")
    .select("user_id, verified, linq_chat_id, phone")
    .eq("phone", senderPhone)
    .eq("verified", true)
    .maybeSingle();

  console.log(
    "[linq-router] phone_lookup found=%s user_id=%s",
    !!phoneRow,
    phoneRow?.user_id ?? "none"
  );

  if (!phoneRow) {
    console.log("[linq-router] UNKNOWN_NUMBER — sending unknown number response");
    await handleUnknownNumber(chatId, senderPhone);
    return;
  }

  const userId = phoneRow.user_id;

  // 2b. Store the Linq chat_id if we don't have it yet
  if (!phoneRow.linq_chat_id) {
    admin
      .from("phone_numbers")
      .update({ linq_chat_id: chatId })
      .eq("phone", senderPhone)
      .eq("verified", true)
      .then(({ error }) => {
        if (error)
          console.error("[linq-router] Failed to store chat_id:", error);
      });
  }

  // 3. Media-only message (no text)
  if (!textContent && hasMedia) {
    await sendMessage(chatId, MEDIA_ONLY_MSG);
    console.log("[linq-router] media_only user=%s", userId);
    return;
  }

  // 4. Empty message
  if (!textContent) {
    console.log("[linq-router] empty_message user=%s", userId);
    return;
  }

  // 5. Rate limiting — 20 messages per 5 minutes per user
  if (isUserRateLimited(userId)) {
    await sendMessage(chatId, RATE_LIMIT_MSG);
    console.warn("[linq-router] rate_limited user=%s", userId);
    return;
  }

  console.log(
    "[linq-router] inbound user=%s channel=text len=%d ts=%s",
    userId,
    textContent.length,
    new Date().toISOString()
  );

  // 5b. Check for pending checkpoint response (YES/NO/NOT QUITE)
  const checkpointResponse = await handleCheckpointResponse(
    admin,
    userId,
    textContent,
    chatId
  );
  if (checkpointResponse) {
    console.log(
      "[linq-router] checkpoint_response user=%s action=%s",
      userId,
      checkpointResponse
    );
    return;
  }

  // 6. Route to Sage
  try {
    // Typing indicator fires BEFORE Sage processes
    await sendTypingIndicator(chatId);

    const result = await processTextMessage(userId, textContent);
    const latencyMs = Date.now() - startTime;

    // Mark as read + send response
    await markAsRead(chatId);
    const sendResult = await sendMessage(chatId, result.responseText);

    // Send checkpoint follow-up if present
    if (result.checkpointText) {
      await sendMessage(chatId, result.checkpointText);
    }

    console.log(
      "[linq-router] sage_response user=%s conv=%s len=%d latency_ms=%d",
      userId,
      result.conversationId,
      result.responseText.length,
      latencyMs
    );

    if (sendResult.ok) {
      console.log(
        "[linq-router] message_sent user=%s chat_id=%s message_id=%s",
        userId,
        chatId,
        sendResult.messageId ?? "unknown"
      );
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(
      "[linq-router] sage_error user=%s latency_ms=%d error=%s",
      userId,
      latencyMs,
      err instanceof Error ? err.message : String(err)
    );
    await sendMessage(chatId, FALLBACK_MSG).catch((sendErr) =>
      console.error("[linq-router] fallback_send_failed:", sendErr)
    );
  }
}

/**
 * Unlinks a phone number when user texts STOP.
 */
async function unlinkPhone(phone: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("phone_numbers")
    .update({ verified: false })
    .eq("phone", phone);

  if (error) {
    console.error("[linq-router] unlink_failed error_type=%s", error.code ?? "unknown");
  } else {
    console.log("[linq-router] phone_unlinked");
  }
}

/**
 * Send the unknown-number response, rate-limited to once per 24 hours per phone.
 */
async function handleUnknownNumber(
  chatId: string,
  phone: string
): Promise<void> {
  const now = Date.now();
  const lastSent = unknownNumberCooldown.get(phone);

  if (lastSent && now - lastSent < UNKNOWN_COOLDOWN_MS) {
    console.log("[linq-router] unknown_cooldown");
    return;
  }

  unknownNumberCooldown.set(phone, now);
  const sendResult = await sendMessage(chatId, UNKNOWN_NUMBER_MSG);
  console.log(
    "[linq-router] unknown_number send_ok=%s trace_id=%s",
    sendResult.ok,
    sendResult.traceId ?? "unknown"
  );
}

/**
 * Check if the user's message is a response to a pending checkpoint.
 * Returns the action taken, or null if this isn't a checkpoint response.
 */
async function handleCheckpointResponse(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  text: string,
  chatId: string
): Promise<string | null> {
  const normalized = text.trim().toUpperCase();

  // Only intercept clear checkpoint responses
  const isYes = normalized === "YES" || normalized === "Y" || normalized === "CONFIRM";
  const isNo = normalized === "NO" || normalized === "N" || normalized === "DISCARD";
  const isNotQuite =
    normalized === "NOT QUITE" ||
    normalized === "NOTQUITE" ||
    normalized === "REFINE";

  if (!isYes && !isNo && !isNotQuite) {
    return null;
  }

  // Find the user's most recent pending checkpoint
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv) return null;

  const { data: pendingMsg } = await admin
    .from("messages")
    .select("id, checkpoint_meta")
    .eq("conversation_id", conv.id)
    .eq("is_checkpoint", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingMsg?.checkpoint_meta) return null;

  const meta = pendingMsg.checkpoint_meta as Record<string, unknown>;
  if (meta.status !== "pending") return null;

  if (isYes) {
    // Confirm — write to manual (same logic as web)
    const result = await confirmCheckpoint({
      messageId: pendingMsg.id,
      conversationId: conv.id,
      userId,
    });

    if (result.success) {
      // Call Sage to generate post-checkpoint tee-up (same as web path).
      // Sage sees "[User confirmed the checkpoint]" in history and responds
      // with acknowledgment + "Two directions" fork.
      await sendTypingIndicator(chatId);
      try {
        const { responseText: followUp } = await processTextMessage(userId, null, conv.id);
        await sendMessage(chatId, followUp);
      } catch (err) {
        console.error("[linq-router] post_checkpoint_sage_failed:", err);
        await sendMessage(chatId, "Written to manual.");
      }
    } else {
      console.error("[linq-router] checkpoint_confirm_failed:", result.error);
      await sendMessage(chatId, "Something went wrong saving that. Try again in the app.");
    }
    return "confirmed";
  }

  if (isNotQuite) {
    // Refined — Sage will revisit
    await admin
      .from("messages")
      .update({ checkpoint_meta: { ...meta, status: "refined" } })
      .eq("id", pendingMsg.id);

    await insertCheckpointActionMessage(admin, conv.id, "refined");

    // Call Sage so it responds to the refinement request naturally
    await sendTypingIndicator(chatId);
    try {
      const { responseText: followUp } = await processTextMessage(userId, null, conv.id);
      await sendMessage(chatId, followUp);
    } catch (err) {
      console.error("[linq-router] post_refine_sage_failed:", err);
      await sendMessage(chatId, `Got it — ${PERSONA_NAME_FORMAL} will revisit this.`);
    }
    return "refined";
  }

  if (isNo) {
    // Rejected — discard
    await admin
      .from("messages")
      .update({ checkpoint_meta: { ...meta, status: "rejected" } })
      .eq("id", pendingMsg.id);

    await insertCheckpointActionMessage(admin, conv.id, "rejected");

    // Call Sage so it acknowledges and moves on naturally
    await sendTypingIndicator(chatId);
    try {
      const { responseText: followUp } = await processTextMessage(userId, null, conv.id);
      await sendMessage(chatId, followUp);
    } catch (err) {
      console.error("[linq-router] post_reject_sage_failed:", err);
      await sendMessage(chatId, "Discarded.");
    }
    return "rejected";
  }

  return null;
}
