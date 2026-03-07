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

    // Delete order matters: manual_components.source_message_id → messages.id (no CASCADE),
    // so manual_components must be deleted BEFORE messages.
    // 1. Manual data first (removes FK refs to messages)
    await admin.from("manual_components").delete().eq("user_id", userId);
    await admin.from("manual_changelog").delete().eq("user_id", userId);

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

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[dev-reset] Error:", err);
    return Response.json({ error: "Reset failed" }, { status: 500 });
  }
}
