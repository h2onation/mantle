import type { createAdminClient } from "@/lib/supabase/admin";
import { PERSONA_NAME } from "@/lib/persona/config";

/**
 * The anonymous conversion wall (Gate B). An anonymous user who has already
 * built this many Manual entries must create an account before anything that
 * could write another.
 */
export const ANON_CHECKPOINT_LIMIT = 2;

export interface AnonCheckpointBlock {
  blocked: true;
  reason: "signup_required";
  message: string;
}

/**
 * Single source of truth for the anonymous conversion wall, shared by
 * /api/chat and /api/checkpoint/compose. Returns the blocked payload to send
 * to the client (200 JSON: { blocked, reason: "signup_required", message }),
 * or null when the user may proceed.
 *
 * Call BEFORE any rate limiter or Anthropic call so a converted-out anonymous
 * user never burns Upstash quota or API tokens.
 */
export async function checkAnonCheckpointGate(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; is_anonymous?: boolean }
): Promise<AnonCheckpointBlock | null> {
  if (user.is_anonymous !== true) return null;

  const { count } = await admin
    .from("manual_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= ANON_CHECKPOINT_LIMIT) {
    return {
      blocked: true,
      reason: "signup_required",
      message: `You've started building your manual. Create an account to keep what you've built and continue with ${PERSONA_NAME}.`,
    };
  }
  return null;
}
