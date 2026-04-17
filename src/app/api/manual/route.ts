import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordApiError } from "@/lib/observability/record-api-error";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const admin = createAdminClient();

    const [{ data: components }, { data: profile }] = await Promise.all([
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
