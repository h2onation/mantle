export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { callPersona } from "@/lib/persona/call-persona";
import { recordApiError } from "@/lib/observability/record-api-error";
import { getModule } from "@/lib/modules";
import {
  chatAuthMinute,
  chatAuthDay,
  chatAnonMinute,
  chatAnonDay,
  checkLimits,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { checkDailyMessageLimit } from "@/lib/usage";
import { checkAnonCheckpointGate } from "@/lib/auth/anon-checkpoint-gate";

// One cap for every message. 16k covers pasted artifacts (text threads,
// email chains, journal entries — pasting works in any conversation since
// the Upload door was retired for the modules cutover); the per-day message
// limit and rate limiters bound abuse, so a mode-based dual cap earned
// nothing but branching.
const MAX_MESSAGE_LENGTH = 16000;

export async function POST(request: Request) {
  let capturedUserId: string | null = null;
  try {
    // 1. Authenticate
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const { message, conversationId, explorationContext, mode: requestedMode } = (await request.json()) as {
      message: string | null;
      conversationId: string | null;
      explorationContext?: {
        layerName: string;
        type: "entry" | "empty_layer" | "started_layer";
        name?: string;
        content: string;
      };
      mode?: string;
    };

    const admin = createAdminClient();

    // A NEW conversation must start inside an enabled module — the mode IS
    // the module slug, stamped on the row and on every entry saved from the
    // conversation. No fallback: with no valid module there is nothing to
    // file entries under. (Continuing an existing conversation ignores
    // requestedMode; the row already carries its module.)
    if (!conversationId) {
      const mod = requestedMode ? await getModule(admin, requestedMode) : null;
      if (!mod || !mod.enabled) {
        return Response.json(
          { error: "Invalid mode. Must be the slug of an enabled module." },
          { status: 400 }
        );
      }
    }

    // 1a. Ownership + mode. When continuing an existing conversation, verify
    // it belongs to the authenticated user BEFORE anything reads from or
    // writes to it. The admin client bypasses RLS, so this route-level check
    // is the only boundary — without it an authenticated user could pass
    // another user's conversationId and read their transcript into Jove's
    // context or write into their conversation. Sibling routes
    // (checkpoint/confirm, session/summary) already scope by user_id; this
    // route did not. Returns 404 (not 403) so a probing user can't
    // distinguish a foreign id from a missing one.
    if (conversationId) {
      const { data: convRow, error: convReadError } = await admin
        .from("conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();
      if (convReadError || !convRow || convRow.user_id !== user.id) {
        return Response.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
    }
    if (typeof message === "string" && message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        {
          error:
            "Message is too long. Please keep messages under 16,000 characters.",
        },
        { status: 400 }
      );
    }
    const isAnonymous = user.is_anonymous === true;

    // 1b. Anonymous conversion gate (Gate B) — shared with the compose route.
    // Runs before any rate limiter or Anthropic call so a converted-out
    // anonymous user never burns Upstash quota or API tokens.
    const anonBlock = await checkAnonCheckpointGate(admin, user);
    if (anonBlock) return Response.json(anonBlock);

    // 1c. Rate limit check (Upstash). Per-minute + per-day; both must pass.
    const limiters = isAnonymous
      ? [chatAnonMinute, chatAnonDay]
      : [chatAuthMinute, chatAuthDay];
    const limitResult = await checkLimits(limiters, user.id);
    if (!limitResult.success) {
      return rateLimitedResponse(limitResult);
    }

    // 1d. Per-user daily message cap (Postgres-backed). Counts authored
    // user messages on the current UTC day so a single user can't
    // runaway-spend Anthropic tokens. Skipped when `message === null` —
    // those calls are server-triggered module openers or post-confirm
    // emissions, neither of which add to the user's typed volume. See
    // src/lib/usage.ts for the layered relationship with Upstash.
    if (message !== null) {
      const dailyCheck = await checkDailyMessageLimit(admin, user.id);
      if (!dailyCheck.allowed) {
        return Response.json(
          {
            error: "daily_limit_reached",
            message: `You've reached today's message limit (${dailyCheck.limit}). It resets at midnight UTC.`,
            count: dailyCheck.count,
            limit: dailyCheck.limit,
          },
          { status: 429 },
        );
      }
    }

    // 2. Create or use existing conversation
    let convId: string = conversationId || "";
    if (!convId) {
      // Ensure profile exists (FK target for conversations)
      await admin
        .from("profiles")
        .upsert(
          { id: user.id, display_name: user.email?.split("@")[0] || "User" },
          { onConflict: "id", ignoreDuplicates: true }
        );

      const { data: conv, error: convError } = await admin
        .from("conversations")
        .insert({ user_id: user.id, mode: requestedMode })
        .select("id")
        .single();

      if (convError || !conv) {
        await recordApiError({
          admin,
          route: "/api/chat",
          method: "POST",
          statusCode: 500,
          error: convError ?? new Error("conversations.insert returned no row"),
          userId: capturedUserId,
        });
        return Response.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }
      convId = conv.id;
    }

    // 3. Stream response
    const stream = callPersona({
      conversationId: convId,
      userId: user.id,
      message,
      explorationContext,
    });

    // X-Conversation-Id is set so the client can capture the conversation
    // id immediately when the response arrives — BEFORE any stream events.
    // Without this, the client only learns the id from `message_complete`;
    // if the Anthropic call fails before that event fires, the client
    // retries with no conversation_id and the server creates a brand-new
    // conversation row. That was the root cause of the 8 ghost
    // conversations observed on 2026-05-25 during credit exhaustion.
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": convId,
      },
    });
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/chat",
      method: "POST",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
