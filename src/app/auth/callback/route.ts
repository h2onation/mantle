import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Each OAuth callback exchanges its own code; never cache.
export const dynamic = "force-dynamic";

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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

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
