export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadConversationContext,
  resolveReflectionMeter,
} from "@/lib/persona/persona-pipeline";

/**
 * Restore the reflection meter from a conversation's persisted state. The
 * meter is otherwise driven only by live `message_complete` SSE events, so it
 * starts blank on a page refresh, a drawer switch, or a simulator-generated
 * conversation (those land via DB reload, not a live stream). The client calls
 * this when a conversation opens to rehydrate `{ depth, ready }`.
 *
 * Derives the SAME values the live path emits — fill from the stored extraction
 * state's depth, `ready` from Jove's published landed signal — via the shared
 * resolveReflectionMeter, so there is no second readiness formula to drift.
 *
 * Returns:
 *   { reflectionMeter: { depth, ready } }  → render the meter
 *   { reflectionMeter: null }              → hide it (crisis or no extraction)
 *   { reflectionMeter: undefined }         → not the web surface; client leaves state as-is
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return Response.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Ownership. 404 (not 403) so a probing user can't distinguish a foreign id
  // from a missing one — matches the other checkpoint routes.
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv || conv.user_id !== user.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const ctx = await loadConversationContext(
    admin,
    conversationId,
    user.id,
    "web"
  );

  // The context resolution is the single authority on whether the meter is
  // active for this turn — under the conductor (the live web voice) it's on;
  // it resolves the same way the live SSE path does, so restore can't drift.
  if (!ctx.reflectionMeterEnabled) {
    return Response.json({ reflectionMeter: undefined });
  }

  // Same ONE resolution the live SSE path uses (resolveReflectionMeter) — no
  // second readiness formula to drift.
  const reflectionMeter = resolveReflectionMeter({
    extraction: ctx.previousExtraction,
    turnsSinceCheckpoint: ctx.turnsSinceCheckpoint,
    cooldownTurns: ctx.checkpointTuning.cooldownTurns,
    reflectionLanded: ctx.reflectionLanded,
  });

  return Response.json({ reflectionMeter });
}
