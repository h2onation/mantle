export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionSummary } from "@/lib/sage/generate-summary";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = (await request.json()) as {
    conversationId: string;
  };

  const admin = createAdminClient();

  // Verify conversation belongs to this user
  const { data: conv } = await admin
    .from("conversations")
    .select("id, user_id, summary")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Mark as completed
  await admin
    .from("conversations")
    .update({ status: "completed" })
    .eq("id", conversationId);

  // Generate summary if missing
  if (!conv.summary) {
    await generateSessionSummary(conversationId, admin);
  }

  return Response.json({ ok: true });
}
