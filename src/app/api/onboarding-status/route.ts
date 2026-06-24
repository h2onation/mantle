import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureGates } from "@/lib/persona/feature-gates";
import type { ConversationMode } from "@/lib/persona/config";

// MainApp's on-mount bootstrap call. Returns two things:
//   1. completed — whether the user has cleared the SeedScreen consent gate
//      (the merged "what this is, and isn't" prose + age gate) for fresh beta
//      signups. The client fails open on error — a transient API failure must
//      not lock a logged-in beta user out of the app.
//   2. enabledModes — which entry doors are live (the per-mode conversation
//      gates). Read here, on a client-side fetch, so the Home doors reflect a
//      live admin gate flip. (It used to be read in the /app server component,
//      but that value gets frozen by the browser/Router cache and never tracks
//      later flips — the bug this call fixes.) All three modes are gate-backed
//      at the door; the engine still keeps Situation as its ultimate fallback
//      so a conversation is never left mode-less (see resolveConversationMode).

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser({ errorMessage: "unauthenticated" });
  if (auth instanceof Response) return auth;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[onboarding-status] query error:", error);
    return Response.json({ error: "query_failed" }, { status: 500 });
  }

  // Defensive: a user with no profile row at all is treated as
  // needs-onboarding. The signup trigger should always create one,
  // but this covers any edge case where the trigger ran late.
  const completed = !!data?.onboarding_completed_at;

  // Per-mode gates use the service-role admin client (the table has no
  // client-readable RLS). getFeatureGates fails open to all-ON.
  const gates = await getFeatureGates(createAdminClient());
  const enabledModes: Record<ConversationMode, boolean> = {
    situation: gates.situation,
    "guided-intake": gates.guidedIntake,
    upload: gates.upload,
  };

  return Response.json({ completed, enabledModes });
}
