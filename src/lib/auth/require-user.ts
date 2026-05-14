import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

export type RequireUserResult = {
  user: User;
  supabase: SupabaseServerClient;
};

type RequireUserOptions = {
  // Body emitted as `{ error: <string> }` on the 401 branch.
  // Defaults to "Unauthorized". Use "unauthenticated" for routes
  // that historically used the lowercase code.
  errorMessage?: string;
  // Fires before the 401 Response is returned. Use for fire-and-forget
  // telemetry that must observe the unauthorized branch (e.g. logEvent).
  // Sync — the helper does not await the callback.
  onUnauthorized?: () => void;
};

export async function requireUser(
  opts: RequireUserOptions = {}
): Promise<RequireUserResult | Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    opts.onUnauthorized?.();
    return Response.json(
      { error: opts.errorMessage ?? "Unauthorized" },
      { status: 401 }
    );
  }

  return { user, supabase };
}
