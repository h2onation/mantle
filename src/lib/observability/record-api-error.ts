// Fire-and-forget write to public.api_errors. Called from any wrapped API
// route that throws or returns 500. Sibling of recordConfirmFailure for
// cross-route coverage. Awaits the write (small latency cost is preferable
// to losing the observability row on unhandled-promise warnings in Edge
// Runtime), but never throws — if the write fails we log and move on so
// a logging failure can't cascade into the user's request.

import type { createAdminClient } from "@/lib/supabase/admin";
import { hashUserId } from "./log";

interface RecordApiErrorOptions {
  admin: ReturnType<typeof createAdminClient>;
  route: string;                   // e.g. "/api/chat"
  method: string;                  // "POST", "GET", etc.
  error: unknown;
  statusCode?: number | null;
  userId?: string | null;          // raw Supabase user id; hashed before write
  requestId?: string | null;       // correlation with structured logs
}

export async function recordApiError(
  opts: RecordApiErrorOptions
): Promise<void> {
  try {
    const errorMessage =
      opts.error instanceof Error
        ? opts.error.message
        : String(opts.error);
    const errorStack =
      opts.error instanceof Error ? opts.error.stack : null;

    // Hash the user_id server-side so this table never stores raw ids.
    const userIdHash = opts.userId ? await hashUserId(opts.userId) : null;

    const { error } = await opts.admin.from("api_errors").insert({
      route: opts.route,
      method: opts.method,
      status_code: opts.statusCode ?? null,
      error_message: errorMessage,
      error_stack: errorStack,
      user_id_hash: userIdHash,
      request_id: opts.requestId ?? null,
    });

    if (error) {
      // Best-effort only. If the observability table is unreachable we
      // don't want to cascade a failure into the user's request.
      console.error("[record-api-error] Insert failed:", error);
    }
  } catch (err) {
    console.error("[record-api-error] Unexpected:", err);
  }
}
