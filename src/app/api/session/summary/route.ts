export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";
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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    capturedUserId = user?.id ?? null;

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
      await recordApiError({
        admin,
        route: "/api/session/summary",
        method: "POST",
        statusCode: 500,
        error: new Error("generateSessionSummary returned null"),
        userId: capturedUserId,
      });
      return Response.json({ error: "Failed to generate summary" }, { status: 500 });
    }

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
