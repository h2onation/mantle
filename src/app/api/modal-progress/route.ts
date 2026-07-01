// GET /api/modal-progress -> { signup_at_ms, is_anonymous }
//
// Reads the authenticated user's signup time (Unix milliseconds, used by
// analytics for time-since-signup attribution) and is_anonymous flag (the
// client uses this to suppress one-time onboarding modals for anonymous-auth
// users — they convert to real users at first checkpoint).
//
// The POST handler and the modal_progress ladder it advanced were removed
// 2026-07-01 with the pattern-forming modal (Modal 2). The profiles.
// modal_progress column still exists but nothing reads it.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordApiError } from "@/lib/observability/record-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  const admin = createAdminClient();

  try {
    const auth = await requireUser({ errorMessage: "unauthenticated" });
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) throw readError;

    return NextResponse.json({
      signup_at_ms: profile?.created_at
        ? new Date(profile.created_at).getTime()
        : null,
      is_anonymous: user.is_anonymous ?? false,
    });
  } catch (err) {
    await recordApiError({
      admin,
      route: "/api/modal-progress",
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

