import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function verifyAdmin(): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: "", isAdmin: false };

  const role = user.app_metadata?.role;
  return { userId: user.id, isAdmin: role === "admin" };
}

/**
 * Admin guard for API routes. Returns the service-role client and the
 * caller's user id on success, or a 403 Response on failure. Callers do:
 *
 *   const auth = await requireAdmin();
 *   if (auth instanceof Response) return auth;
 *   const { admin, userId } = auth;
 */
export async function requireAdmin(): Promise<
  { userId: string; admin: ReturnType<typeof createAdminClient> } | Response
> {
  const { userId, isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId, admin: createAdminClient() };
}
