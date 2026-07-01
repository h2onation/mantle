// GET  /api/door-intros -> { intros: Record<mode, {eyebrow,title,body}>, seen: string[] }
// POST /api/door-intros  { mode } -> { seen: string[] }
//
// GET returns the per-door one-time intro copy (admin-editable, code-default
// floor) alongside the doors THIS user has already dismissed the intro for.
// The client shows a door's intro only when its mode is absent from `seen`.
//
// POST marks a door's intro dismissed: appends the mode to door_intros_seen
// (idempotent).

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordApiError } from "@/lib/observability/record-api-error";
import { getDoorIntros } from "@/lib/persona/door-intros";
import { CONVERSATION_MODES, type ConversationMode } from "@/lib/persona/config";

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  const admin = createAdminClient();

  try {
    const auth = await requireUser({ errorMessage: "unauthenticated" });
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const [intros, profileRes] = await Promise.all([
      getDoorIntros(admin),
      admin
        .from("profiles")
        .select("door_intros_seen")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) throw profileRes.error;

    const seen: string[] = Array.isArray(profileRes.data?.door_intros_seen)
      ? profileRes.data!.door_intros_seen
      : [];

    return NextResponse.json({ intros, seen });
  } catch (err) {
    await recordApiError({
      admin,
      route: "/api/door-intros",
      method: "GET",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let capturedUserId: string | null = null;
  const admin = createAdminClient();

  try {
    const auth = await requireUser({ errorMessage: "unauthenticated" });
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
    const mode = body?.mode;
    if (!CONVERSATION_MODES.includes(mode as ConversationMode)) {
      return NextResponse.json(
        { error: "mode must be one of: " + CONVERSATION_MODES.join(", ") },
        { status: 400 },
      );
    }

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("door_intros_seen")
      .eq("id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    const current: string[] = Array.isArray(profile?.door_intros_seen)
      ? profile!.door_intros_seen
      : [];

    // Idempotent: already-seen door is a no-op.
    if (current.includes(mode as string)) {
      return NextResponse.json({ seen: current });
    }

    const nextSeen = [...current, mode as string];

    const { error: updateError } = await admin
      .from("profiles")
      .update({ door_intros_seen: nextSeen })
      .eq("id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ seen: nextSeen });
  } catch (err) {
    await recordApiError({
      admin,
      route: "/api/door-intros",
      method: "POST",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
