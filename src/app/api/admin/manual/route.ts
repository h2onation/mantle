import { requireAdmin } from "@/lib/admin/verify-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { userId, admin } = auth;

    const body = await request.json();
    const targetUserId = body.userId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const { data: components, error } = await admin
      .from("manual_entries")
      .select("id, layer, section, name, content, created_at")
      .eq("user_id", targetUserId)
      .order("layer", { ascending: true });

    if (error) {
      console.error("[admin/manual] Query error:", error);
      return Response.json({ error: "Failed to load manual" }, { status: 500 });
    }

    // Log access
    await admin.from("admin_access_logs").insert({
      admin_id: userId,
      target_user_id: targetUserId,
      action: "view_manual",
    });

    return Response.json({ components: components || [] });
  } catch (err) {
    console.error("[admin/manual] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
