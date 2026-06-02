// Admin-only endpoint: who's in the beta, who's signed in, when they
// were last active. Beta Health panel part 2 of 3. No new table —
// joins invited waitlist rows (status='invited' === beta access) with
// auth.users.
//
// Privacy: email is the only PII returned. Admin already sees emails
// in the Users and Feedback tabs; surfacing them here is no new
// exposure. auth user_id included for future deep-link use.

import { requireAdmin } from "@/lib/admin/verify-admin";
import { listAllAuthUsers } from "@/lib/admin/list-auth-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BetaUser {
  email: string;
  user_id: string | null;
  allowlisted_at: string;
  signed_in_ever: boolean;
  last_sign_in_at: string | null;
}

interface ActiveUsersSummary {
  total_allowlisted: number;
  ever_signed_in: number;
  active_last_24h: number;
  active_last_7d: number;
}

interface ActiveUsersResponse {
  summary: ActiveUsersSummary;
  users: BetaUser[];
  checkedAt: string;
}

export async function GET(): Promise<Response> {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    // Parallel fetch: invited waitlist rows + auth users.
    const [
      { data: allowlist, error: allowlistError },
      authResult,
    ] = await Promise.all([
      admin
        .from("waitlist")
        .select("email, created_at")
        .eq("status", "invited")
        .order("created_at", { ascending: false }),
      listAllAuthUsers(admin),
    ]);

    if (allowlistError) {
      console.error("[admin/active-users] allowlist error:", allowlistError.message);
      return Response.json(
        { error: "Failed to load allowlist" },
        { status: 500 }
      );
    }

    // email → auth user lookup. Emails from auth.users are already stored
    // lowercased by Supabase; waitlist emails are lowercased on insert.
    // Normalize both sides anyway for safety.
    const authByEmail = new Map<string, (typeof authResult.users)[number]>();
    for (const u of authResult.users) {
      if (u.email) authByEmail.set(u.email.toLowerCase(), u);
    }

    const users: BetaUser[] = (allowlist ?? []).map((entry) => {
      const authUser = authByEmail.get(entry.email.toLowerCase());
      return {
        email: entry.email,
        user_id: authUser?.id ?? null,
        allowlisted_at: entry.created_at,
        signed_in_ever: !!authUser?.last_sign_in_at,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      };
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const summary: ActiveUsersSummary = {
      total_allowlisted: users.length,
      ever_signed_in: users.filter((u) => u.signed_in_ever).length,
      active_last_24h: users.filter(
        (u) =>
          u.last_sign_in_at &&
          now - new Date(u.last_sign_in_at).getTime() < DAY_MS
      ).length,
      active_last_7d: users.filter(
        (u) =>
          u.last_sign_in_at &&
          now - new Date(u.last_sign_in_at).getTime() < 7 * DAY_MS
      ).length,
    };

    const response: ActiveUsersResponse = {
      summary,
      users,
      checkedAt: new Date().toISOString(),
    };

    return Response.json(response);
  } catch (err) {
    console.error("[admin/active-users] unexpected error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
