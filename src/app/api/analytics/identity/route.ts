// Returns the current user's hashed ID for PostHog identification.
// Hash is computed server-side using the same salt as structured logs,
// so PostHog IDs correlate with confirm_failures rows without sending
// the raw user_id to a third party.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashUserId } from "@/lib/observability/log";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hashedId: null });
  }

  const hashedId = await hashUserId(user.id);

  return NextResponse.json({
    hashedId,
    // Non-PII properties only.
    // NEVER add: email, phone, display_name, raw user_id.
    // Safe to add later: signup_cohort, persona_mode (if that field exists on profile).
    properties: {},
  });
}
