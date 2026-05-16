// Structured JSON logging for observability. See
// docs/reference/checkpoint-hardening-plan.md Track 4 for the full spec.
//
// Every log line is a single-line JSON object with a fixed shape.
// Vercel picks these up automatically; the confirm_failures table is
// a queryable rollup populated separately by the route.
//
// Rules:
// - Never log: message content, entry name, user email, phone numbers,
//   any text the user typed. PII rule from CLAUDE.md.
// - user_id_hash is a stable SHA-256 digest (first 16 hex chars) — lets
//   us correlate events for one user without exposing their id.
// - outcome field is the canonical success/failure taxonomy — see
//   ConfirmOutcome below.

export type ConfirmEvent =
  | "confirm_attempt"
  | "confirm_rpc_ok"
  | "confirm_rpc_fail"
  | "confirm_stream_started"
  | "confirm_stream_ended"
  | "confirm_outcome"
  | "cache_performance";

export type ConfirmOutcome =
  | "success"
  | "idempotent"
  | "not_found"
  | "not_pending"
  | "rpc_fail"
  | "stream_interrupted"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "internal_error";

/** Which Anthropic call surface emitted the cache_performance event.
 *  Lets log queries split chat-vs-extraction hit rates. */
export type CachedSurface = "chat" | "extraction";

export interface LogEntry {
  ts: string;
  event: ConfirmEvent;
  req_id?: string | null;
  user_id_hash?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  layer?: number | null;
  outcome?: ConfirmOutcome;
  status_code?: number | null;
  duration_ms?: number | null;
  error_kind?: string | null;
  error_detail?: string | null;
  // cache_performance fields. Token counts from the Anthropic Messages
  // API. input_tokens is the uncached portion; cache_creation is the
  // prefix tokens written on a miss; cache_read is the prefix tokens
  // served from cache on a hit. cache_read > 0 indicates a cache hit.
  surface?: CachedSurface;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Fixed salt so the same user maps to the same hash across deploys.
// Not secret — rotation would break correlation. Lives in env so the
// dev and prod hashes differ (prevents accidental correlation across
// environments).
const SALT = process.env.OBSERVABILITY_USER_ID_SALT || "mywalnut-dev-salt-v1";

/**
 * Stable short hash of a user id, suitable for log correlation but opaque
 * to humans. First 16 hex chars of SHA-256(salt + user_id). ~64 bits of
 * entropy is plenty for the population sizes we're talking about.
 *
 * Runs in Edge Runtime (uses the Web Crypto API, not Node crypto).
 */
export async function hashUserId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const data = new TextEncoder().encode(SALT + ":" + userId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Emit one structured log line. Dev mode pretty-prints for eyeballs;
 * production emits compact JSON that Vercel Logs + future log-shipping
 * can consume.
 */
export function logEvent(entry: Partial<LogEntry> & { event: ConfirmEvent }): void {
  const full: LogEntry = {
    ts: new Date().toISOString(),
    ...entry,
  };

  if (process.env.NODE_ENV !== "production") {
    // Dev: compact but human-readable
    const {
      event,
      outcome,
      status_code,
      duration_ms,
      error_kind,
      surface,
      cache_read_input_tokens,
      cache_creation_input_tokens,
      input_tokens,
    } = full;
    const bits: string[] = [event];
    if (surface) bits.push(`surface=${surface}`);
    if (outcome) bits.push(`outcome=${outcome}`);
    if (status_code) bits.push(`status=${status_code}`);
    if (duration_ms !== undefined && duration_ms !== null) {
      bits.push(`${duration_ms}ms`);
    }
    if (cache_read_input_tokens !== undefined) {
      bits.push(`cache_read=${cache_read_input_tokens}`);
    }
    if (cache_creation_input_tokens !== undefined) {
      bits.push(`cache_create=${cache_creation_input_tokens}`);
    }
    if (input_tokens !== undefined) {
      bits.push(`uncached_input=${input_tokens}`);
    }
    if (error_kind) bits.push(`err=${error_kind}`);
    // eslint-disable-next-line no-console
    console.log("[obs]", ...bits);
    return;
  }

  // Production: single-line JSON, no PII. Vercel aggregates automatically.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(full));
}
