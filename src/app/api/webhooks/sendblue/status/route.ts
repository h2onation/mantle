// SCAFFOLD — probe for Sendblue's outbound status webhook shape.
//
// WARNING: this handler logs the full request body, which Sendblue echoes
// with message content, phone numbers, and other PII. That violates
// ADR-037's "messaging_events.content is metadata-only" rule for the
// duration this scaffold is live. This is acceptable ONLY for the one-
// shot debugging session needed to confirm:
//   - the exact header name carrying the webhook secret
//   - the exact field names in the outbound payload
//   - how many webhook calls land per outbound message
//
// Commit 2b MUST replace this handler with the real implementation:
// signature verification, audit-row update, no raw payload logging.
// Do not leave this scaffold in main after the probe completes.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  console.log("[sendblue-status-webhook] headers=%j", headers);

  const rawBody = await req.text();
  console.log("[sendblue-status-webhook] body=%s", rawBody);

  return NextResponse.json({ ok: true });
}
