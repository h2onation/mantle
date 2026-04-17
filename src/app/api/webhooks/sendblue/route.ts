// Inbound webhook for Sendblue.
//
// Flow:
//   1. Read the raw body. We don't need it for signature verification
//      (Sendblue's auth is a shared-secret header, not an HMAC — see
//      ADR-039), but the one-read pattern keeps future HMAC support
//      cheap if Sendblue adds it.
//   2. Parse JSON — malformed → 200 {ok:false} (no audit, no routing).
//   3. Verify the sb-signing-secret header against SENDBLUE_WEBHOOK_SECRET.
//      Result is stamped into raw_payload.verified on every audit row.
//   4. Insert the primary audit row (content + raw_payload redacted per
//      ADR-037). Unique partial index on (provider, provider_message_id)
//      makes Sendblue's retries idempotent — 23505 short-circuits routing.
//   5. If verified === false → stop. Audited, not routed.
//   6. If group_id is non-empty → stop. Groups stay on the Linq facilitator
//      path per ADR-035. Audited, not routed.
//   7. Adapt the flat Sendblue payload to the router's InboundMessageData
//      shape: chatId undefined (Sendblue has no Linq chat id), parts is
//      synthesized from content (always) + media_url (if present).
//   8. Call routeInboundMessage inside try/catch. A router throw writes a
//      secondary audit row tagged ROUTING_FAILED and still returns 200 so
//      Sendblue does not retry a payload that reproducibly fails.
//
// Return policy: 200 on every non-transient path. Sendblue retries 5xx up
// to 3 times with a 45s timeout — we do not want retries for malformed
// payloads, dedupe hits, signature failures, or routing bugs.

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeInboundMessage } from "@/lib/linq/message-router";
import type { SendblueInboundWebhook } from "@/lib/messaging/sendblue";
import {
  startLatencyCollector,
  markLatency,
  computeLatencyDeltas,
  formatLatencyLog,
} from "@/lib/messaging/latency";

export const runtime = "nodejs";

/**
 * Sendblue webhook signature verification.
 *
 * Security model (ADR-039): Sendblue sends the raw shared secret in the
 * `sb-signing-secret` header — no HMAC, no body signing. Verification is a
 * constant-time equality compare between the header value and
 * SENDBLUE_WEBHOOK_SECRET.
 *
 * Returns true only on an exact match. Returns false on any of:
 *   - SENDBLUE_WEBHOOK_SECRET not configured (fail-closed)
 *   - sb-signing-secret header missing
 *   - header value differs from the configured secret (including length)
 *
 * The caller (POST handler) short-circuits routing when this returns false
 * and records `verified: false` in the audit row.
 */
function verifyInboundSignature(req: NextRequest): boolean {
  const expected = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!expected) {
    console.error(
      "[sendblue-webhook] SENDBLUE_WEBHOOK_SECRET not configured — failing closed"
    );
    return false;
  }

  const headerValue = req.headers.get("sb-signing-secret");
  if (!headerValue) return false;

  // Sendblue sends the raw secret string (not an HMAC). Constant-time
  // compare on equal-length buffers.
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // t0 anchor for the latency collector. webhook_start is implicit.
  const timings = startLatencyCollector();

  // Log the header set so the signature-bearing header becomes visible on
  // first real webhook. Header names are not sensitive.
  const headerKeys = Array.from(req.headers.keys());
  console.log("[sendblue-webhook] header_keys=%j", headerKeys);

  const rawBody = await req.text();

  let payload: SendblueInboundWebhook;
  try {
    payload = JSON.parse(rawBody) as SendblueInboundWebhook;
  } catch (err) {
    console.error("[sendblue-webhook] invalid_json", {
      message: err instanceof Error ? err.message : String(err),
      details: err,
    });
    return NextResponse.json({ ok: false, reason: "invalid_json" });
  }
  markLatency(timings, "json_parsed");

  const verified = verifyInboundSignature(req);
  markLatency(timings, "verified");

  console.log(
    "[sendblue-webhook] inbound handle=%s service=%s is_group=%s was_downgraded=%s verified=%s",
    payload.message_handle,
    payload.service,
    payload.group_id ? "true" : "false",
    payload.was_downgraded,
    verified
  );

  const admin = createAdminClient();

  // PII redaction (ADR-037): messaging_events.content is metadata-only.
  // raw_payload is a fields-only projection — no message body, no media URL
  // contents. `verified` rides along so ops can distinguish rows whose
  // sb-signing-secret header matched from those that did not.
  const contentLength = (payload.content ?? "").length;
  const hasMedia = !!payload.media_url && payload.media_url !== "";
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
    has_media: hasMedia,
    verified,
  };

  // Primary audit row. Idempotent via unique partial index on
  // (provider, provider_message_id).
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
  markLatency(timings, "audit_in_done");

  if (error) {
    if (error.code === "23505") {
      // Sendblue retry of a message we already processed. The first delivery
      // wrote the audit row and ran routing; re-running would double-invoke
      // Jove. Short-circuit.
      console.log(
        "[sendblue-webhook] duplicate_inbound handle=%s — dedupe hit, skipping route",
        payload.message_handle
      );
      return NextResponse.json({ ok: true });
    }
    // Non-dedupe DB error. Log with full detail and fall through to routing
    // — dropping a user's message because we couldn't audit it is a worse
    // failure than a missing audit row.
    console.error("[sendblue-webhook] db_insert_failed", {
      code: error.code,
      message: error.message,
      details: error,
    });
  }

  // Signature verification gate. Audited above; if the secret didn't match,
  // we log and stop — do not route.
  if (!verified) {
    console.error("[sendblue-webhook] signature_verification_failed", {
      handle: payload.message_handle,
    });
    return NextResponse.json({ ok: true });
  }

  // Group short-circuit. Group facilitator stays on Linq per ADR-035.
  // Audited already; return without routing.
  if (payload.group_id && payload.group_id !== "") {
    console.log(
      "[sendblue-webhook] group_inbound_ignored handle=%s group_id=%s — groups stay on Linq per ADR-035",
      payload.message_handle,
      payload.group_id
    );
    return NextResponse.json({ ok: true });
  }

  // 1:1 routing. Adapt the flat Sendblue payload to the router's shape.
  // chatId is intentionally undefined — Sendblue has no persistent chat id
  // and the router's Linq-specific surfaces (typing indicator, read
  // receipts, linq_chat_id write-back) are guarded on chatId presence.
  const parts: Array<{ type: string; value: string }> = [
    { type: "text", value: payload.content ?? "" },
  ];
  if (hasMedia) {
    parts.push({ type: "image", value: payload.media_url });
  }

  try {
    await routeInboundMessage({
      senderPhone: payload.from_number,
      parts,
      timings,
    });
  } catch (err) {
    console.error("[sendblue-webhook] routing_failed", {
      handle: payload.message_handle,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
      details: err,
    });

    // Secondary audit row. provider_message_id is null so it does not
    // collide with the primary row's unique index. status/content mark the
    // failure distinctly; raw_payload links back to the parent handle for
    // ops to correlate.
    await admin.from("messaging_events").insert({
      direction: "inbound",
      provider: "sendblue",
      provider_message_id: null,
      from_number: payload.from_number,
      to_number: payload.to_number,
      content: "[ROUTING_FAILED]",
      status: "ROUTING_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      raw_payload: {
        kind: "routing_failure",
        parent_message_handle: payload.message_handle,
        error_stack: err instanceof Error ? err.stack : null,
      },
    });
    // Still 200 on routing failure. A router bug deterministically fails
    // every retry — letting Sendblue retry just burns retry budget. Fall
    // through to emit the latency line (partial) + return.
  }

  // Emit one structured latency line per round-trip. Short-circuit paths
  // (invalid JSON, sig fail, dedupe, group skip) return earlier and never
  // reach here — the log is scoped to actually-routed inbound.
  console.log(
    formatLatencyLog(
      payload.message_handle,
      computeLatencyDeltas(timings)
    )
  );

  return NextResponse.json({ ok: true });
}
