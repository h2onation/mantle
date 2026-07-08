import { requireAdmin } from "@/lib/admin/verify-admin";
import type { createAdminClient } from "@/lib/supabase/admin";
import { checkLimit, rateLimitedResponse, adminScoreHour } from "@/lib/rate-limit";
import { loadScoringRubric } from "@/lib/scoring/rubric";
import {
  buildNumberedTranscript,
  scoreTranscript,
  SCORING_MODEL,
} from "@/lib/scoring/score-conversation";

// Admin-only conversation scoring against the conductor rubric.
// POST { conversationId } — run one scoring pass (one Opus call) and store it.
// GET ?conversationId=…   — past scores for one conversation.
// GET ?view=trend         — recent scores + conductor-prompt edit timestamps
//                           (the Tuning-page chart's data).
// GET ?view=unscored      — completed, substantial, never-scored conversations
//                           (the batch button's work list).
//
// nodejs runtime: the rubric's code-default floor is a file read (rubric.ts).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One Opus call over a full transcript can run past a minute.
export const maxDuration = 120;

// A session needs enough turns to have an arc worth scoring. Below this the
// rubric's signals are undefined (no boundary turn, no shape to land).
const MIN_MESSAGES_TO_SCORE = 8;

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { userId, admin } = auth;

    const limit = await checkLimit(adminScoreHour, userId);
    if (!limit.success) return rateLimitedResponse(limit);

    const body = await request.json().catch(() => ({}));
    const conversationId = body?.conversationId;
    if (!conversationId || typeof conversationId !== "string") {
      return Response.json({ error: "conversationId is required" }, { status: 400 });
    }

    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .single();
    if (convError || !conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const { data: messages, error: msgError } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgError) {
      console.error("[admin/score] messages query error:", msgError);
      return Response.json({ error: "Failed to load messages" }, { status: 500 });
    }
    if (!messages || messages.length < MIN_MESSAGES_TO_SCORE) {
      return Response.json(
        { error: `Too short to score (needs ${MIN_MESSAGES_TO_SCORE}+ messages)` },
        { status: 400 },
      );
    }

    const rubric = await loadScoringRubric(admin);
    const transcript = buildNumberedTranscript(messages);

    let result;
    try {
      result = await scoreTranscript(rubric.text, transcript);
    } catch (err) {
      // Never echo transcript or model text — event type + id only.
      console.error(
        "[admin/score] scoring failed for conversation=%s: %s",
        conversationId,
        err instanceof Error ? err.message : "unknown",
      );
      return Response.json(
        { error: "Scoring run failed — try again" },
        { status: 502 },
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from("conversation_scores")
      .insert({
        conversation_id: conversationId,
        user_id: conversation.user_id,
        rubric_sha: rubric.sha,
        model: SCORING_MODEL,
        result,
      })
      .select("id, conversation_id, rubric_sha, model, result, created_at")
      .single();
    if (insertError || !inserted) {
      console.error("[admin/score] insert error:", insertError);
      return Response.json({ error: "Failed to store score" }, { status: 500 });
    }

    await admin.from("admin_access_logs").insert({
      admin_id: userId,
      target_user_id: conversation.user_id,
      conversation_id: conversationId,
      action: "score_conversation",
    });

    return Response.json({ score: inserted, rubricSource: rubric.source });
  } catch (err) {
    console.error("[admin/score] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const view = url.searchParams.get("view");

    if (conversationId) {
      const { data, error } = await admin
        .from("conversation_scores")
        .select("id, conversation_id, rubric_sha, model, result, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[admin/score] list error:", error);
        return Response.json({ error: "Failed to load scores" }, { status: 500 });
      }
      return Response.json({ scores: data ?? [] });
    }

    if (view === "trend") return trendView(admin);
    if (view === "unscored") return unscoredView(admin);

    return Response.json({ error: "conversationId or view is required" }, { status: 400 });
  } catch (err) {
    console.error("[admin/score] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Scores over time (newest 200) + conductor-prompt edit timestamps, so the
 *  chart can mark "the prompt changed here" against the score lines. */
async function trendView(admin: AdminClient) {
  const [scoresRes, editsRes] = await Promise.all([
    admin
      .from("conversation_scores")
      // conductor_prompt_sha is joined from the conversation (the prompt is a
      // property of the session, stamped when it ran — not of the scoring run,
      // which is why it lives there and not on this row, unlike rubric_sha).
      .select(
        "id, conversation_id, rubric_sha, result, created_at, conversations(conductor_prompt_sha)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("persona_voice_override_history")
      .select("created_at")
      .eq("key", "conductor_prompt")
      .order("created_at", { ascending: true }),
  ]);

  if (scoresRes.error) {
    console.error("[admin/score] trend error:", scoresRes.error);
    return Response.json({ error: "Failed to load trend" }, { status: 500 });
  }

  // Flatten the joined conductor_prompt_sha onto each score so the chart can
  // band the score lines by exact prompt version (null for pre-stamp sessions).
  // The embedded FK arrives as an object or a single-element array depending on
  // how PostgREST types the relationship — normalize both.
  const scores = (scoresRes.data ?? []).map((r: Record<string, unknown>) => {
    const { conversations, ...rest } = r;
    const conv = Array.isArray(conversations) ? conversations[0] : conversations;
    const sha = (conv as { conductor_prompt_sha?: string | null } | null)?.conductor_prompt_sha ?? null;
    return { ...rest, conductor_prompt_sha: sha };
  });

  return Response.json({
    // Oldest-first for the chart's time axis.
    scores: scores.reverse(),
    promptEdits: (editsRes.data ?? []).map((r: { created_at: string }) => r.created_at),
  });
}

/** Completed conversations with enough turns and no score yet — the batch
 *  button scores these one at a time from the client. Bounded to the newest
 *  100 completed sessions; anything older is reachable per-conversation. */
async function unscoredView(admin: AdminClient) {
  const { data: convs, error } = await admin
    .from("conversations")
    .select("id, user_id, summary, updated_at")
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[admin/score] unscored error:", error);
    return Response.json({ error: "Failed to load conversations" }, { status: 500 });
  }
  const candidates = convs ?? [];
  if (candidates.length === 0) return Response.json({ conversations: [] });

  const ids = candidates.map((c: { id: string }) => c.id);
  const { data: scored } = await admin
    .from("conversation_scores")
    .select("conversation_id")
    .in("conversation_id", ids);
  const scoredIds = new Set(
    (scored ?? []).map((s: { conversation_id: string }) => s.conversation_id),
  );

  const unscored = candidates.filter((c: { id: string }) => !scoredIds.has(c.id));
  const withCounts = await Promise.all(
    unscored.map(async (c: { id: string; user_id: string; summary: string | null; updated_at: string }) => {
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id);
      return { ...c, message_count: count ?? 0 };
    }),
  );

  return Response.json({
    conversations: withCounts.filter((c) => c.message_count >= MIN_MESSAGES_TO_SCORE),
  });
}
