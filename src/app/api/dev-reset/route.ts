export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Delete in order: messages → conversations → manual_components
    // (messages have FK to conversations)
    const { data: convs } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id);
      await admin.from("messages").delete().in("conversation_id", convIds);
      await admin.from("conversations").delete().eq("user_id", user.id);
    }

    await admin.from("manual_components").delete().eq("user_id", user.id);
    await admin.from("manual_changelog").delete().eq("user_id", user.id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[dev-reset] Error:", err);
    return Response.json({ error: "Reset failed" }, { status: 500 });
  }
}
