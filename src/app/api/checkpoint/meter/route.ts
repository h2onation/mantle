export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadConversationContext,
  applyCheckpointGates,
  reflectionMeterFill,
} from "@/lib/persona/persona-pipeline";
import { getFeatureGates } from "@/lib/persona/feature-gates";

/**
 * Restore the reflection meter from a conversation's persisted state. The
 * meter is otherwise driven only by live `message_complete` SSE events, so it
 * starts blank on a page refresh, a drawer switch, or a simulator-generated
 * conversation (those land via DB reload, not a live stream). The client calls
 * this when a conversation opens to rehydrate `{ depth, ready }`.
 *
 * Derives the SAME values the live path emits — `depth` from the stored
 * extraction state, `ready` from `applyCheckpointGates` over the same inputs
 * `call-persona` uses — so there is no second readiness formula to drift.
 *
 * Returns:
 *   { reflectionMeter: { depth, ready } }  → render the meter
 *   { reflectionMeter: null }              → hide it (crisis or no extraction)
 *   { reflectionMeter: undefined }         → gate off; client leaves state as-is
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

  // Cheap short-circuit when the feature is off (the common case while the
  // gate is OFF) — avoids the heavier context load for every conversation open.
  const gates = await getFeatureGates(admin);
  if (!gates.reflectionMeter) {
    return Response.json({ reflectionMeter: undefined });
  }

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

  const ctx = await loadConversationContext(admin, conversationId, user.id);
  const ext = ctx.previousExtraction;

  const crisis =
    ext?.clinical_flag?.active === true && ext.clinical_flag.level === "crisis";

  let reflectionMeter: {
    fill: number;
    ready: boolean;
  } | null;
  if (!ext || crisis) {
    reflectionMeter = null;
  } else {
    const ready = applyCheckpointGates(
      ctx.turnsSinceCheckpoint,
      ext,
      ctx.isFirstCheckpoint,
      ctx.turnCount,
      ctx.checkpointTuning
    ).passed;
    reflectionMeter = {
      fill: reflectionMeterFill(
        ext.depth,
        ctx.turnsSinceCheckpoint,
        ready,
        ctx.checkpointTuning.cooldownTurns
      ),
      ready,
    };
  }

  return Response.json({ reflectionMeter });
}
