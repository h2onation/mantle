// SCAFFOLD — probe for Sendblue's outbound status webhook shape.
//
// Default behavior: ACK with 200 and do nothing. Sendblue is satisfied,
// no logs emitted, no PII surfaces anywhere.
//
// Debug mode: set SENDBLUE_STATUS_DEBUG=true in Vercel env + redeploy.
// While active, the handler logs request headers + full raw body so we
// can see:
//   - the exact header name carrying the webhook secret
//   - the exact field names in the outbound payload
//   - how many webhook calls land per outbound message
//
// The full body echoes phone numbers and Jove's reply content — an
// intentional short-term violation of ADR-037 for the probe window. To
// kill the leak: set SENDBLUE_STATUS_DEBUG=false (or delete it) in
// Vercel and redeploy. Vercel env changes require a new deployment to
// take effect, so "flip + redeploy" is the two-step off switch.
//
// Commit 2b replaces this entire handler with the real implementation:
// signature verification, audit-row update, structured logging only.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Default-safe: if the debug flag is anything other than the literal
  // string "true", ACK and return immediately without reading the body
  // or logging anything.
  if (process.env.SENDBLUE_STATUS_DEBUG !== "true") {
    return NextResponse.json({ ok: true });
  }

  const headers = Object.fromEntries(req.headers.entries());
  console.log("[sendblue-status-webhook] headers=%j", headers);

  const rawBody = await req.text();
  console.log("[sendblue-status-webhook] body=%s", rawBody);

  return NextResponse.json({ ok: true });
}
