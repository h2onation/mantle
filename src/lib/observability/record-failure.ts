// Fire-and-forget write to public.confirm_failures. Called from the
// confirm route on every 4xx/5xx. Intentionally awaits the write (small
// latency cost is preferable to losing the observability row on
// unhandled-promise warnings in Edge Runtime), but never throws — if
// the write fails we log and move on.

import type { createAdminClient } from "@/lib/supabase/admin";

export type ConfirmErrorKind =
  | "not_found"
  | "not_pending"
  | "rpc_fail"
  | "stream_interrupted"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "internal_error";

interface RecordConfirmFailureOptions {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  messageId?: string | null;
  conversationId?: string | null;
  errorKind: ConfirmErrorKind;
  errorDetail?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
}

export async function recordConfirmFailure(
  opts: RecordConfirmFailureOptions
): Promise<void> {
  try {
    const { error } = await opts.admin.from("confirm_failures").insert({
      user_id: opts.userId,
      message_id: opts.messageId || null,
      conversation_id: opts.conversationId || null,
      error_kind: opts.errorKind,
      error_detail: opts.errorDetail || null,
      status_code: opts.statusCode || null,
      duration_ms: opts.durationMs || null,
    });

    if (error) {
      // Best-effort only. If the observability table is unreachable we
      // don't want to cascade a failure into the user's request.
      console.error("[record-failure] Insert failed:", error);
    }
  } catch (err) {
    console.error("[record-failure] Unexpected:", err);
  }
}
