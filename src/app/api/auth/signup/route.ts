import { createClient } from "@/lib/supabase/server";
import { isEmailAllowlisted, normalizeEmail } from "@/lib/beta-allowlist";

// Email/password signup gated by beta_allowlist. The actual auth.users row
// is only created if the email passes the allowlist check, so non-allowlisted
// emails never receive a confirmation email and never appear in auth.users.
//
// Google OAuth signup is gated separately in /auth/callback (it cannot be
// pre-checked because the user is created during exchangeCodeForSession).
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const allowed = await isEmailAllowlisted(normalized);
  if (!allowed) {
    return Response.json({ error: "not_allowlisted" }, { status: 403 });
  }

  const supabase = createClient();
  const origin = new URL(request.url).origin;

  const { error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    // Surface Supabase's message verbatim — it's already user-facing
    // (e.g. "Password should be at least 6 characters").
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
