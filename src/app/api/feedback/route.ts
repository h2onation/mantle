import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, sessionId } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("feedback").insert({
      user_id: user.id,
      message: message.trim(),
      session_id: sessionId || null,
    });

    if (error) {
      console.error("[feedback] Insert error:", error);
      return Response.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
