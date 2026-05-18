export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;

    const admin = createAdminClient();

    // Explicitly delete data first (FK order: messages → conversations → manual_entries)
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

    await admin.from("manual_entries").delete().eq("user_id", user.id);

    // Delete Linq group chats this user owned. The FK is SET NULL on profile
    // delete (so the row would otherwise survive with owner_user_id=null),
    // but the privacy policy promises full data removal — explicit delete.
    await admin.from("linq_group_chats").delete().eq("owner_user_id", user.id);

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
