import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cache the admin client across calls. The client uses the service role
// key with no per-user auth state, no session refresh, and no realtime
// subscription, so a single instance is safe to share across requests on
// a warm Edge instance. Saves a Supabase constructor call on every API
// route + webhook invocation.
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  return cached;
}
