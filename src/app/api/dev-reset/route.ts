export const runtime = "edge";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const admin = createAdminClient();

    // Delete order matters: manual_entries.source_message_id → messages.id (no CASCADE),
    // so manual_entries must be deleted BEFORE messages.
    // 1. Manual data first (removes FK refs to messages)
    await admin.from("manual_entries").delete().eq("user_id", userId);

    // 2. Feedback (FK to auth.users, not cascade-deleted without deleting auth user)
    await admin.from("feedback").delete().eq("user_id", userId);

    // 3. Messages then conversations (messages FK → conversations is CASCADE,
    //    but explicit delete avoids relying on it)
    const { data: convs } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id);
      await admin.from("messages").delete().in("conversation_id", convIds);
    }
    await admin.from("conversations").delete().eq("user_id", userId);

    // 4. Reset the profile's new-user gates so the account presents as a
    //    brand-new (logged-in) user after the wipe: the onboarding consent
    //    screen replays (onboarding_completed_at → null) and the first-session
    //    intro modals re-arm (modal_progress → 0). Conversations are already
    //    gone, so isNewUser flips true on its own; localStorage is cleared
    //    client-side. Auth row + other profile prefs (persona, phone) are
    //    left alone. Dev-only affordance — see docs/state.md.
    await admin
      .from("profiles")
      .update({ onboarding_completed_at: null, modal_progress: 0 })
      .eq("id", userId);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[dev-reset] Error:", err);
    return Response.json({ error: "Reset failed" }, { status: 500 });
  }
}
