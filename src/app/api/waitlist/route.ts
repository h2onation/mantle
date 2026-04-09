import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/beta-allowlist";
import {
  waitlistSubmitHour,
  checkLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

// Maximum length for the freeform "what brought you here" field. Keeps
// payloads bounded and prevents anyone using the waitlist as free storage.
const MAX_SOURCE_LENGTH = 500;
const MAX_EMAIL_LENGTH = 320; // RFC 5321 upper bound

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isValidEmail(email: string): boolean {
  // Pragmatic check — Postgres won't validate format, and we'd rather catch
  // obvious junk before hitting the DB. Anything stricter rejects valid
  // edge-case addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  // 1. Rate limit by IP. Public endpoint with no auth — this is the only gate.
  const ip = getClientIp(request);
  const limit = await checkLimit(waitlistSubmitHour, ip);
  if (!limit.success) {
    return rateLimitedResponse(limit);
  }

  // 2. Parse + validate body.
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { email, source } = body;
  if (typeof email !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (source !== undefined && source !== null && typeof source !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !isValidEmail(normalized)
  ) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const trimmedSource =
    typeof source === "string" ? source.trim().slice(0, MAX_SOURCE_LENGTH) : null;
  const sourceValue = trimmedSource && trimmedSource.length > 0 ? trimmedSource : null;

  // 3. Dedupe + insert via admin client. The waitlist table has no anon
  // SELECT policy (deliberate, to prevent enumeration), so the dedupe check
  // and the insert both run server-side with the service role.
  const admin = createAdminClient();

  const { data: existing, error: lookupErr } = await admin
    .from("waitlist")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (lookupErr) {
    console.error("[waitlist] lookup error:", lookupErr.message);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  if (existing) {
    return Response.json({ ok: true, status: "already_listed" });
  }

  const { error: insertErr } = await admin.from("waitlist").insert({
    email: normalized,
    source: sourceValue,
    // status defaults to 'waiting' in the schema; we don't trust client input.
  });

  if (insertErr) {
    // 23505 = unique_violation. Race condition between the lookup and the
    // insert — treat as already listed rather than surfacing a 500.
    if ((insertErr as { code?: string }).code === "23505") {
      return Response.json({ ok: true, status: "already_listed" });
    }
    console.error("[waitlist] insert error:", insertErr.message);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  return Response.json({ ok: true, status: "added" });
}
