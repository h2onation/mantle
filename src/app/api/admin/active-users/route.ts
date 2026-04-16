// Admin-only endpoint: who's in the beta, who's signed in, when they
// were last active. Beta Health panel part 2 of 3. No new table —
// joins beta_allowlist with auth.users.
//
// Privacy: email is the only PII returned. Admin already sees emails
// in the Users and Feedback tabs; surfacing them here is no new
// exposure. auth user_id included for future deep-link use.

import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Parallel fetch: allowlist + auth users. listUsers default 50/page
    // would silently truncate, so bump to 1000 to match /api/admin/beta-feedback.
    const [
      { data: allowlist, error: allowlistError },
      { data: authData, error: authError },
    ] = await Promise.all([
      admin
        .from("beta_allowlist")
        .select("email, created_at")
        .order("created_at", { ascending: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (allowlistError) {
      console.error("[admin/active-users] allowlist error:", allowlistError.message);
      return Response.json(
        { error: "Failed to load allowlist" },
        { status: 500 }
      );
    }
    if (authError) {
      console.error("[admin/active-users] auth list error:", authError.message);
      return Response.json({ error: "Failed to list users" }, { status: 500 });
    }

    // email → auth user lookup. Emails from auth.users are already stored
    // lowercased by Supabase; beta_allowlist emails are lowercased by the
    // POST handler. Normalize both sides anyway for safety.
    const authByEmail = new Map<string, (typeof authData.users)[number]>();
    for (const u of authData.users) {
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
