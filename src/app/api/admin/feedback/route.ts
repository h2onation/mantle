import { requireAdmin } from "@/lib/admin/verify-admin";
import { listAllAuthUsers } from "@/lib/admin/list-auth-users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const { emailMap } = await listAllAuthUsers(admin);

    // Fetch all feedback, newest first
    const { data: feedbackRows, error: feedbackError } = await admin
      .from("feedback")
      .select("id, user_id, message, session_id, created_at")
      .order("created_at", { ascending: false });

    if (feedbackError) {
      console.error("[admin/feedback] Fetch error:", feedbackError);
      return Response.json({ error: "Failed to load feedback" }, { status: 500 });
    }

    const feedback = (feedbackRows || []).map((row) => ({
      id: row.id,
      user_email: emailMap[row.user_id] || "Guest",
      message: row.message,
      session_id: row.session_id,
      created_at: row.created_at,
    }));

    return Response.json({ feedback });
  } catch (err) {
    console.error("[admin/feedback] Unexpected error:", err);
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

    const { error } = await admin.from("feedback").delete().eq("id", id);

    if (error) {
      console.error("[admin/feedback] delete error:", error.message);
      return Response.json({ error: "Failed to delete" }, { status: 500 });
    }

    return Response.json({ result: "deleted" });
  } catch (err) {
    console.error("[admin/feedback] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
