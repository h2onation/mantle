// Latency instrumentation for the Sendblue inbound → Jove reply → outbound
// round-trip. Scoped to Sendblue; the collector is only created by the
// Sendblue webhook handler and threaded through the shared router and
// persona-bridge via an optional field. markLatency() is a no-op when the
// collector is undefined, so adding mark calls inside shared code does not
// instrument the Linq inbound path or any other caller.
//
// One structured log line is emitted by the webhook at the end of each
// round-trip. Format:
//
//   [latency] sendblue_roundtrip handle=<msg_handle>
//     total=<N>ms verify=<N>ms audit_in=<N>ms phone_lookup=<N>ms
//     context_load=<N>ms anthropic=<N>ms persist=<N>ms send=<N>ms
//
// Any bucket whose start or end mark is missing is emitted as -1ms. That
// happens naturally for short-circuit paths (dedupe, group skip, etc.)
// where some marks never fire; the -1 is the honest signal.

export interface LatencyCollector {
  /** Baseline timestamp from performance.now() — all marks are relative. */
  t0: number;
  /** mark name → ms-since-t0. */
  marks: Record<string, number>;
}

export function startLatencyCollector(): LatencyCollector {
  return { t0: performance.now(), marks: {} };
}

export function markLatency(
  collector: LatencyCollector | undefined,
  name: string
): void {
  if (!collector) return;
  collector.marks[name] = performance.now() - collector.t0;
}

export interface LatencyDeltas {
  total: number;
  verify: number;
  audit_in: number;
  phone_lookup: number;
  context_load: number;
  anthropic: number;
  persist: number;
  send: number;
}

function delta(
  marks: Record<string, number>,
  from: string,
  to: string
): number {
  const a = marks[from];
  const b = marks[to];
  if (a === undefined || b === undefined) return -1;
  return Math.round(b - a);
}

export function computeLatencyDeltas(
  collector: LatencyCollector
): LatencyDeltas {
  const { marks } = collector;
  const endMs = marks.send_returned ?? performance.now() - collector.t0;
  return {
    total: Math.round(endMs),
    verify: delta(marks, "json_parsed", "verified"),
    audit_in: delta(marks, "verified", "audit_in_done"),
    phone_lookup: delta(marks, "router_entry", "phone_lookup_done"),
    context_load: delta(marks, "phone_lookup_done", "context_loaded"),
    anthropic: delta(marks, "anthropic_start", "anthropic_returned"),
    persist: delta(marks, "anthropic_returned", "reply_persisted"),
    send: delta(marks, "send_started", "send_returned"),
  };
}

export function formatLatencyLog(
  handle: string,
  deltas: LatencyDeltas
): string {
  return (
    `[latency] sendblue_roundtrip handle=${handle}` +
    ` total=${deltas.total}ms` +
    ` verify=${deltas.verify}ms` +
    ` audit_in=${deltas.audit_in}ms` +
    ` phone_lookup=${deltas.phone_lookup}ms` +
    ` context_load=${deltas.context_load}ms` +
    ` anthropic=${deltas.anthropic}ms` +
    ` persist=${deltas.persist}ms` +
    ` send=${deltas.send}ms`
  );
}
