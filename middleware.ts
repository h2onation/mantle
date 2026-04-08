import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Single response object that Supabase's setAll callback will mutate
  // by writing cookies onto. Recreated only when request cookies change,
  // following the canonical Supabase pattern.
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies first so any downstream code that
          // reads cookies on this request sees the refreshed values.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recreate the response once with the updated request, then
          // copy every cookie onto it. Recreating per-cookie loses
          // earlier writes — that was the bug.
          supabaseResponse = NextResponse.next({
            request,
          });
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
  const isAdminRoute = pathname.startsWith("/api/admin");
  if (isAdminRoute) {
    const role = user?.app_metadata?.role;
    if (role !== "admin") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return supabaseResponse;
  }

  // Allow /login, /auth/callback, and other public routes through
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/auth/callback");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithSupabaseCookies(url, supabaseResponse);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithSupabaseCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}

// When middleware needs to redirect, the new response has no cookies on it
// by default. If Supabase refreshed the session inside getUser(), those
// refreshed cookies live on supabaseResponse — and would be silently dropped
// unless we copy them onto the redirect. Per Supabase's "advanced guide" this
// is the canonical fix for "user randomly logged out after redirect".
function redirectWithSupabaseCookies(
  url: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api(?!/admin)).*)",
  ],
};
