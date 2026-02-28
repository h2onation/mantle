export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Explicitly delete data first (FK order: messages → conversations → manual_components)
    // The cascade chain would handle this, but explicit deletion is safer across runtimes.
    const { data: convs } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    if (convs && convs.length > 0) {
      const convIds = convs.map((c: { id: string }) => c.id);
      await admin.from("messages").delete().in("conversation_id", convIds);
      await admin.from("conversations").delete().eq("user_id", user.id);
    }

    await admin.from("manual_components").delete().eq("user_id", user.id);

    // Delete profile row (cascades from auth.users, but explicit for safety)
    await admin.from("profiles").delete().eq("id", user.id);

    // Delete the auth user itself
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      return Response.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[account/delete] Error:", err);
    return Response.json({ error: "Account deletion failed" }, { status: 500 });
  }
}
