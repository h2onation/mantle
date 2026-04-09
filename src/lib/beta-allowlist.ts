// Beta access gate. Reads beta_allowlist via the service-role admin client
// because the table has no user-facing RLS policies.

import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns true if the given email (after lowercase + trim) appears in
 * beta_allowlist. Errors fail CLOSED — if we cannot confirm allowlist
 * membership, we deny access. The beta gate is more important than
 * uptime here.
 */
export async function isEmailAllowlisted(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_allowlist")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("[beta-allowlist] lookup error:", error.message);
    return false;
  }

  return data !== null;
}
