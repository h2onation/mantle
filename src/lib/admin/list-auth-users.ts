import type { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

// listUsers' default 50/page silently truncates. Bumped to 1000 to cover
// current beta size; paginate here when beta exceeds 1000 users.
const ADMIN_USER_LIST_PAGE_SIZE = 1000;

/**
 * Lists all auth users and returns both the raw list and a userId→email map.
 * Several admin endpoints need both shapes; this centralizes the perPage
 * choice and the email-map construction.
 */
export async function listAllAuthUsers(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ users: User[]; emailMap: Record<string, string> }> {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: ADMIN_USER_LIST_PAGE_SIZE,
  });
  if (error) throw error;
  const emailMap: Record<string, string> = {};
  for (const u of data.users) {
    emailMap[u.id] = u.email || "";
  }
  return { users: data.users, emailMap };
}
