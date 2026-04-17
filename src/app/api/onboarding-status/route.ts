import { createClient } from "@/lib/supabase/server";

// Returns whether the authenticated user has completed onboarding.
// Used by MainApp on mount to gate the app behind the InfoScreens +
// SeedScreen disclaimers for fresh beta signups. The client fails
// open on error — a transient API failure must not lock a logged-in
// beta user out of the app.

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

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

  return Response.json({ completed });
}
