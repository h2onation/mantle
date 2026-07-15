import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { readOverrideRows } from "@/lib/persona/voice-overrides";
import { resolveAppCopy, APP_COPY_DEFAULTS } from "@/lib/persona/app-copy";
import { getModules, toHomeModule } from "@/lib/modules";

// MainApp's on-mount bootstrap call. Returns two things:
//   1. completed — whether the user has cleared the SeedScreen consent gate
//      (the merged "what this is, and isn't" prose + age gate) for fresh beta
//      signups. The client fails open on error — a transient API failure must
//      not lock a logged-in beta user out of the app.
//   2. modules — ALL modules (each with its enabled flag), in display order,
//      as HomeModule slices (card copy + intro copy; never opener/prompt
//      material). Home renders the enabled ones as doors; the Manual shows
//      disabled modules' sections too. Read here, on
//      a client-side fetch, so Home reflects a live admin edit immediately.
//      (It used to be read in the /app server component, but that value gets
//      frozen by the browser/Router cache and never tracks later changes —
//      the bug this call fixes.)

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

  // Modules + onboarding/Home copy both use the service-role admin client
  // (those tables have no client-readable RLS). getModules fails safe to an
  // empty list (a blank module set is a real state); the copy resolver falls
  // back to the shipped defaults on any read error.
  const admin = createAdminClient();
  const modules = (await getModules(admin)).map(toHomeModule);

  let appCopy = APP_COPY_DEFAULTS;
  try {
    appCopy = resolveAppCopy(await readOverrideRows(admin));
  } catch {
    // keep defaults
  }

  return Response.json({ completed, modules, appCopy });
}
