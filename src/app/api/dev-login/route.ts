export const runtime = "edge";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find the target user
  let email = process.env.DEV_USER_EMAIL;

  if (!email) {
    // No env var — grab the first user from auth.users
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (error || !data.users.length) {
      return Response.json(
        { error: "No users found in auth.users" },
        { status: 404 }
      );
    }
    email = data.users[0].email;
  }

  if (!email) {
    return Response.json(
      { error: "Could not determine user email" },
      { status: 500 }
    );
  }

  // Generate a magic link — we won't redirect, we'll verify server-side
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData.properties?.hashed_token) {
    return Response.json(
      { error: linkError?.message || "Failed to generate link" },
      { status: 500 }
    );
  }

  // Verify the token server-side to get session tokens
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    }),
  });

  if (!verifyRes.ok) {
    const text = await verifyRes.text();
    return Response.json(
      { error: `Verify failed: ${text}` },
      { status: 500 }
    );
  }

  const session = await verifyRes.json();

  // Set auth cookies directly so the middleware/server client picks them up
  const projectRef = "nkmperzwcmttdkxwhbiv";
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  });

  // Supabase SSR chunks cookies at 3180 chars.
  // Important: encode the full value FIRST, then chunk the encoded string.
  // This matches how @supabase/ssr's createChunks() works. Chunking raw JSON
  // then encoding each chunk individually causes combineChunks() to fail.
  const CHUNK_SIZE = 3180;
  const encoded = encodeURIComponent(cookieValue);
  const headers = new Headers({ "Content-Type": "application/json" });

  if (encoded.length <= CHUNK_SIZE) {
    headers.append(
      "Set-Cookie",
      `${cookieName}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
    );
  } else {
    const chunks = Math.ceil(encoded.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      const chunk = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      headers.append(
        "Set-Cookie",
        `${cookieName}.${i}=${chunk}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
      );
    }
  }

  return new Response(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      email,
    }),
    { status: 200, headers }
  );
}
