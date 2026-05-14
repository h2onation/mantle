export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionSummary } from "@/lib/persona/generate-summary";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

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
