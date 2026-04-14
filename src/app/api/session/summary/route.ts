export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionSummary } from "@/lib/persona/generate-summary";
import {
  sessionSummaryHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .select("id, user_id")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const summary = await generateSessionSummary(conversationId, admin);

  if (summary === null) {
    return Response.json({ error: "Failed to generate summary" }, { status: 500 });
  }

  return Response.json({ summary });
}
