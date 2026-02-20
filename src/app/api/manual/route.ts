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

  const { data: components } = await admin
    .from("manual_components")
    .select("id, layer, type, name, content, created_at, updated_at")
    .eq("user_id", user.id)
    .order("layer", { ascending: true })
    .order("type", { ascending: true });

  const items = components || [];

  const gateReached =
    [1, 2, 3].every((layer) =>
      items.some((c) => c.layer === layer && c.type === "component")
    );

  return Response.json({ components: items, gateReached });
}
