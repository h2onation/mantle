import { NextResponse } from "next/server";
import { createServerClient, type CookieMethods } from "@supabase/ssr";
import { cookies } from "next/headers";

// Prevent any edge/CDN caching of this route — each OAuth callback
// must exchange its own unique code and set its own session cookies.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const redirectTo = next && next.startsWith("/")
    ? `${origin}${next}`
    : origin;

  const response = NextResponse.redirect(redirectTo);
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  if (code) {
    const cookieStore = cookies();

    // Create a Supabase client that writes cookies to BOTH the
    // cookieStore (for downstream server components) and the
    // redirect response (so the browser receives them).
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: "", ...options });
            response.cookies.set({ name, value: "", ...options });
          },
        } as CookieMethods,
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
