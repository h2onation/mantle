import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Email map for the user_id → email join. listUsers' default 50/page
    // would silently truncate, hence perPage 1000.
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) {
      console.error("[admin/beta-feedback] auth list error:", authError.message);
      return Response.json({ error: "Failed to list users" }, { status: 500 });
    }

    const emailMap: Record<string, string> = {};
    for (const u of authData.users) {
      emailMap[u.id] = u.email || "";
    }

    const { data: rows, error } = await admin
      .from("beta_feedback")
      .select("id, user_id, page_context, feedback_text, is_read, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/beta-feedback] fetch error:", error.message);
      return Response.json({ error: "Failed to load" }, { status: 500 });
    }

    const items = (rows || []).map((row) => ({
      id: row.id,
      user_email: emailMap[row.user_id] || "Unknown",
      page_context: row.page_context,
      feedback_text: row.feedback_text,
      is_read: row.is_read,
      created_at: row.created_at,
    }));

    const unread_count = items.reduce((n, i) => (i.is_read ? n : n + 1), 0);

    return Response.json({ items, unread_count });
  } catch (err) {
    console.error("[admin/beta-feedback] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { id?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const { id } = body;
    if (typeof id !== "string" || !id) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("beta_feedback")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("[admin/beta-feedback] update error:", error.message);
      return Response.json({ error: "Failed to update" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/beta-feedback] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
