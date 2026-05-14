export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSessionSummary } from "@/lib/persona/generate-summary";
import {
  sessionSummaryHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { recordApiError } from "@/lib/observability/record-api-error";

export async function POST(request: Request) {
  let capturedUserId: string | null = null;
  try {
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

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

    // null means either no messages (expected for new conversations) or
    // a transient Anthropic failure. Either way the client treats a
    // missing summary gracefully — don't pollute the error dashboard.
    return Response.json({ summary });
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/session/summary",
      method: "POST",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
