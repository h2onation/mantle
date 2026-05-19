import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePersonaModes } from "@/lib/persona/persona-modes-validator";

export const runtime = "edge";

interface PatchBody {
  persona_modes?: unknown;
}

// ── PATCH /api/user/persona-modes ────────────────────────────────────────
//
// Update the authed user's persona_modes on their profiles row. Used by
// the Settings page picker (auto-save on toggle). Server-side validation
// of array shape + exclusivity rule because the same DB column is read
// every conversation turn by loadConversationContext — bad data here
// would silently break Jove's voice for the user, not just produce a
// 400.

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validatePersonaModes(body.persona_modes);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ persona_modes: validated.value })
    .eq("id", user.id);

  if (updateError) {
    console.error("[user/persona-modes] update failed", {
      message: updateError.message,
    });
    return Response.json(
      { error: "Failed to save persona modes" },
      { status: 500 },
    );
  }

  return Response.json({ persona_modes: validated.value });
}
