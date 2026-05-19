/**
 * Per-user daily message cap. Counts user-authored messages joined
 * through `messages` → `conversations.user_id`, rolling on UTC midnight.
 *
 * Why this exists: ADR-038 dropped the per-row OTP-attempts counter on
 * the assumption that Upstash would carry per-user abuse protection.
 * Upstash is currently failing open in production (env vars missing).
 * The Postgres-backed daily cap below is the active beta defense
 * against runaway chat token spend per user — no new vendor required.
 *
 * Layered relationship with `@upstash/ratelimit`:
 *   - This Postgres check is the always-on per-user usage cap.
 *   - When Upstash is provisioned (future), the `chatAuthMinute` /
 *     `chatAuthDay` limiters in `src/lib/rate-limit.ts` add burst +
 *     scale defense on top. The two layers are independent; the lower
 *     limit wins per turn.
 *   - The default DAILY_MESSAGE_LIMIT (200) is intentionally permissive
 *     for beta — a deep Situation conversation is ~30–50 user turns, so
 *     three real conversations a day land near 150 and stay clear of
 *     the cap. A runaway script hits 200 fast.
 *
 * Fail-open semantics: if the count query itself errors (Supabase down,
 * RLS misconfigured, etc.), the helper returns 0 and the user is
 * allowed through. Aligns with the existing `@upstash/ratelimit` policy
 * of not compounding infrastructure outages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_DAILY_MESSAGE_LIMIT = 200;

/**
 * Read the daily message limit from `DAILY_MESSAGE_LIMIT` env var. Falls
 * back to {@link DEFAULT_DAILY_MESSAGE_LIMIT} on missing / invalid /
 * non-positive values.
 */
export function getDailyMessageLimit(): number {
  const fromEnv = process.env.DAILY_MESSAGE_LIMIT;
  if (!fromEnv) return DEFAULT_DAILY_MESSAGE_LIMIT;
  const parsed = parseInt(fromEnv, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_MESSAGE_LIMIT;
  }
  return parsed;
}

/** ISO timestamp at the start of the current UTC day. */
function startOfTodayUTCISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/**
 * Count user-authored messages on the current UTC day across all of the
 * user's conversations. Joins via `conversations!inner` so the filter
 * runs server-side. Returns 0 on query error (fail-open).
 */
export async function getUserDailyMessageCount(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("messages")
    .select("id, conversations!inner(user_id)", {
      count: "exact",
      head: true,
    })
    .eq("conversations.user_id", userId)
    .eq("role", "user")
    .gte("created_at", startOfTodayUTCISO());
  if (error) {
    console.error("[usage] daily count query failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export interface DailyLimitCheck {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Check whether the user is under their daily message limit. Returns
 * the current count and the limit alongside the boolean so callers can
 * surface useful messaging on rejection.
 */
export async function checkDailyMessageLimit(
  admin: SupabaseClient,
  userId: string,
): Promise<DailyLimitCheck> {
  const limit = getDailyMessageLimit();
  const count = await getUserDailyMessageCount(admin, userId);
  return { allowed: count < limit, count, limit };
}
