import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: components }, { data: profile }] = await Promise.all([
    admin
      .from("manual_entries")
      .select("id, layer, type, name, content, created_at, updated_at")
      .eq("user_id", user.id)
      .order("layer", { ascending: true })
      .order("type", { ascending: true }),
    admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single(),
  ]);

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "User";

  return Response.json({ components: components || [], displayName });
}
