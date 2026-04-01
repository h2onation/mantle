import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { routeInboundMessage } from "@/lib/linq/message-router";
import { detectAndSetupGroup } from "@/lib/linq/group-detection";
import { getGroupState, updateGroupState } from "@/lib/linq/group-state";
import { processGroupMessage } from "@/lib/linq/group-bridge";
import { sendMessage } from "@/lib/linq/sender";
import { normalizePhone } from "@/lib/utils/normalize-phone";

export const runtime = "nodejs";

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
      // Part 6d will add full handling. For now, log it.
      console.log(
        "[linq] participant_removed chat_id=%s handle=%s trace_id=%s",
        (event.data?.chat_id as string) ?? "unknown",
        (event.data?.handle as string) ??
          ((event.data?.participant as Record<string, unknown>)?.handle as string) ??
          "unknown",
        event.trace_id
      );
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
  const sagePhone = normalizePhone(process.env.LINQ_PHONE_NUMBER || "");
  if (addedHandle && normalizePhone(addedHandle) === sagePhone) {
    console.log("[linq] sage_added_to_group chat_id=%s", chatId);
    // Extract handles from the event payload if available
    const handles = extractHandlesFromEvent(data);
    await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined);
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
    await detectAndSetupGroup(chatId, handles.length > 0 ? handles : undefined);
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
  return Array.isArray(handles) ? handles.map(String) : [];
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
    "[linq] inbound_parsed sender=%s chat_id=%s parts=%d body=%s",
    senderPhone ?? "NOT_FOUND",
    chatId ?? "NOT_FOUND",
    (parts as unknown[]).length,
    bodyText ? String(bodyText).substring(0, 50) : "none"
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

    // Inactive group — ignore silently (Part 6d will add reminder logic)
    if (!groupState || !groupState.is_active) {
      console.log(
        "[linq] group_inactive chat_id=%s — ignoring message",
        chatId
      );
      return;
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
      console.log("[linq] group_empty_message chat_id=%s sender=%s", chatId, senderPhone);
      return;
    }

    // Extract sender name from webhook payload if available
    const senderName =
      (sh?.display_name as string) ??
      (sender?.display_name as string) ??
      (sh?.name as string) ??
      (sender?.name as string) ??
      null;

    // Route to group bridge — no typing indicators in groups (Linq 403s)
    try {
      const result = await processGroupMessage({
        linqChatId: chatId,
        senderPhone: String(senderPhone),
        senderName,
        messageText: groupTextContent,
      });

      if (result.responseText) {
        // Sage responded — send and reset counter
        await sendMessage(chatId, result.responseText);
        await updateGroupState(chatId, { messages_since_sage_spoke: 0 });
        console.log(
          "[linq] group_sage_response chat_id=%s len=%d",
          chatId,
          result.responseText.length
        );
      } else {
        // Sage chose [NO_RESPONSE] — increment counter (don't reset)
        await updateGroupState(chatId, {
          messages_since_sage_spoke: (groupState.messages_since_sage_spoke || 0) + 1,
        });
        console.log("[linq] group_sage_silent chat_id=%s", chatId);
      }
    } catch (err) {
      console.error(
        "[linq] group_bridge_error chat_id=%s error=%s",
        chatId,
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

  // Log FULL event payload so we can see Linq's actual structure
  console.log("[linq] FULL_EVENT: %s", JSON.stringify(event));

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
