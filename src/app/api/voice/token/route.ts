export const runtime = "edge";

import { requireUser } from "@/lib/auth/require-user";

export async function POST() {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;

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
