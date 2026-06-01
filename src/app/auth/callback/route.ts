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

  // Returning users land in the app. Password-reset and other flows pass an
  // explicit `next` (e.g. /reset-password) which we honor.
  const redirectTo =
    next && next.startsWith("/") ? `${origin}${next}` : `${origin}/app`;

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

    // Beta access gate. Re-check the allowlist on EVERY OAuth callback, not
    // just within a 60s "new user" window. The window used to gate the whole
    // check, so a non-allowlisted user whose auth row survived a failed delete
    // could log in cleanly on a later retry once their account aged past 60s —
    // there is no other allowlist enforcement downstream. Checking every time
    // closes that hole. (isEmailAllowlisted itself fails closed on a lookup
    // error, so a DB hiccup blocks rather than admits.)
    const user = exchangeData?.user;
    if (user?.email) {
      const allowed = await isEmailAllowlisted(user.email);
      if (!allowed) {
        // Only delete a row we just created (within the window). An older,
        // established account that somehow isn't allowlisted gets blocked but
        // NOT deleted — we never destroy a real user's data here.
        const ageMs = user.created_at
          ? Date.now() - new Date(user.created_at).getTime()
          : Infinity;
        const isFreshlyCreated = ageMs >= 0 && ageMs < NEW_USER_WINDOW_MS;
        if (isFreshlyCreated) {
          // Remove the just-created auth row so the email is free to join
          // later via the waitlist, and so we don't accumulate orphaned users
          // from blocked OAuth attempts.
          try {
            const admin = createAdminClient();
            await admin.auth.admin.deleteUser(user.id);
          } catch (deleteErr) {
            console.error(
              "[auth/callback] failed to delete blocked user:",
              deleteErr instanceof Error ? deleteErr.message : "unknown"
            );
            // Fall through and still block: the allowlist re-check above runs
            // on every callback, so a surviving row can never be admitted.
          }
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

  return response;
}
