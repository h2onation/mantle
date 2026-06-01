export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionSummary } from "@/lib/persona/generate-summary";
import {
  sessionSummaryHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  // Rate limit: this route calls generateSessionSummary (Anthropic/Haiku) with
  // no other ceiling. Share the session-summary limiter with
  // /api/session/summary so the two routes can't be combined to bypass the cap.
  const limit = await checkLimit(sessionSummaryHour, user.id);
  if (!limit.success) {
    return rateLimitedResponse(limit);
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
