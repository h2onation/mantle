// ---------------------------------------------------------------------------
// Group chat Sage bridge — facilitator mode for group text conversations.
//
// Follows the same import pattern as sage-bridge.ts: shared logic lives in
// sage-pipeline.ts, channel-specific concerns stay here.
//
// Key differences from the 1:1 bridge:
//   - Uses the group system prompt (facilitator, not deep conversation)
//   - No extraction pipeline (group messages don't feed the manual)
//   - No checkpoint detection
//   - No typing indicators (Linq 403s on group typing)
//   - Handles [NO_RESPONSE] token (Sage can choose to stay quiet)
//   - Sender identity prefixed on each message so Sage knows who said what
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicFetch } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/sage/system-prompt";
import { SAGE_MODEL, SAGE_MAX_TOKENS } from "@/lib/sage/sage-pipeline";
import { getGroupState, type GroupState } from "./group-state";

const NO_RESPONSE_TOKEN = "[NO_RESPONSE]";
const GROUP_SAGE_TIMEOUT_MS = 15_000;

export interface GroupBridgeResult {
  /** Sage's response text, or null if Sage chose not to respond */
  responseText: string | null;
  conversationId: string;
}

interface GroupMessageInput {
  linqChatId: string;
  senderPhone: string;
  senderName: string | null;
  messageText: string;
  /** When true, prepend a nudge hint so Sage knows it's been quiet for a while */
  nudgeHint?: boolean;
}

/**
 * Process a group chat message through Sage (facilitator mode).
 *
 * 1. Finds or creates the group's conversation record
 * 2. Saves the inbound message with sender identity prefix
 * 3. Loads the Mantle user's manual (if single-user group)
 * 4. Calls Sage with the group system prompt
 * 5. Checks for [NO_RESPONSE] — returns null if Sage stays quiet
 * 6. Saves and returns Sage's response
 *
 * No extraction. No checkpoints. No typing indicators.
 */
export async function processGroupMessage(
  input: GroupMessageInput
): Promise<GroupBridgeResult> {
  const { linqChatId, senderPhone, senderName, messageText, nudgeHint } = input;
  const admin = createAdminClient();

  // 1. Get group state
  const groupState = await getGroupState(linqChatId);
  if (!groupState) {
    throw new Error(`No group state for chat_id=${linqChatId}`);
  }

  // 2. Find or create the group's conversation
  const conversationId = await getOrCreateGroupConversation(
    admin,
    groupState
  );

  // 3. Save inbound message with sender identity prefix
  const senderLabel = senderName || senderPhone;
  const prefixedContent = `[${senderLabel}]: ${messageText}`;

  const { error: insertErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: prefixedContent,
    channel: "text",
  });
  if (insertErr) console.error("[group-bridge] message_insert_failed chat_id=%s error=%s", linqChatId, insertErr.message);

  // 4. Load conversation history (group messages only — isolated by conversation_id)
  const { data: historyRows } = await admin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages: { role: "user" | "assistant"; content: string }[] = (
    historyRows || []
  )
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
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

  // 5. Load Mantle user's manual (if single-user group and phone still linked)
  let manualComponents: { layer: number; type: string; name: string; content: string }[] = [];
  let mantleUserName: string | null = null;

  if (groupState.mantle_user_id) {
    // Verify the Mantle user's phone is still linked (they may have unlinked mid-group)
    const { data: phoneCheck } = await admin
      .from("phone_numbers")
      .select("id")
      .eq("user_id", groupState.mantle_user_id)
      .eq("verified", true)
      .limit(1)
      .maybeSingle();

    if (phoneCheck) {
      const [manualResult, profileResult] = await Promise.all([
        admin
          .from("manual_components")
          .select("layer, type, name, content")
          .eq("user_id", groupState.mantle_user_id),
        admin
          .from("profiles")
          .select("display_name")
          .eq("id", groupState.mantle_user_id)
          .maybeSingle(),
      ]);

      manualComponents = manualResult.data || [];
      const displayName = profileResult.data?.display_name as string | null;
      mantleUserName = displayName?.split(/\s+/)[0] ?? null;
    } else {
      console.log(
        "[group-bridge] mantle_user_phone_unlinked chat_id=%s user=%s — skipping manual",
        linqChatId,
        groupState.mantle_user_id
      );
    }
  }

  // 6. Build system prompt with group context
  const systemPrompt = buildSystemPrompt({
    manualComponents,
    isReturningUser: false,
    sessionSummary: null,
    extractionContext: "",
    isFirstCheckpoint: false,
    turnCount: windowedMessages.length,
    hasPatternEligibleLayer: false,
    checkpointApproaching: false,
    groupContext: {
      mantleUserName,
      hasManualContext: manualComponents.length > 0,
    },
  });

  // 7. Call Sage (non-streaming, shorter timeout than 1:1 — silence is fine in groups)
  const response = await anthropicFetch(
    {
      model: SAGE_MODEL,
      max_tokens: SAGE_MAX_TOKENS,
      system: systemPrompt,
      messages: windowedMessages,
    },
    GROUP_SAGE_TIMEOUT_MS
  );

  const fullText =
    response.content?.[0]?.text || "Something went wrong on my end.";
  const trimmed = fullText.trim();

  // 8. Check for [NO_RESPONSE]
  if (trimmed === NO_RESPONSE_TOKEN) {
    console.log(
      "[group-bridge] no_response chat_id=%s sender=%s",
      linqChatId,
      senderLabel
    );
    return { responseText: null, conversationId };
  }

  // 9. Save Sage's response
  const { error: saveErr } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: trimmed,
    channel: "text",
  });
  if (saveErr) console.error("[group-bridge] response_save_failed chat_id=%s error=%s", linqChatId, saveErr.message);

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
 */
export async function saveGroupMessage(
  linqChatId: string,
  senderPhone: string,
  senderName: string | null,
  messageText: string
): Promise<void> {
  const admin = createAdminClient();
  const groupState = await getGroupState(linqChatId);
  if (!groupState) return;

  const conversationId = await getOrCreateGroupConversation(admin, groupState);
  const senderLabel = senderName || senderPhone;
  const prefixedContent = `[${senderLabel}]: ${messageText}`;

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: prefixedContent,
    channel: "text",
  });
  if (error) console.error("[group-bridge] save_message_failed chat_id=%s error=%s", linqChatId, error.message);
}

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
  // user_id is required — use the mantle_user_id if available
  if (!groupState.mantle_user_id) {
    // Multi-user groups: we still need a user_id for the FK constraint.
    // Use the group's id as a marker — the conversation won't be loaded
    // by any 1:1 flow because linq_group_chat_id is set.
    // For now, multi-user groups without a mantle_user_id can't create
    // a conversation. Log and throw.
    console.error(
      "[group-bridge] Cannot create conversation for multi-user group: %s",
      groupState.linq_chat_id
    );
    throw new Error("Multi-user group conversations not yet supported");
  }

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      user_id: groupState.mantle_user_id,
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
