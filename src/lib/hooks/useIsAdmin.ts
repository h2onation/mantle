import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Use getUser() (server-validated) instead of getSession() which
    // reads from cache and can return stale/wrong user data.
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.app_metadata?.role;
      setIsAdmin(role === "admin");
    });
  }, []);

  return isAdmin;
}
