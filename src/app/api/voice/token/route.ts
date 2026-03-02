export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

export async function POST() {
  // Verify auth
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Voice input not configured" },
      { status: 503 }
    );
  }

  // Return the API key directly — route is auth-protected so only
  // logged-in users can access it. Temp token generation requires
  // admin-tier Deepgram permissions not available on all plans.
  return Response.json({ key: apiKey });
}
