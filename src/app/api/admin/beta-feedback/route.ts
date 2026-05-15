import { requireAdmin } from "@/lib/admin/verify-admin";
import { listAllAuthUsers } from "@/lib/admin/list-auth-users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const { emailMap } = await listAllAuthUsers(admin);

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

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "missing_id" }, { status: 400 });
    }

    const { error } = await admin.from("beta_feedback").delete().eq("id", id);

    if (error) {
      console.error("[admin/beta-feedback] delete error:", error.message);
      return Response.json({ error: "Failed to delete" }, { status: 500 });
    }

    return Response.json({ result: "deleted" });
  } catch (err) {
    console.error("[admin/beta-feedback] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

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
