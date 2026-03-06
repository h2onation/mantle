import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=reset_link_expired`
      );
    }

    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(origin);
}
