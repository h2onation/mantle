import { createClient } from "@/lib/supabase/server";

export async function verifyAdmin(): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: "", isAdmin: false };

  const role = user.app_metadata?.role;
  return { userId: user.id, isAdmin: role === "admin" };
}
