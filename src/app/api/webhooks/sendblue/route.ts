// Inbound webhook for Sendblue.
//
// Idempotency: Sendblue retries failed webhooks up to 3 times with a 45
// second per-attempt timeout. We dedupe on message_handle via the unique
// partial index on messaging_events (provider, provider_message_id).
//
// Return policy: respond 200 on every path that is not a genuinely
// transient infrastructure failure. A 5xx triggers a Sendblue retry, and
// we do not want retries for malformed payloads or post-dedup no-ops.
//
// Signature verification: not enabled yet. On first deploy we log the
// incoming header set so we can discover the exact header name Sendblue
// uses for SENDBLUE_WEBHOOK_SECRET. After the first real webhook lands and
// the header name is confirmed, this handler will verify the secret
// against process.env.SENDBLUE_WEBHOOK_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SendblueInboundWebhook } from "@/lib/messaging/sendblue";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Temporary: log the header set so we can confirm which header carries
  // the signing secret. Replace this block with signature verification
  // once the name is known. Header names are not sensitive — this logs
  // names and short sample values, not the full request body.
  const headerKeys = Array.from(req.headers.keys());
  console.log("[sendblue-webhook] header_keys=%j", headerKeys);

  let payload: SendblueInboundWebhook;
  try {
    payload = (await req.json()) as SendblueInboundWebhook;
  } catch (err) {
    console.error("[sendblue-webhook] invalid_json", {
      message: err instanceof Error ? err.message : String(err),
      details: err,
    });
    return NextResponse.json({ ok: false, reason: "invalid_json" });
  }

  console.log(
    "[sendblue-webhook] inbound handle=%s service=%s is_group=%s was_downgraded=%s",
    payload.message_handle,
    payload.service,
    payload.group_id ? "true" : "false",
    payload.was_downgraded
  );

  const admin = createAdminClient();

  // PII redaction (ADR-037): messaging_events.content is metadata-only.
  // Inbound user text is redacted to length before insert; raw payload is
  // dropped entirely because it contains the full message body.
  const contentLength = (payload.content ?? "").length;
  const redactedContent = `[USER_MSG len=${contentLength}]`;
  const redactedPayload = {
    message_handle: payload.message_handle,
    service: payload.service,
    message_type: payload.message_type,
    group_id: payload.group_id,
    was_downgraded: payload.was_downgraded,
    status: payload.status,
    error_code: payload.error_code,
    error_message: payload.error_message,
    content_length: contentLength,
  };

  // Idempotent insert. The unique partial index on
  // (provider, provider_message_id) rejects duplicates when Sendblue retries.
  const { error } = await admin.from("messaging_events").insert({
    direction: "inbound",
    provider: "sendblue",
    provider_message_id: payload.message_handle,
    from_number: payload.from_number,
    to_number: payload.to_number,
    content: redactedContent,
    status: payload.status,
    error_code: payload.error_code ? String(payload.error_code) : null,
    error_message: payload.error_message,
    was_downgraded: payload.was_downgraded,
    raw_payload: redactedPayload,
  });

  // 23505 = unique constraint violation = Sendblue retry of a message we
  // already stored. Expected; not an error.
  if (error && error.code !== "23505") {
    console.error("[sendblue-webhook] db_insert_failed", {
      code: error.code,
      message: error.message,
      details: error,
    });
    // Still 200: we logged the failure. A 5xx would trigger retries of a
    // payload the DB is unable to store — pointless.
  }

  // TODO (follow-up, once the secret header name is confirmed from logs):
  //   - Verify the header equals process.env.SENDBLUE_WEBHOOK_SECRET with a
  //     constant-time compare. Reject 401 on mismatch.
  //   - Route 1:1 inbound content to routeInboundMessage() in
  //     src/lib/linq/message-router.ts (or a renamed shared router) with a
  //     synthetic chat_id so Jove can process it.
  //   - Group inbound (payload.group_id present) is out of scope — groups
  //     remain on the Linq webhook path per decisions.md.

  return NextResponse.json({ ok: true });
}
