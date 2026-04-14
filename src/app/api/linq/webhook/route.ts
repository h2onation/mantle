import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeInboundMessage } from "@/lib/linq/message-router";
import { detectAndSetupGroup } from "@/lib/linq/group-detection";
import { getGroupState, updateGroupState } from "@/lib/linq/group-state";
import { processGroupMessage, saveGroupMessage, prefetchGroupContext } from "@/lib/linq/group-bridge";
import { evaluateGate, mentionsPersona } from "@/lib/linq/group-gate";
import { sendMessage, getChatInfo } from "@/lib/linq/sender";
import { normalizePhone } from "@/lib/utils/normalize-phone";

export const runtime = "nodejs";

// Sage's normalized phone — computed once at module level
function getSagePhone(): string {
  return normalizePhone(process.env.LINQ_PHONE_NUMBER || "");
}

/**
 * Check if a phone number belongs to a specific owner user.
 */
async function isOwnerUserPhone(
  phone: string,
  ownerUserId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("phone_numbers")
    .select("user_id")
    .eq("phone", phone)
    .eq("verified", true)
    .maybeSingle();
  return data?.user_id === ownerUserId;
}

// ---------------------------------------------------------------------------
// Linq webhook endpoint
// Receives inbound events from Linq (messages, delivery status, etc.)
// ---------------------------------------------------------------------------

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

// In-memory dedup cache. Survives within a warm serverless instance only.
// Sufficient for catching rapid-fire retries; upgrade to DB-backed dedup if
// Linq retry storms become an issue in production.
const seenEvents = new Map<string, number>();
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function pruneSeenEvents() {
  const now = Date.now();
  seenEvents.forEach((ts, id) => {
    if (now - ts > DEDUP_TTL_MS) seenEvents.delete(id);
  });
}

// ---------------------------------------------------------------------------
// Env var validation
// ---------------------------------------------------------------------------

function validateEnvVars(): string | null {
  const required = ["LINQ_API_TOKEN", "LINQ_PHONE_NUMBER", "LINQ_WEBHOOK_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    const msg = `Linq webhook misconfigured — missing env vars: ${missing.join(", ")}`;
    console.error("[linq] " + msg);
    return msg;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  const signingSecret = process.env.LINQ_WEBHOOK_SECRET;
  if (!signingSecret) return false;

  // Reject stale timestamps (replay protection)
  const tsSeconds = parseInt(timestamp, 10);
  if (Number.isNaN(tsSeconds)) return false;
  const age = Math.abs(Date.now() - tsSeconds * 1000);
  if (age > MAX_TIMESTAMP_AGE_MS) {
    console.warn("[linq] Webhook timestamp too old (%dms)", age);
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    // Length mismatch or invalid hex → not a valid signature
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event routing
// ---------------------------------------------------------------------------

async function handleEvent(event: LinqWebhookEvent): Promise<void> {
  switch (event.event_type) {
    case "message.received":
      await handleInboundMessage(event);
      break;

    case "message.failed": {
      const d = event.data;
      console.error(
        "[linq] delivery_failed message_id=%s chat_id=%s error_code=%s error_reason=%s trace_id=%s",
        (d?.id as string) ?? "unknown",
        (d?.chat_id as string) ?? "unknown",
        (d?.error_code as string) ?? "unknown",
        (d?.error_reason as string) ?? "unknown",
        event.trace_id
      );
      break;
    }

    case "message.delivered":
    case "message.read":
      console.log(
        "[linq] %s trace_id=%s chat_id=%s",
        event.event_type,
        event.trace_id,
        (event.data?.chat_id as string) ?? "unknown"
      );
      break;

    case "participant.added":
      await handleParticipantAdded(event);
      break;

    case "participant.removed":
      await handleParticipantRemoved(event);
      break;

    case "chat.created":
      await handleChatCreated(event);
      break;

    default:
      console.log(
        "[linq] unhandled_event type=%s event_id=%s",
        event.event_type,
        event.event_id
      );
  }
}

/**
 * Handle participant.added — detect if Sage was added to a group.
 */
async function handleParticipantAdded(event: LinqWebhookEvent): Promise<void> {
  const { data } = event;
  const chatId = (data?.chat_id as string) ?? null;
  const addedHandle =
    (data?.handle as string) ??
    ((data?.participant as Record<string, unknown>)?.handle as string) ??
    null;

  if (!chatId) {
    console.error("[linq] participant.added missing chat_id");
    return;
  }

  console.log(
    "[linq] participant_added chat_id=%s handle=%s trace_id=%s",
    chatId,
    addedHandle ?? "unknown",
    event.trace_id
  );

  // If the added participant is Sage, this is a group we need to set up
  if (addedHandle && normalizePhone(addedHandle) === getSagePhone()) {
    console.log("[linq] sage_added_to_group chat_id=%s", chatId);
    // Extract handles from the event payload if available
    const handles = extractHandlesFromEvent(data);
    // Silent: don't send "no accounts" yet — message.received will have fuller handle data
    await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined, { silent: true });
  }
}

/**
 * Handle participant.removed — detect when someone leaves the group.
 */
async function handleParticipantRemoved(event: LinqWebhookEvent): Promise<void> {
  const { data } = event;
  const chatId = (data?.chat_id as string) ?? null;
  const removedHandle =
    (data?.handle as string) ??
    ((data?.participant as Record<string, unknown>)?.handle as string) ??
    null;

  if (!chatId) {
    console.error("[linq] participant.removed missing chat_id");
    return;
  }

  console.log(
    "[linq] participant_removed chat_id=%s handle=%s trace_id=%s",
    chatId,
    removedHandle ?? "unknown",
    event.trace_id
  );

  const groupState = await getGroupState(chatId);
  if (!groupState || !groupState.is_active) {
    console.log("[linq] participant_removed ignored — no active group for chat_id=%s", chatId);
    return;
  }

  const normalizedRemoved = removedHandle ? normalizePhone(removedHandle) : null;

  // Case e: Sage was removed
  if (normalizedRemoved && normalizedRemoved === getSagePhone()) {
    console.log("[linq] sage_removed_from_group chat_id=%s", chatId);
    await updateGroupState(chatId, { is_active: false });
    return;
  }

  // Case d: The owner user left
  if (groupState.owner_user_id && normalizedRemoved) {
    if (await isOwnerUserPhone(normalizedRemoved, groupState.owner_user_id)) {
      console.log("[linq] owner_user_left chat_id=%s user=%s", chatId, groupState.owner_user_id);
      await sendMessage(
        chatId,
        "Take care! If you're curious about having conversations like this for yourself, check out mywalnut.app"
      );
      await updateGroupState(chatId, { is_active: false });
      return;
    }
  }

  // Case c: A non-owner participant left
  const newCount = Math.max(0, (groupState.non_persona_participant_count || 0) - 1);
  await updateGroupState(chatId, { non_persona_participant_count: newCount });

  if (newCount > 1) {
    // Other friends remain — just log it
    console.log(
      "[linq] non_owner_participant_left chat_id=%s remaining=%d",
      chatId,
      newCount
    );
    return;
  }

  // Potentially just owner user + Sage remain — verify via API before closing
  console.log("[linq] possible_close chat_id=%s — verifying via API", chatId);
  const chatInfo = await getChatInfo(chatId);

  if (!chatInfo.ok) {
    // API failed — assume close is correct (safer default)
    console.warn("[linq] getChatInfo failed on close check — closing group chat_id=%s", chatId);
    await sendMessage(
      chatId,
      "Looks like it's just us. I'm in our regular thread if you want to keep going."
    );
    await updateGroupState(chatId, { is_active: false });
    return;
  }

  // Count non-Sage participants from the API response
  const apiNonSage = chatInfo.handles
    .map((h) => normalizePhone(h))
    .filter((h) => h && h !== getSagePhone());

  if (apiNonSage.length <= 1) {
    // Confirmed: just owner user (or nobody) + Sage
    await sendMessage(
      chatId,
      "Looks like it's just us. I'm in our regular thread if you want to keep going."
    );
    await updateGroupState(chatId, { is_active: false });
    console.log("[linq] group_closed chat_id=%s api_confirmed=%d", chatId, apiNonSage.length);
  } else {
    // Counter was wrong — fix it to match reality
    console.warn(
      "[linq] counter_mismatch chat_id=%s counter=%d api=%d — fixing",
      chatId,
      newCount,
      apiNonSage.length
    );
    await updateGroupState(chatId, { non_persona_participant_count: apiNonSage.length });
  }
}

/**
 * Handle chat.created — detect if a new group chat was created.
 */
async function handleChatCreated(event: LinqWebhookEvent): Promise<void> {
  const { data } = event;
  const chatId =
    (data?.chat_id as string) ??
    (data?.id as string) ??
    ((data?.chat as Record<string, unknown>)?.id as string) ??
    null;
  const isGroup =
    (data?.is_group as boolean) ??
    ((data?.chat as Record<string, unknown>)?.is_group as boolean) ??
    false;

  if (!chatId) {
    console.error("[linq] chat.created missing chat_id");
    return;
  }

  console.log(
    "[linq] chat_created chat_id=%s is_group=%s trace_id=%s",
    chatId,
    isGroup,
    event.trace_id
  );

  if (isGroup) {
    const handles = extractHandlesFromEvent(data);
    // Silent: don't send "no accounts" yet — message.received will have fuller handle data
    await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined, { silent: true });
  }
}

/**
 * Try to extract participant handles from a webhook event payload.
 * Linq may include them in various locations.
 */
function extractHandlesFromEvent(
  data: Record<string, unknown>
): string[] {
  const handles =
    (data?.handles as string[]) ??
    ((data?.chat as Record<string, unknown>)?.handles as string[]) ??
    (data?.participants as string[]) ??
    [];
  const result = Array.isArray(handles) ? handles.map(String) : [];

  // Also capture owner_handle — Linq may put the group creator here
  // instead of in the handles array
  const ownerHandle =
    ((data?.owner_handle as Record<string, unknown>)?.handle as string) ??
    (((data?.chat as Record<string, unknown>)?.owner_handle as Record<string, unknown>)?.handle as string) ??
    null;
  if (ownerHandle && !result.includes(ownerHandle)) {
    result.push(ownerHandle);
  }

  // Also capture sender_handle — the person who triggered the event
  const senderHandle =
    ((data?.sender_handle as Record<string, unknown>)?.handle as string) ??
    null;
  if (senderHandle && !result.includes(senderHandle)) {
    result.push(senderHandle);
  }

  return result;
}

async function handleInboundMessage(event: LinqWebhookEvent): Promise<void> {
  const { data } = event;

  const sh = data?.sender_handle as Record<string, unknown> | undefined;
  const sender = data?.sender as Record<string, unknown> | undefined;
  const chat = data?.chat as Record<string, unknown> | undefined;
  const msg = data?.message as Record<string, unknown> | undefined;

  // Try multiple possible locations for sender phone
  const senderPhone =
    (sh?.handle as string) ??
    (sender?.handle as string) ??
    (chat?.display_name as string) ??
    (data?.from as string) ??
    null;

  // Try multiple possible locations for chat_id
  const chatId =
    (data?.chat_id as string) ??
    (chat?.id as string) ??
    (data?.id as string) ??
    null;

  // Try multiple possible locations for message parts
  const parts =
    (data?.parts as Array<{ type: string; value: string }>) ??
    (msg?.parts as Array<{ type: string; value: string }>) ??
    [];

  // Also try to extract text from a "body" or "text" field
  const bodyText = (data?.body as string) ?? (data?.text as string) ?? (msg?.text as string) ?? null;

  console.log(
    "[linq] inbound_parsed chat_id=%s parts=%d",
    chatId ?? "NOT_FOUND",
    (parts as unknown[]).length
  );

  if (!senderPhone || !chatId) {
    console.error("[linq] Missing sender or chat_id after trying all field locations");
    return;
  }

  // Check if this is a group message
  const isGroup =
    (data?.is_group as boolean) ??
    ((chat as Record<string, unknown>)?.is_group as boolean) ??
    false;

  if (isGroup) {
    // Check if we have a group state already
    let groupState = await getGroupState(chatId);

    if (!groupState) {
      // Unknown group — run detection first (Scenario B: message arrived before
      // participant.added webhook). Detection creates state and sends intro.
      console.log("[linq] group_message_from_unknown_chat chat_id=%s — running detection", chatId);
      const handles = extractHandlesFromEvent(data);
      groupState = await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined);
    }

    // Inactive group — check if we should re-detect or ignore
    if (!groupState || !groupState.is_active) {
      // Re-detection: if group was deactivated because no owner accounts were
      // found (owner_user_id is null), and the message mentions Sage, re-run
      // detection — a user may have linked their phone since the first attempt.
      const messageText =
        parts.filter((p: { type: string }) => p.type === "text")
          .map((p: { type: string; value: string }) => p.value).join(" ") || bodyText || "";
      const mentionsSage = mentionsPersona(messageText);

      if (groupState && !groupState.owner_user_id && mentionsSage) {
        console.log("[linq] re_detecting_inactive_group chat_id=%s", chatId);
        // Reset group state so detectAndSetupGroup re-runs from scratch
        await updateGroupState(chatId, { is_active: true, intro_sent: false });
        const handles = extractHandlesFromEvent(data);
        const redetected = await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined);
        if (redetected?.is_active && redetected?.owner_user_id) {
          console.log("[linq] re_detection_success chat_id=%s user=%s", chatId, redetected.owner_user_id);
          groupState = redetected;
          // Fall through to normal group message handling below
        } else {
          console.log("[linq] re_detection_still_no_users chat_id=%s", chatId);
          return;
        }
      } else {
        // Truly inactive — optional reminder for owner user, then ignore
        if (groupState?.owner_user_id && senderPhone) {
          if (await isOwnerUserPhone(normalizePhone(String(senderPhone)), groupState.owner_user_id)) {
            const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
            const lastReminder = groupState.last_inactive_reminder_at
              ? new Date(groupState.last_inactive_reminder_at).getTime()
              : 0;

            if (Date.now() - lastReminder > REMINDER_COOLDOWN_MS) {
              await sendMessage(
                chatId,
                "This group ended. I'm in our regular thread if you want to keep going."
              );
              await updateGroupState(chatId, {
                last_inactive_reminder_at: new Date().toISOString(),
              });
              console.log("[linq] inactive_reminder_sent chat_id=%s", chatId);
              return;
            }
          }
        }

        console.log("[linq] group_inactive chat_id=%s — ignoring message", chatId);
        return;
      }
    }

    // Extract text content for the group bridge
    const groupTextParts = parts.filter(
      (p: { type: string }) => p.type === "text"
    );
    const groupTextContent = (
      groupTextParts.map((p: { type: string; value: string }) => p.value).join("\n") ||
      bodyText ||
      ""
    ).trim();

    if (!groupTextContent) {
      console.log("[linq] group_empty_message chat_id=%s", chatId);
      return;
    }

    // Increment counter and prefetch context in parallel
    const currentCount = (groupState.messages_since_persona_spoke || 0) + 1;
    const [, prefetched] = await Promise.all([
      updateGroupState(chatId, { messages_since_persona_spoke: currentCount }),
      prefetchGroupContext(groupState, String(senderPhone)),
    ]);

    // Run the scoring-based message gate
    const lastSageSpokeAt = groupState.last_persona_spoke_at
      ? new Date(groupState.last_persona_spoke_at)
      : null;
    const gate = evaluateGate(groupTextContent, currentCount, lastSageSpokeAt);
    console.log(
      "[linq] group_gate chat_id=%s decision=%s reason=%s counter=%d score=%d",
      chatId,
      gate.decision,
      gate.reason,
      currentCount,
      gate.score
    );

    if (gate.decision === "SKIP") {
      // Save message for future context but don't call Sage
      try {
        await saveGroupMessage(prefetched, groupTextContent);
      } catch (err) {
        console.error("[linq] group_save_error chat_id=%s error=%s", chatId,
          err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // Gate says SEND_TO_SAGE — no typing indicators in groups (Linq 403s)
    const sageCallStart = Date.now();
    try {
      const result = await processGroupMessage({
        linqChatId: chatId,
        senderPhone: String(senderPhone),
        messageText: groupTextContent,
        nudgeHint: gate.addNudgeHint,
        prefetched,
      });

      const latencyMs = Date.now() - sageCallStart;
      const outcome = result.responseText ? "responded" : "no_response";

      if (result.responseText) {
        await sendMessage(chatId, result.responseText);
        await updateGroupState(chatId, {
          messages_since_persona_spoke: 0,
          last_persona_spoke_at: new Date().toISOString(),
        });
      }

      // Cost logging — track every group Sage API call for threshold tuning
      console.log(
        "[linq] GROUP_SAGE_CALL chat_id=%s counter=%d gate_reason=%s score=%d outcome=%s latency_ms=%d response_len=%d",
        chatId,
        currentCount,
        gate.reason,
        gate.score,
        outcome,
        latencyMs,
        result.responseText?.length ?? 0
      );
    } catch (err) {
      const latencyMs = Date.now() - sageCallStart;
      console.error(
        "[linq] GROUP_SAGE_CALL chat_id=%s counter=%d gate_reason=%s outcome=error latency_ms=%d error=%s",
        chatId,
        currentCount,
        gate.reason,
        latencyMs,
        err instanceof Error ? err.message : String(err)
      );
    }
    return;
  }

  // If we got body text but no parts, synthesize a text part
  const finalParts = (parts as unknown[]).length > 0
    ? parts as Array<{ type: string; value: string }>
    : bodyText
      ? [{ type: "text", value: String(bodyText) }]
      : [];

  await routeInboundMessage({
    chatId,
    senderPhone: String(senderPhone),
    parts: finalParts,
  });
}

// ---------------------------------------------------------------------------
// Webhook payload types
// ---------------------------------------------------------------------------

interface LinqWebhookEvent {
  api_version?: string;
  event_type: string;
  event_id: string;
  created_at?: string;
  trace_id?: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Env var validation
  const envError = validateEnvVars();
  if (envError) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  // Read raw body BEFORE parsing — required for signature verification
  const rawBody = await request.text();

  // Verify webhook signature
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  if (!verifySignature(rawBody, signature, timestamp)) {
    const sourceIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    console.error("[linq] signature_rejected ip=%s", sourceIp);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Parse payload
  let event: LinqWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("[linq] Malformed JSON payload");
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  console.log("[linq] webhook event_type=%s event_id=%s", event.event_type, event.event_id);

  // Deduplicate
  pruneSeenEvents();
  if (seenEvents.has(event.event_id)) {
    console.log("[linq] duplicate event_id=%s", event.event_id);
    return NextResponse.json({ ok: true });
  }
  seenEvents.set(event.event_id, Date.now());

  // Process inline. On Next.js 14 there's no reliable waitUntil for API
  // routes, and Linq's webhook timeout is generous. When Sage pipeline
  // latency becomes an issue, move to a background queue or upgrade to
  // Next.js 15's after() API.
  try {
    await handleEvent(event);
  } catch (err) {
    console.error("[linq] event_handler_failed:", err);
  }

  return NextResponse.json({ ok: true });
}
