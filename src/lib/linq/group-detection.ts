// ---------------------------------------------------------------------------
// Group chat detection — identifies owner users and sends introductions.
//
// Called from the webhook handler when:
//   - participant.added fires with Sage's phone number
//   - message.received arrives from an unknown is_group chat
//   - chat.created fires for a group chat
//
// All three scenarios run the same identification and intro logic.
// Race-safe: unique constraint on linq_chat_id + intro_sent flag
// prevent duplicate records and duplicate introductions.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, getChatInfo } from "./sender";
import {
  getGroupState,
  createGroupState,
  updateGroupState,
  type GroupState,
} from "./group-state";
import { normalizePhone } from "@/lib/utils/normalize-phone";

const INTRO_NO_ACCOUNTS =
  "This is Sage by mywalnut. I don't have any connected accounts in this group. " +
  "If you have a mywalnut account, connect your number at mywalnut.app";

const INTRO_MULTI_USER =
  "Hey, I'm Sage. I know some of you from mywalnut, but in a group I keep " +
  "things neutral and don't draw on what I know about anyone individually.";

const INTRO_SETUP_FAILED =
  "I'm having trouble getting set up. Try adding me to a new group.";

/**
 * Main entry point for group detection. Idempotent — safe to call from
 * multiple webhook handlers racing on the same group formation.
 *
 * Returns the group state (existing or newly created), or null on failure.
 */
export async function detectAndSetupGroup(
  linqChatId: string,
  webhookHandles?: string[],
  options?: { silent?: boolean }
): Promise<GroupState | null> {
  const silent = options?.silent ?? false;
  // 1. Check if we already have a record for this group
  const existing = await getGroupState(linqChatId);
  if (existing) {
    console.log(
      "[group-detect] Already tracked chat_id=%s active=%s intro=%s owner_user=%s",
      linqChatId,
      existing.is_active,
      existing.intro_sent,
      existing.owner_user_id ?? "none"
    );
    // Re-detection path: if the group is active with intro_sent=false and
    // no owner_user yet, this is a re-detection attempt — fall through to
    // re-run identification instead of returning early.
    if (existing.is_active && !existing.intro_sent && !existing.owner_user_id) {
      console.log("[group-detect] re_detection_path chat_id=%s", linqChatId);
      // Fall through to re-run identification
    } else {
      // Normal case: still run intro if it hasn't been sent yet (race recovery)
      if (!existing.intro_sent && existing.is_active) {
        await sendIntroduction(linqChatId, existing);
      }
      return existing;
    }
  }

  // 2. Get participant list — prefer webhook data, fall back to API
  let handles = webhookHandles ?? [];
  if (handles.length === 0) {
    const chatInfo = await getChatInfo(linqChatId);
    if (!chatInfo.ok) {
      // API failed after retry — mark inactive, only notify on real messages
      console.error(
        "[group-detect] getChatInfo failed for chat_id=%s trace_id=%s",
        linqChatId,
        chatInfo.traceId
      );
      if (!silent) {
        await sendMessage(linqChatId, INTRO_SETUP_FAILED);
      }
      const state = await createGroupState(linqChatId, null, 0);
      await updateGroupState(linqChatId, { is_active: false });
      return state;
    }
    handles = chatInfo.handles;
  }

  // 3. Identify participants
  const sagePhone = normalizePhone(process.env.LINQ_PHONE_NUMBER || "");
  const nonSageHandles = handles
    .map((h) => normalizePhone(h))
    .filter((h) => h && h !== sagePhone);

  const participantCount = nonSageHandles.length;

  console.log(
    "[group-detect] chat_id=%s participants=%d handles=%j",
    linqChatId,
    participantCount,
    nonSageHandles
  );

  // 4. Look up owner users among participants
  const admin = createAdminClient();
  const { data: phoneRows, error: lookupError } = await admin
    .from("phone_numbers")
    .select("user_id, phone")
    .in("phone", nonSageHandles)
    .eq("verified", true);

  if (lookupError) {
    console.error("[group-detect] Phone lookup failed");
  }

  const ownerUsers = phoneRows ?? [];
  const uniqueUserIds = Array.from(new Set(ownerUsers.map((r) => r.user_id)));

  console.log(
    "[group-detect] chat_id=%s owner_users=%d user_ids=%j",
    linqChatId,
    uniqueUserIds.length,
    uniqueUserIds
  );

  // Helper: create or update group state (re-detection reuses existing record)
  async function getOrCreateState(
    ownerUserId: string | null,
    count: number
  ): Promise<GroupState> {
    if (existing) {
      await updateGroupState(linqChatId, {
        owner_user_id: ownerUserId,
        non_sage_participant_count: count,
      });
      return { ...existing, owner_user_id: ownerUserId, non_sage_participant_count: count };
    }
    return createGroupState(linqChatId, ownerUserId, count);
  }

  // 5. Route based on owner user count
  if (uniqueUserIds.length === 1) {
    // Exactly one owner user — standard group setup
    const userId = uniqueUserIds[0];
    const state = await getOrCreateState(userId, participantCount);
    await sendIntroduction(linqChatId, state);
    return state;
  }

  if (uniqueUserIds.length === 0) {
    // No owner users — deactivate. Only send the notice when triggered by
    // an actual message (silent=false). Formation events (chat.created,
    // participant.added) stay quiet because more events with fuller handle
    // lists typically arrive moments later.
    const state = await getOrCreateState(null, participantCount);
    await updateGroupState(linqChatId, { is_active: false });
    if (!silent) {
      await sendMessage(linqChatId, INTRO_NO_ACCOUNTS);
    }
    console.log("[group-detect] no_owner_users chat_id=%s silent=%s", linqChatId, silent);
    return { ...state, is_active: false };
  }

  // Multiple owner users — deferred dual-manual case
  const state = await getOrCreateState(null, participantCount);
  await updateGroupState(linqChatId, { intro_sent: true });
  await sendMessage(linqChatId, INTRO_MULTI_USER);
  console.log(
    "[group-detect] multi_owner_users chat_id=%s count=%d",
    linqChatId,
    uniqueUserIds.length
  );
  return state;
}

/**
 * Send the introduction message for a single-owner-user group.
 * Sets intro_sent BEFORE sending to prevent duplicates from racing handlers.
 */
async function sendIntroduction(
  linqChatId: string,
  state: GroupState
): Promise<void> {
  if (state.intro_sent || !state.owner_user_id) return;

  // Set intro_sent first — prevents duplicate intros from race conditions
  await updateGroupState(linqChatId, { intro_sent: true });

  // Look up owner user's display name for the intro
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", state.owner_user_id)
    .maybeSingle();

  // Extract first name from display_name (take first word)
  const displayName = profile?.display_name as string | null;
  const firstName = displayName?.split(/\s+/)[0] ?? null;

  const introText = firstName
    ? `Hey, I'm Sage by mywalnut. I'll use what I know about ${firstName}'s patterns to ask better questions, but I won't share details from private conversations.`
    : "Hey, I'm Sage by mywalnut. I'll use what I know to ask better questions, but I won't share details from private conversations.";

  const result = await sendMessage(linqChatId, introText);

  if (result.ok) {
    console.log(
      "[group-detect] intro_sent chat_id=%s user=%s name=%s",
      linqChatId,
      state.owner_user_id,
      firstName ?? "(no name)"
    );
  } else {
    // Intro failed after sendMessage's built-in retry — deactivate group
    console.error(
      "[group-detect] intro_send_failed chat_id=%s — deactivating group",
      linqChatId
    );
    await updateGroupState(linqChatId, { is_active: false });
  }
}
