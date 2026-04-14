// ---------------------------------------------------------------------------
// Group chat persona bridge — facilitator mode for group text conversations.
//
// Follows the same import pattern as persona-bridge.ts: shared logic lives in
// persona-pipeline.ts, channel-specific concerns stay here.
//
// Key differences from the 1:1 bridge:
//   - Uses the group system prompt (facilitator, not deep conversation)
//   - No extraction pipeline (group messages don't feed the manual)
//   - No checkpoint detection
//   - No typing indicators (Linq 403s on group typing)
//   - Handles [NO_RESPONSE] token (Sage can choose to stay quiet)
//   - Sender identity prefixed on each message so Sage knows who said what
//
// Latency design: The webhook handler calls prefetchGroupContext() once,
// then passes the result to both processGroupMessage and saveGroupMessage.
// This eliminates redundant DB queries and parallelizes independent lookups.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/persona/system-prompt";
import { PERSONA_MODEL, PERSONA_MAX_TOKENS } from "@/lib/persona/persona-pipeline";
import { type GroupState } from "./group-state";
import { normalizePhone } from "@/lib/utils/normalize-phone";

const NO_RESPONSE_TOKEN = "[NO_RESPONSE]";
const GROUP_PERSONA_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Pre-fetched context — loaded once in the webhook handler, shared by both
// the SEND and SKIP paths.
// ---------------------------------------------------------------------------

export interface PreFetchedContext {
  groupState: GroupState;
  conversationId: string;
  senderLabel: string;
  ownerUserName: string | null;
  manualComponents: { layer: number; name: string; content: string }[];
}

/**
 * Load everything both processGroupMessage and saveGroupMessage need,
 * in a single parallel batch. Called once per message in the webhook handler.
 *
 * DB queries (all in parallel):
 *   - getOrCreateGroupConversation
 *   - phone_numbers lookup (for sender label)
 *   - profiles lookup (for display name)
 *   - manual_components lookup (for Sage's system prompt)
 */
export async function prefetchGroupContext(
  groupState: GroupState,
  senderPhone: string
): Promise<PreFetchedContext> {
  const admin = createAdminClient();

  if (!groupState.owner_user_id) {
    // No owner user — only need conversation ID
    const conversationId = await getOrCreateGroupConversation(admin, groupState);
    return {
      groupState,
      conversationId,
      senderLabel: senderPhone,
      ownerUserName: null,
      manualComponents: [],
    };
  }

  // All four queries are independent — run in parallel
  const [conversationId, phoneResult, profileResult, manualResult] =
    await Promise.all([
      getOrCreateGroupConversation(admin, groupState),
      admin
        .from("phone_numbers")
        .select("phone")
        .eq("user_id", groupState.owner_user_id)
        .eq("verified", true)
        .limit(1)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", groupState.owner_user_id)
        .maybeSingle(),
      admin
        .from("manual_components")
        .select("layer, name, content")
        .eq("user_id", groupState.owner_user_id),
    ]);

  const ownerUserPhone = phoneResult.data?.phone ?? null;
  const displayName = profileResult.data?.display_name as string | null;
  const ownerUserName = displayName?.split(/\s+/)[0] ?? null;
  let manualComponents = manualResult.data || [];

  // Determine sender label
  let senderLabel = senderPhone;
  if (
    ownerUserPhone &&
    normalizePhone(senderPhone) === ownerUserPhone &&
    ownerUserName
  ) {
    senderLabel = ownerUserName;
  }

  // If phone is unlinked, clear manual (phone unlinked mid-group)
  if (!ownerUserPhone) {
    manualComponents = [];
    console.log(
      "[group-bridge] owner_user_phone_unlinked chat_id=%s user=%s — skipping manual",
      groupState.linq_chat_id,
      groupState.owner_user_id
    );
  }

  return {
    groupState,
    conversationId,
    senderLabel,
    ownerUserName,
    manualComponents,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GroupBridgeResult {
  /** Sage's response text, or null if Sage chose not to respond */
  responseText: string | null;
  conversationId: string;
}

interface GroupMessageInput {
  linqChatId: string;
  senderPhone: string;
  messageText: string;
  /** When true, prepend a nudge hint so Sage knows it's been quiet for a while */
  nudgeHint?: boolean;
  /** Pre-fetched context from prefetchGroupContext() */
  prefetched: PreFetchedContext;
}

/**
 * Process a group chat message through Sage (facilitator mode).
 *
 * Uses pre-fetched context to avoid redundant DB queries.
 * Remaining DB work: insert message, load history.
 *
 * No extraction. No checkpoints. No typing indicators.
 */
export async function processGroupMessage(
  input: GroupMessageInput
): Promise<GroupBridgeResult> {
  const { linqChatId, messageText, nudgeHint, prefetched } = input;
  const { conversationId, senderLabel, ownerUserName, manualComponents } =
    prefetched;
  const admin = createAdminClient();

  // 1. Save inbound message with sender identity prefix
  const prefixedContent = `[${senderLabel}]: ${messageText}`;

  const { error: insertErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: prefixedContent,
    channel: "text",
  });
  if (insertErr)
    console.error(
      "[group-bridge] message_insert_failed chat_id=%s error=%s",
      linqChatId,
      insertErr.message
    );

  // 2. Load conversation history (must come after insert to include new message)
  const { data: historyRows } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages: { role: "user" | "assistant"; content: string }[] = (
    historyRows || []
  )
    .filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant"
    )
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Keep a reasonable window — group chats can get chatty
  let windowedMessages = messages.slice(-30);

  // If nudge hint is active, append a hint so Sage knows it's been quiet.
  // Anthropic requires alternating user/assistant roles, so we merge the hint
  // into an existing user message or add a new one as appropriate.
  if (nudgeHint && windowedMessages.length > 0) {
    const hint =
      "\n\n[SYSTEM: It has been several messages since you last spoke. Consider whether there is something worth asking or observing.]";
    const lastMsg = windowedMessages[windowedMessages.length - 1];
    if (lastMsg.role === "user") {
      windowedMessages = [
        ...windowedMessages.slice(0, -1),
        { role: "user" as const, content: lastMsg.content + hint },
      ];
    } else {
      // Last message is assistant — safe to add a new user message
      windowedMessages = [
        ...windowedMessages,
        { role: "user" as const, content: `[${senderLabel}]:${hint}` },
      ];
    }
  }

  // 3. Build system prompt with group context
  const systemPrompt = buildSystemPrompt({
    manualComponents,
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: false,
    turnCount: windowedMessages.length,
    checkpointApproaching: false,
    groupContext: {
      ownerUserName,
      hasManualContext: manualComponents.length > 0,
    },
  });

  // 4. Call Sage (non-streaming, shorter timeout than 1:1 — silence is fine in groups)
  const response = await anthropicFetch(
    {
      model: PERSONA_MODEL,
      max_tokens: PERSONA_MAX_TOKENS,
      system: systemPrompt,
      messages: windowedMessages,
    },
    GROUP_PERSONA_TIMEOUT_MS
  );

  const fullText =
    response.content?.[0]?.text || "Something went wrong on my end.";
  const trimmed = fullText.trim();

  // 5. Check for [NO_RESPONSE]
  if (trimmed === NO_RESPONSE_TOKEN) {
    console.log(
      "[group-bridge] no_response chat_id=%s sender=%s",
      linqChatId,
      senderLabel
    );
    return { responseText: null, conversationId };
  }

  // 6. Save Sage's response
  const { error: saveErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: trimmed,
    channel: "text",
  });
  if (saveErr)
    console.error(
      "[group-bridge] response_save_failed chat_id=%s error=%s",
      linqChatId,
      saveErr.message
    );

  console.log(
    "[group-bridge] response chat_id=%s sender=%s len=%d",
    linqChatId,
    senderLabel,
    trimmed.length
  );

  return { responseText: trimmed, conversationId };
}

/**
 * Save a group message without calling Sage. Used when the message gate
 * returns SKIP — the message is stored for future context but Sage doesn't
 * see it in real time.
 *
 * Uses pre-fetched context — just a single DB insert.
 */
export async function saveGroupMessage(
  prefetched: PreFetchedContext,
  messageText: string
): Promise<void> {
  const admin = createAdminClient();
  const prefixedContent = `[${prefetched.senderLabel}]: ${messageText}`;

  const { error } = await admin.from("messages").insert({
    conversation_id: prefetched.conversationId,
    role: "user",
    content: prefixedContent,
    channel: "text",
  });
  if (error)
    console.error(
      "[group-bridge] save_message_failed chat_id=%s error=%s",
      prefetched.groupState.linq_chat_id,
      error.message
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find or create a conversation record for this group chat.
 * Group conversations are linked via linq_group_chat_id on the conversations table.
 */
async function getOrCreateGroupConversation(
  admin: ReturnType<typeof createAdminClient>,
  groupState: GroupState
): Promise<string> {
  // Look for existing conversation linked to this group
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("linq_group_chat_id", groupState.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a new conversation for this group
  if (!groupState.owner_user_id) {
    console.error(
      "[group-bridge] Cannot create conversation for multi-user group: %s",
      groupState.linq_chat_id
    );
    throw new Error("Multi-user group conversations not yet supported");
  }

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      user_id: groupState.owner_user_id,
      status: "active",
      linq_group_chat_id: groupState.id,
    })
    .select("id")
    .single();

  if (created) return created.id;

  // Race condition: another request may have created it
  if (error) {
    console.warn("[group-bridge] Insert race, re-querying:", error.message);
    const { data: retry } = await admin
      .from("conversations")
      .select("id")
      .eq("linq_group_chat_id", groupState.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (retry) return retry.id;
  }

  throw new Error("Failed to create group conversation");
}
