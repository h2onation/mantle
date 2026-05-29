import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not put any logic between createServerClient and getUser().
  // Supabase docs warn this is the most common source of "users randomly
  // logged out" bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Block non-admin access to admin API routes
  if (pathname.startsWith("/api/admin")) {
    if (user?.app_metadata?.role !== "admin") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return supabaseResponse;
  }

  // Defensive guard: if Google ever lands an OAuth code on / instead of
  // /auth/callback (Supabase Redirect URL allowlist drift), forward it to
  // the real callback so the exchange runs instead of bouncing to /login.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/waitlist" ||
    pathname === "/sillygoose" ||
    pathname === "/sillygoose.html";

  // Logged-in users skip the public marketing root and the login page — send
  // them straight to the app at /app.
  if (user && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on app/page routes only. Exclusions:
    //   _next            — framework assets
    //   auth/callback    — its getUser() must not race exchangeCodeForSession
    //   opengraph-image  — generated metadata route (no file extension)
    //   api(?!/admin)    — API routes self-gate; only /api/admin is checked here
    //   .*\..*           — anything with a file extension: robots.txt,
    //                      sitemap.xml, manifest.webmanifest, sw.js, icons,
    //                      favicon.ico, *.png, *.vcf, etc. (public assets +
    //                      metadata files must stay reachable when logged out)
    "/((?!_next|auth/callback|opengraph-image|api(?!/admin)|.*\\..*).*)",
  ],
};
