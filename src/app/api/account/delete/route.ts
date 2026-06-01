export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;

    const admin = createAdminClient();

    // Ordered, fail-closed deletion. Children before parents, and crucially
    // manual_entries BEFORE messages: manual_entries.source_message_id
    // references messages with NO ON DELETE rule (i.e. RESTRICT), so an entry
    // pins its source message and the message can't be removed first. The old
    // code deleted messages/conversations first; those statements silently
    // errored (unchecked) and only the final profiles cascade actually cleaned
    // up — so naively "adding error checks" to that order would have 500'd
    // every real user. We delete in the correct order, check every step, and
    // refuse to delete the auth user if any step fails (a half-cascade that
    // still removed the auth row would strand SET-NULL rows like
    // linq_group_chats, breaking the privacy promise of full removal).
    const fail = (label: string, error: { message?: string } | null) => {
      console.error(
        `[account/delete] step '${label}' failed:`,
        error?.message ?? "unknown"
      );
      return Response.json(
        { error: "Account deletion failed" },
        { status: 500 }
      );
    };

    // 1. manual_entries first (they RESTRICT-reference messages).
    {
      const { error } = await admin
        .from("manual_entries")
        .delete()
        .eq("user_id", user.id);
      if (error) return fail("manual_entries", error);
    }

    // 2-3. messages (scoped via the user's conversations), then conversations.
    const { data: convs, error: convReadError } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);
    if (convReadError) return fail("conversations.read", convReadError);
    if (convs && convs.length > 0) {
      const convIds = convs.map((c: { id: string }) => c.id);
      const { error: msgError } = await admin
        .from("messages")
        .delete()
        .in("conversation_id", convIds);
      if (msgError) return fail("messages", msgError);
      const { error: convError } = await admin
        .from("conversations")
        .delete()
        .eq("user_id", user.id);
      if (convError) return fail("conversations", convError);
    }

    // 4. Linq group chats this user owned. The FK is SET NULL on profile
    // delete (the row would otherwise survive with owner_user_id=null), but
    // the privacy policy promises full removal — so delete explicitly.
    {
      const { error } = await admin
        .from("linq_group_chats")
        .delete()
        .eq("owner_user_id", user.id);
      if (error) return fail("linq_group_chats", error);
    }

    // 5. Profile row (cascades any remaining children).
    {
      const { error } = await admin
        .from("profiles")
        .delete()
        .eq("id", user.id);
      if (error) return fail("profiles", error);
    }

    // 6. Finally the auth user — only reached if every data delete succeeded.
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) return fail("auth.user", authError);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[account/delete] Error:", err);
    return Response.json({ error: "Account deletion failed" }, { status: 500 });
  }
}
