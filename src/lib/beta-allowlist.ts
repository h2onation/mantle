// Beta access gate. Access is derived from the waitlist row's status: an email
// is allowed when it has a waitlist row with status = 'invited'. Reads via the
// service-role admin client because the table has no user-facing RLS policy.

import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Pragmatic format check — Postgres won't validate, and we'd rather catch
// obvious junk before hitting the DB. Anything stricter rejects valid
// edge-case addresses.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Returns true if the given email (after lowercase + trim) has a waitlist row
 * with status = 'invited'. Errors fail CLOSED — if we cannot confirm an
 * invited row, we deny access. The beta gate is more important than uptime
 * here.
 */
export async function isEmailAllowlisted(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist")
    .select("id")
    .eq("email", normalized)
    .eq("status", "invited")
    .maybeSingle();

  if (error) {
    console.error("[beta-allowlist] lookup error:", error.message);
    return false;
  }

  return data !== null;
}
