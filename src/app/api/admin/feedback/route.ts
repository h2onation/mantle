import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Get auth users for email mapping
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) {
      console.error("[admin/feedback] Auth list error:", authError);
      return Response.json({ error: "Failed to list users" }, { status: 500 });
    }

    const emailMap: Record<string, string> = {};
    for (const u of authData.users) {
      emailMap[u.id] = u.email || "";
    }

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
