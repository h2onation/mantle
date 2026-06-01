import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordApiError } from "@/lib/observability/record-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  let capturedUserId: string | null = null;
  try {
    const auth = await requireUser();
    if (auth instanceof Response) return auth;
    const { user } = auth;
    capturedUserId = user.id;

    const admin = createAdminClient();

    const [
      { data: components, error: componentsError },
      { data: profile },
    ] = await Promise.all([
      admin
        .from("manual_entries")
        .select("id, layer, name, content, created_at, updated_at")
        .eq("user_id", user.id)
        .order("layer", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single(),
    ]);

    // The Supabase client returns { data, error } instead of throwing, so a
    // transient read failure on manual_entries would otherwise fall through to
    // `components || []` and return 200 with an EMPTY manual — which the client
    // stores and renders as "your manual is gone" (a data-loss scare). Fail
    // loudly so the client's `if (res.ok)` guard keeps the existing entries.
    // profile is intentionally left soft: display_name is cosmetic with
    // email/"User" fallbacks, so a profile read error shouldn't blank a manual.
    if (componentsError) {
      throw componentsError;
    }

    const displayName =
      profile?.display_name || user.email?.split("@")[0] || "User";

    return Response.json({ components: components || [], displayName });
  } catch (err) {
    await recordApiError({
      admin: createAdminClient(),
      route: "/api/manual",
      method: "GET",
      statusCode: 500,
      error: err,
      userId: capturedUserId,
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
