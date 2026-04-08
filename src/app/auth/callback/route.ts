import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Prevent any edge/CDN caching of this route — each OAuth callback
// must exchange its own unique code and set its own session cookies.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const redirectTo =
    next && next.startsWith("/") ? `${origin}${next}` : origin;

  // Create the redirect response up front so the Supabase setAll callback
  // can write Set-Cookie headers onto it. The response object is reused
  // across all setAll calls — recreating it would lose earlier cookies.
  const response = NextResponse.redirect(redirectTo);
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  // Diagnostic logging for the OAuth double-login bug — no PII, only
  // shapes and counts. Safe to ship.
  const incomingCookieNames = cookies()
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-"));
  console.log(
    "[auth/callback] start",
    JSON.stringify({
      hasCode: !!code,
      hasNext: !!next,
      sbCookieCount: incomingCookieNames.length,
      hasVerifier: incomingCookieNames.some((n) =>
        n.includes("code-verifier")
      ),
      hasAuthToken: incomingCookieNames.some((n) =>
        n.includes("auth-token")
      ),
    })
  );

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
            cookiesToSet.forEach(({ name, value, options }) => {
              // Write to the cookieStore so any downstream Server
              // Component reading cookies on this request sees the
              // refreshed values.
              try {
                cookieStore.set({ name, value, ...options });
              } catch {
                // Server Components can't write cookies — ignore.
              }
              // Write to the redirect response so the browser actually
              // receives the Set-Cookie headers.
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    console.log(
      "[auth/callback] exchange",
      JSON.stringify({
        ok: !error,
        errorName: error?.name ?? null,
        errorStatus: (error as { status?: number } | null)?.status ?? null,
        responseCookieCount: response.cookies.getAll().length,
      })
    );

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
  }

  return response;
}
