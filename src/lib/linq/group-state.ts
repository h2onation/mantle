// ---------------------------------------------------------------------------
// Group chat state management — CRUD for the linq_group_chats table.
// Used by group detection (group-detection.ts) and the webhook handler.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

export interface GroupState {
  id: string;
  linq_chat_id: string;
  mantle_user_id: string | null;
  is_active: boolean;
  intro_sent: boolean;
  intro_sent_at: string | null;
  non_sage_participant_count: number;
  messages_since_sage_spoke: number;
  last_inactive_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Look up group state by Linq chat ID. Returns null if not a tracked group.
 */
export async function getGroupState(
  linqChatId: string
): Promise<GroupState | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("linq_group_chats")
    .select("*")
    .eq("linq_chat_id", linqChatId)
    .maybeSingle();

  if (error) {
    console.error("[group-state] getGroupState failed:", error);
    return null;
  }
  return data as GroupState | null;
}

/**
 * Create a new group state record. Handles unique constraint violations
 * from race conditions — if a record already exists, fetches and returns it.
 */
export async function createGroupState(
  linqChatId: string,
  mantleUserId: string | null,
  participantCount: number
): Promise<GroupState> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("linq_group_chats")
    .insert({
      linq_chat_id: linqChatId,
      mantle_user_id: mantleUserId,
      non_sage_participant_count: participantCount,
    })
    .select("*")
    .single();

  if (data) return data as GroupState;

  // Unique constraint violation — another webhook handler already created it.
  // This is expected during group formation (multiple webhooks arrive at once).
  if (error?.code === "23505") {
    console.log("[group-state] Race on create, fetching existing: %s", linqChatId);
    const existing = await getGroupState(linqChatId);
    if (existing) return existing;
  }

  console.error("[group-state] createGroupState failed:", error);
  throw new Error("Failed to create group state");
}

/**
 * Update fields on a group state record.
 */
export async function updateGroupState(
  linqChatId: string,
  updates: Partial<
    Pick<
      GroupState,
      | "mantle_user_id"
      | "is_active"
      | "intro_sent"
      | "intro_sent_at"
      | "non_sage_participant_count"
      | "messages_since_sage_spoke"
      | "last_inactive_reminder_at"
    >
  >
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("linq_group_chats")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("linq_chat_id", linqChatId);

  if (error) {
    console.error("[group-state] updateGroupState failed:", error);
  }
}

/**
 * Check if a Linq chat ID belongs to an active group.
 */
export async function isActiveGroup(linqChatId: string): Promise<boolean> {
  const state = await getGroupState(linqChatId);
  return state !== null && state.is_active;
}
