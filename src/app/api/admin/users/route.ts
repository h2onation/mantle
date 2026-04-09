import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Get auth users for emails (perPage avoids default 50-user pagination limit)
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) {
      console.error("[admin/users] Auth list error:", authError);
      return Response.json({ error: "Failed to list users" }, { status: 500 });
    }

    const emailMap: Record<string, string> = {};
    const anonMap: Record<string, boolean> = {};
    const createdMap: Record<string, string> = {};
    for (const u of authData.users) {
      emailMap[u.id] = u.email || "";
      anonMap[u.id] = !u.email;
      createdMap[u.id] = u.created_at;
    }

    // Get profiles
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name");

    if (profileError) {
      console.error("[admin/users] Profiles error:", profileError);
      return Response.json({ error: "Failed to load profiles" }, { status: 500 });
    }

    // Include auth users that have no profile row (e.g. admin account
    // created before the auto-profile trigger, or trigger failed)
    const profileIds = new Set((profiles || []).map((p) => p.id));
    const missingProfiles = authData.users
      .filter((u) => !profileIds.has(u.id))
      .map((u) => ({ id: u.id, display_name: null }));

    const allProfiles = [...(profiles || []), ...missingProfiles];

    if (allProfiles.length === 0) {
      return Response.json({ users: [] });
    }

    const userIds = allProfiles.map((p) => p.id);

    // Count conversations per user + track last conversation timestamp.
    const { data: conversations } = await admin
      .from("conversations")
      .select("id, user_id, updated_at")
      .in("user_id", userIds);

    const convCounts: Record<string, number> = {};
    const lastConvAtMap: Record<string, string> = {};
    const convToUserId: Record<string, string> = {};
    if (conversations) {
      for (const c of conversations) {
        convCounts[c.user_id] = (convCounts[c.user_id] || 0) + 1;
        if (
          !lastConvAtMap[c.user_id] ||
          c.updated_at > lastConvAtMap[c.user_id]
        ) {
          lastConvAtMap[c.user_id] = c.updated_at;
        }
        convToUserId[c.id] = c.user_id;
      }
    }

    // Compute last active per user via messages.created_at, joined back to
    // the user via the conversation. messages has no user_id column so we
    // map message → conversation → user in JS. Fine for the small admin
    // user count; revisit if it grows.
    const lastActiveMap: Record<string, string> = {};
    const convIds = Object.keys(convToUserId);
    if (convIds.length > 0) {
      const { data: messages } = await admin
        .from("messages")
        .select("conversation_id, created_at")
        .in("conversation_id", convIds);
      if (messages) {
        for (const m of messages) {
          const uid = convToUserId[m.conversation_id];
          if (!uid) continue;
          if (!lastActiveMap[uid] || m.created_at > lastActiveMap[uid]) {
            lastActiveMap[uid] = m.created_at;
          }
        }
      }
    }

    // Count manual_components per user
    const { data: components } = await admin
      .from("manual_components")
      .select("user_id")
      .in("user_id", userIds);

    const compCounts: Record<string, number> = {};
    if (components) {
      for (const c of components) {
        compCounts[c.user_id] = (compCounts[c.user_id] || 0) + 1;
      }
    }

    const users = allProfiles.map((p) => ({
      id: p.id,
      display_name: p.display_name || null,
      email: emailMap[p.id] || "",
      conversation_count: convCounts[p.id] || 0,
      component_count: compCounts[p.id] || 0,
      is_anonymous: anonMap[p.id] || false,
      created_at: createdMap[p.id] || "",
      last_active: lastActiveMap[p.id] || null,
      last_conversation_at: lastConvAtMap[p.id] || null,
    }));

    return Response.json({ users });
  } catch (err) {
    console.error("[admin/users] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
