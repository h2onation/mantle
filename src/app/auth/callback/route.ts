import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Prevent any edge/CDN caching of this route — each OAuth callback
// must exchange its own unique code and set its own session cookies.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
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

    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      const nextRedirect = NextResponse.redirect(`${origin}${next}`);
      nextRedirect.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );
      return nextRedirect;
    }
  }

  const redirect = NextResponse.redirect(origin);
  redirect.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  return redirect;
}
