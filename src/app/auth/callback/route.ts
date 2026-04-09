import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailAllowlisted } from "@/lib/beta-allowlist";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Each OAuth callback exchanges its own code; never cache.
export const dynamic = "force-dynamic";

// Window for treating a user as "newly created during this callback".
// Email-confirmation flows can take longer, but the gate is double-checked
// at the email signup pre-check, so a generous window here only matters for
// OAuth — where the user is created in the same request.
const NEW_USER_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const redirectTo =
    next && next.startsWith("/") ? `${origin}${next}` : origin;

  // Build the redirect up front so the Supabase setAll callback can write
  // Set-Cookie headers onto it. Reuse the same response across all setAll
  // calls — recreating it would lose earlier cookies.
  const response = NextResponse.redirect(redirectTo);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  if (code) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            // Only the response matters here — this route immediately
            // redirects, so nothing downstream reads cookieStore.
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set({ name, value, ...options })
            );
          },
        },
      }
    );

    const { data: exchangeData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const errorRedirect = NextResponse.redirect(
        `${origin}/login?error=reset_link_expired`
      );
      errorRedirect.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );
      return errorRedirect;
    }

    // Beta access gate: if this exchange just created a brand-new user
    // (Google OAuth signup) and that user is not on the allowlist, delete
    // them and bounce to the early-access page. Returning users skip this
    // entirely so login is never affected.
    const user = exchangeData?.user;
    if (user?.email && user.created_at) {
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      const isNewUser = ageMs >= 0 && ageMs < NEW_USER_WINDOW_MS;

      if (isNewUser) {
        const allowed = await isEmailAllowlisted(user.email);
        if (!allowed) {
          // Remove the just-created auth row so the email is free to join
          // later via the waitlist, and so we don't accumulate orphaned
          // users from blocked OAuth attempts.
          try {
            const admin = createAdminClient();
            await admin.auth.admin.deleteUser(user.id);
          } catch (deleteErr) {
            console.error(
              "[auth/callback] failed to delete blocked user:",
              deleteErr instanceof Error ? deleteErr.message : "unknown"
            );
          }

          const blockedRedirect = NextResponse.redirect(
            `${origin}/waitlist?reason=not_allowlisted`
          );
          blockedRedirect.headers.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate"
          );
          // Clear any session cookies that exchangeCodeForSession just set,
          // so the bounced user is fully signed out.
          response.cookies.getAll().forEach((c) => {
            blockedRedirect.cookies.set({
              name: c.name,
              value: "",
              maxAge: 0,
              path: "/",
            });
          });
          return blockedRedirect;
        }
      }
    }
  }

  return response;
}
