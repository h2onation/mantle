// GET  /api/modal-progress -> { modal_progress, signup_at_ms, is_anonymous }
// POST /api/modal-progress  { target: 1 | 2 | 3 } -> { modal_progress: number }
//
// GET reads the authenticated user's current modal progression alongside
// their signup time (Unix milliseconds, used by analytics for time-since-
// signup attribution) and is_anonymous flag (the client uses this to
// suppress modals for anonymous-auth users — they convert to real users
// at first checkpoint and start the modal flow then).
//
// POST advances the authenticated user's onboarding modal progression.
// Idempotent: target <= current is a no-op and returns the current value.
// Targets outside {1, 2, 3} return 400.
//
// Dev utility — reset modal_progress for a test user (run by hand in the
// Supabase SQL editor, NOT via a migration):
//   UPDATE profiles SET modal_progress = 0 WHERE id = '<user_id>';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordApiError } from "@/lib/observability/record-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  const admin = createAdminClient();

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    capturedUserId = user.id;

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("modal_progress, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) throw readError;

    return NextResponse.json({
      modal_progress: profile?.modal_progress ?? 0,
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

export async function POST(req: Request) {
  let capturedUserId: string | null = null;
  const admin = createAdminClient();

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    capturedUserId = user.id;

    const body = (await req.json().catch(() => null)) as
      | { target?: unknown }
      | null;
    const target = body?.target;
    if (
      typeof target !== "number" ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 3
    ) {
      return NextResponse.json(
        { error: "target must be an integer between 1 and 3" },
        { status: 400 }
      );
    }

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("modal_progress")
      .eq("id", user.id)
      .maybeSingle();

    if (readError) throw readError;

    const current = profile?.modal_progress ?? 0;

    if (target <= current) {
      return NextResponse.json({ modal_progress: current });
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({ modal_progress: target })
      .eq("id", user.id)
      .select("modal_progress")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ modal_progress: updated.modal_progress });
  } catch (err) {
    await recordApiError({
      admin,
      route: "/api/modal-progress",
      method: "POST",
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
