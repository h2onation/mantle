import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.app_metadata?.role;
      setIsAdmin(role === "admin");
    });
  }, []);

  return isAdmin;
}
