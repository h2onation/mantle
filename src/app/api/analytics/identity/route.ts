// Returns the current user's hashed ID for PostHog identification.
// Hash is computed server-side using the same salt as structured logs,
// so PostHog IDs correlate with confirm_failures rows without sending
// the raw user_id to a third party.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashUserId } from "@/lib/observability/log";
import { recordApiError } from "@/lib/observability/record-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    capturedUserId = user?.id ?? null;

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
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/analytics/identity",
      method: "GET",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
