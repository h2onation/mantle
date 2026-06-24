export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadConversationContext,
  buildCheckpointMeta,
} from "@/lib/persona/persona-pipeline";
import { composeManualEntry } from "@/lib/persona/confirm-checkpoint";
import { getFeatureGates } from "@/lib/persona/feature-gates";
import {
  reflectionComposeHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { hashUserId, logEvent } from "@/lib/observability/log";
import { checkAnonCheckpointGate } from "@/lib/auth/anon-checkpoint-gate";

/**
 * User-pulled Reflection composition. The client calls this when the user
 * taps "Build this reflection" (or the deferred top strip). It composes the
 * entry on demand by reusing `composeManualEntry` — no Jove turn, no
 * transition line — and writes the SAME `is_checkpoint` message row the
 * Jove-pushed path writes, so the existing `/api/checkpoint/confirm` route,
 * the review overlay, and reload-resume all work unchanged.
 *
 * Only reachable when the `reflection_meter` feature gate is on.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  // 1. Authenticate.
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const userIdHash = await hashUserId(user.id);

  const { conversationId } = (await request.json()) as {
    conversationId?: string;
  };
  if (!conversationId) {
    return Response.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Feature gate — this endpoint only exists under the reflection meter.
  //    Fails closed (the gate defaults OFF), so it's inert until enabled.
  const gates = await getFeatureGates(admin);
  if (!gates.reflectionMeter) {
    return Response.json(
      { error: "Reflection meter is not enabled" },
      { status: 400 }
    );
  }

  // 3. Ownership. The admin client bypasses RLS, so this is the only
  //    boundary. 404 (not 403) so a probing user can't distinguish a foreign
  //    id from a missing one — matches the chat route.
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv || conv.user_id !== user.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // 4. Anonymous conversion gate (shared with /api/chat) — before the rate
  //    limiter or any Opus call, so a converted-out anonymous user never burns
  //    quota or tokens.
  const anonBlock = await checkAnonCheckpointGate(admin, user);
  if (anonBlock) return Response.json(anonBlock);

  // 5. Rate limit (this triggers an Opus composition).
  const limit = await checkLimit(reflectionComposeHour, user.id);
  if (!limit.success) return rateLimitedResponse(limit);

  // 5b. Idempotency. If the last message is already a pending reflection (a
  //     double-tap, or a retry after a flaky network where the first compose
  //     actually succeeded), return THAT one instead of composing a duplicate
  //     row and burning a second Opus call. The client re-opens the same
  //     overlay; confirm is idempotent on the message id either way.
  const { data: lastMsg } = await admin
    .from("messages")
    .select("id, content, is_checkpoint, checkpoint_meta")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMeta = lastMsg?.checkpoint_meta as {
    status?: string;
    section?: string | null;
    tags?: string[];
    name?: string | null;
    composed_name?: string | null;
    composed_content?: string | null;
  } | null;
  if (lastMsg?.is_checkpoint && lastMeta?.status === "pending") {
    return Response.json({
      messageId: lastMsg.id,
      reused: true,
      checkpoint: {
        isCheckpoint: true,
        section: lastMeta.section ?? null,
        tags: lastMeta.tags ?? [],
        name: lastMeta.composed_name ?? lastMeta.name ?? null,
        refinement_count: 0,
        composed_content: lastMeta.composed_content ?? lastMsg.content,
      },
    });
  }

  // 6. Load context and compose on demand. No `checkpointText` — the
  //    user-pulled path has no Jove draft to polish, so the composer composes
  //    from the (50-message-widened) conversation + the accumulated
  //    understanding carried in via depth / sageBrief / currentThread.
  const ctx = await loadConversationContext(admin, conversationId, user.id);
  const ext = ctx.previousExtraction;

  const composeStart = Date.now();
  const composed = await composeManualEntry({
    conversationHistory: ctx.messages,
    languageBank: ext?.language_bank || [],
    manualComponents: ctx.manualComponents || [],
    distinctContexts: ext?.checkpoint_gate?.distinct_contexts ?? null,
    depth: ext?.depth ?? null,
    sageBrief: ext?.sage_brief ?? null,
    currentThread: ext?.current_thread ?? null,
  });

  logEvent({
    event: "composition_latency",
    user_id_hash: userIdHash,
    conversation_id: conversationId,
    duration_ms: Date.now() - composeStart,
    manual_entry_count: ctx.manualComponents?.length ?? 0,
  });

  // composeManualEntry returns null on failure or an invalid layer — surface
  // a retryable error rather than writing a malformed row. The client keeps
  // the meter full + the strip so the user can re-tap.
  if (!composed) {
    return Response.json({ error: "compose_failed" }, { status: 502 });
  }

  // 7. Write the checkpoint row — same shape as the Jove path. `content`
  //    carries the composed entry so a history reload renders it; refinement
  //    chain starts fresh (a pull is a new chain).
  const { data: row, error: rowErr } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: composed.content,
      is_checkpoint: true,
      checkpoint_meta: buildCheckpointMeta(composed, 0),
    })
    .select("id")
    .single();

  if (rowErr || !row?.id) {
    return Response.json({ error: "row_write_failed" }, { status: 500 });
  }

  // 8. Return the checkpoint payload. The client builds an ActiveCheckpoint
  //    and opens the existing review overlay; confirm goes through the
  //    existing /api/checkpoint/confirm route unchanged.
  return Response.json({
    messageId: row.id,
    durationMs: Date.now() - startedAt,
    checkpoint: {
      isCheckpoint: true,
      section: composed.section,
      tags: composed.tags,
      name: composed.name,
      refinement_count: 0,
      composed_content: composed.content,
    },
  });
}
