/**
 * Replay harness for the Phase 0 shadow monitor.
 *
 * WHAT IT DOES
 *   Reads a stored transcript and runs the real runMonitor() at each
 *   cumulative user turn. For a transcript with N user turns the harness
 *   runs the monitor N times — first with history up through user turn 1,
 *   then up through user turn 2, ... up through user turn N — and prints
 *   the read at each step.
 *
 *   Use this to eyeball whether the monitor's direction / rupture /
 *   scope classification tracks what you observed happening across a
 *   conversation. This IS the Phase 0 verdict instrument.
 *
 * WRITES NOTHING TO PRODUCTION DATA
 *   This script never opens the Supabase admin client and never inserts
 *   into public.monitor_reads. Output goes to stdout, and optionally to
 *   a JSON file via --out. Replay data stays out of the live shadow set
 *   so the Phase 0 verdict is read against organic traffic only.
 *
 * USES THE REAL runMonitor()
 *   Imports src/lib/persona/monitor.ts. The prompt, model, parsing, and
 *   error handling are identical to production. The only deviation is
 *   the optional --full-history flag, which sets the runMonitor option
 *   that bypasses the 8-message window — used to compare windowed vs.
 *   full-history slope detection. Live wiring never sets that flag.
 *
 * TRANSCRIPT FORMATS
 *
 *   Plain text (default; .txt or no extension):
 *     Lines starting with USER:, JOVE:, or ASSISTANT: mark turn
 *     boundaries. Everything until the next prefix or EOF belongs to
 *     that turn. Lines starting with # are comments and are stripped.
 *     Multi-line messages are supported — blank lines inside a turn are
 *     preserved.
 *
 *     # Tuesday session, names scrubbed.
 *     USER: I keep doing this thing where I freeze in meetings.
 *
 *     JOVE: Walk me through the last time.
 *
 *     USER: It was yesterday. Voice just went.
 *
 *   JSON (.json):
 *     An array of {role, content} objects. role is "user" or
 *     "assistant". No assistant-role normalization — write whichever
 *     side you mean.
 *
 *     [
 *       {"role": "user", "content": "I keep doing this thing..."},
 *       {"role": "assistant", "content": "Walk me through..."}
 *     ]
 *
 *   Format is detected by file extension: .json parses as JSON, anything
 *   else parses as plain text.
 *
 * USAGE
 *   npx tsx --env-file=.env.local scripts/replay-monitor.ts <transcript> [flags]
 *
 * FLAGS
 *   --full-history    Bypass the 8-message window. Sends the full
 *                     accumulated history at each user-turn cut.
 *   --compare         Run BOTH passes (windowed + full-history) and
 *                     print a per-turn divergence table at the end.
 *                     Implies --full-history. Doubles the API calls.
 *   --json            Emit machine-readable JSON to stdout instead of
 *                     the human-readable per-turn blocks.
 *   --out=<path>      Also write the full results as JSON to <path>.
 *                     Can be combined with the default human output.
 *
 * REQUIRES
 *   ANTHROPIC_API_KEY in .env.local (the --env-file flag above loads it).
 *
 * COST
 *   One Anthropic call per user turn per pass. A 10-user-turn transcript
 *   = 10 calls (or 20 with --compare). At Opus pricing, plan on a few
 *   pennies to under a dollar per transcript depending on length.
 */

// Env loading is the caller's job: invoke via `tsx --env-file=.env.local`
// so ANTHROPIC_API_KEY is in process.env before this module is imported.
// (The unit tests don't need an API key — they import the pure helpers
// only.) The earlier `import "dotenv/config"` form required `dotenv` as a
// dep and broke the test runner that follows the import graph.
import { readFileSync, writeFileSync } from "fs";
import { extname, basename } from "path";
import {
  runMonitor,
  type MonitorResult,
} from "../src/lib/persona/monitor";

// ─── Types ──────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
interface TranscriptMessage {
  role: Role;
  content: string;
}

interface TurnRead {
  /** 1-indexed position of this user turn within the user-turn sequence. */
  user_turn_index: number;
  /** 0-indexed position of this user turn in the underlying messages array. */
  message_index: number;
  user_message: string;
  windowed?: MonitorResult;
  full?: MonitorResult;
  windowed_error?: string;
  full_error?: string;
}

// ─── CLI parsing ────────────────────────────────────────────────────────

interface CliOptions {
  transcript: string;
  fullHistory: boolean;
  compare: boolean;
  json: boolean;
  outPath: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const positional: string[] = [];
  let fullHistory = false;
  let compare = false;
  let json = false;
  let outPath: string | null = null;

  for (const arg of argv) {
    if (arg === "--full-history") fullHistory = true;
    else if (arg === "--compare") {
      compare = true;
      fullHistory = true;
    } else if (arg === "--json") json = true;
    else if (arg.startsWith("--out=")) outPath = arg.slice("--out=".length);
    else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error(
      "expected one positional argument (transcript path); see header for usage"
    );
  }

  return {
    transcript: positional[0],
    fullHistory,
    compare,
    json,
    outPath,
  };
}

// ─── Transcript parsing ─────────────────────────────────────────────────

const PREFIX_RE = /^(USER|JOVE|ASSISTANT)\s*:/i;

/**
 * Parse the plain-text transcript format. See header docblock for shape.
 * Throws on any malformed input rather than silently dropping turns.
 */
export function parsePlainTextTranscript(text: string): TranscriptMessage[] {
  const lines = text.split(/\r?\n/);
  const messages: TranscriptMessage[] = [];
  let currentRole: Role | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentRole === null) return;
    // Trim trailing blank lines (often the gap before the next prefix);
    // leave leading and inner whitespace intact for fidelity.
    while (currentLines.length > 0 && currentLines[currentLines.length - 1] === "") {
      currentLines.pop();
    }
    const content = currentLines.join("\n").trim();
    if (content.length === 0) {
      throw new Error(
        `transcript turn for ${currentRole} is empty (no content between prefixes)`
      );
    }
    messages.push({ role: currentRole, content });
    currentRole = null;
    currentLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;
    // Comments are skipped entirely. They don't end a turn — keep
    // collecting lines into whatever turn is open.
    if (line.trimStart().startsWith("#")) continue;
    const prefix = line.match(PREFIX_RE);
    if (prefix) {
      flush();
      const tag = prefix[1].toUpperCase();
      currentRole = tag === "USER" ? "user" : "assistant";
      const after = line.slice(prefix[0].length).replace(/^\s+/, "");
      if (after.length > 0) currentLines.push(after);
    } else if (currentRole !== null) {
      currentLines.push(line);
    } else if (line.trim().length > 0) {
      throw new Error(
        `transcript content before first USER:/JOVE: prefix — line: ${JSON.stringify(line)}`
      );
    }
  }
  flush();

  return messages;
}

export function parseJsonTranscript(text: string): TranscriptMessage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`transcript JSON parse error: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("transcript JSON must be an array of {role, content}");
  }
  const messages: TranscriptMessage[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i] as Record<string, unknown>;
    if (!entry || typeof entry !== "object") {
      throw new Error(`transcript entry ${i} is not an object`);
    }
    const role = entry.role;
    const content = entry.content;
    if (role !== "user" && role !== "assistant") {
      throw new Error(
        `transcript entry ${i} role must be "user" or "assistant", got ${JSON.stringify(role)}`
      );
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error(`transcript entry ${i} content must be a non-empty string`);
    }
    messages.push({ role, content });
  }
  return messages;
}

function loadTranscript(path: string): TranscriptMessage[] {
  const raw = readFileSync(path, "utf8");
  if (extname(path).toLowerCase() === ".json") {
    return parseJsonTranscript(raw);
  }
  return parsePlainTextTranscript(raw);
}

// ─── Slicing ────────────────────────────────────────────────────────────

/**
 * For each user-message index, build the cumulative slice through that
 * message (inclusive). Slice contains every prior message in order plus
 * the user message at that index. Mirrors what the production monitor
 * sees: the conversation history through the moment the user's message
 * is submitted (assistant turns since the last user turn included).
 */
export function buildSlices(messages: TranscriptMessage[]): {
  userMessageIndex: number;
  slice: TranscriptMessage[];
}[] {
  const out: { userMessageIndex: number; slice: TranscriptMessage[] }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      out.push({
        userMessageIndex: i,
        slice: messages.slice(0, i + 1),
      });
    }
  }
  return out;
}

// ─── Run ────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max - 1) + "…";
}

async function runOne(
  slice: TranscriptMessage[],
  fullHistory: boolean
): Promise<{ result?: MonitorResult; error?: string }> {
  try {
    const result = await runMonitor({
      conversationHistory: slice,
      fullHistory,
    });
    return { result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runAll(
  messages: TranscriptMessage[],
  options: CliOptions
): Promise<TurnRead[]> {
  const slices = buildSlices(messages);
  const results: TurnRead[] = [];
  for (let i = 0; i < slices.length; i++) {
    const { userMessageIndex, slice } = slices[i];
    const userMsg = messages[userMessageIndex].content;
    process.stderr.write(
      `[replay] turn ${i + 1}/${slices.length} (msg ${userMessageIndex})...`
    );

    // When --compare is set, run both windowed and full-history. When
    // only --full-history is set, run just full. Default: windowed.
    const turn: TurnRead = {
      user_turn_index: i + 1,
      message_index: userMessageIndex,
      user_message: userMsg,
    };

    if (options.compare) {
      const windowed = await runOne(slice, false);
      if (windowed.result) turn.windowed = windowed.result;
      else turn.windowed_error = windowed.error;

      const full = await runOne(slice, true);
      if (full.result) turn.full = full.result;
      else turn.full_error = full.error;
    } else if (options.fullHistory) {
      const full = await runOne(slice, true);
      if (full.result) turn.full = full.result;
      else turn.full_error = full.error;
    } else {
      const windowed = await runOne(slice, false);
      if (windowed.result) turn.windowed = windowed.result;
      else turn.windowed_error = windowed.error;
    }

    results.push(turn);
    process.stderr.write(" done\n");
  }
  return results;
}

// ─── Rendering ──────────────────────────────────────────────────────────

const HR = "─".repeat(72);

function fmtRead(
  label: string,
  result: MonitorResult | undefined,
  err?: string
): string {
  if (err) {
    return `  [${label}] ERROR: ${err}`;
  }
  if (!result) return `  [${label}] (no read)`;
  const r = result.read;
  const tokens =
    result.usage.input_tokens || result.usage.output_tokens
      ? ` (${result.usage.input_tokens ?? "?"} in / ${result.usage.output_tokens ?? "?"} out, ${result.latency_ms}ms)`
      : "";
  return [
    `  [${label}]${tokens}`,
    `    direction:    ${r.direction}`,
    `    rupture:      ${r.rupture}`,
    `    scope:        ${r.scope}`,
    `    task_agreed:  ${r.task_agreed}`,
    `    bond_holding: ${r.bond_holding}`,
    `    reason:       ${r.reason || "(none)"}`,
  ].join("\n");
}

function renderHumanBlocks(results: TurnRead[], options: CliOptions): string {
  const out: string[] = [];
  for (const turn of results) {
    out.push(HR);
    out.push(
      `Turn ${turn.user_turn_index} (message index ${turn.message_index})`
    );
    out.push(`  user: "${truncate(turn.user_message, 240)}"`);
    if (options.compare) {
      out.push(fmtRead("windowed", turn.windowed, turn.windowed_error));
      out.push(fmtRead("full-history", turn.full, turn.full_error));
    } else if (options.fullHistory) {
      out.push(fmtRead("full-history", turn.full, turn.full_error));
    } else {
      out.push(fmtRead("windowed", turn.windowed, turn.windowed_error));
    }
  }
  out.push(HR);
  return out.join("\n");
}

function renderSummaryTable(results: TurnRead[], options: CliOptions): string {
  const rows: string[] = [];
  const headers = options.compare
    ? ["T#", "user", "windowed.dir", "windowed.rup", "full.dir", "full.rup"]
    : ["T#", "user", "direction", "rupture", "scope", "task", "bond"];
  rows.push(headers.join(" | "));
  rows.push(headers.map((h) => "-".repeat(h.length)).join("-+-"));
  for (const turn of results) {
    const u = truncate(turn.user_message, 36).padEnd(36);
    if (options.compare) {
      const w = turn.windowed?.read;
      const f = turn.full?.read;
      rows.push(
        [
          String(turn.user_turn_index).padStart(2),
          u,
          (w?.direction || "?").padEnd(12),
          (w?.rupture || "?").padEnd(13),
          (f?.direction || "?").padEnd(12),
          (f?.rupture || "?").padEnd(13),
        ].join(" | ")
      );
    } else {
      const r = (options.fullHistory ? turn.full : turn.windowed)?.read;
      rows.push(
        [
          String(turn.user_turn_index).padStart(2),
          u,
          (r?.direction || "?").padEnd(12),
          (r?.rupture || "?").padEnd(13),
          (r?.scope || "?").padEnd(12),
          (r?.task_agreed === undefined
            ? "?"
            : r.task_agreed
            ? "yes"
            : "no "
          ).padEnd(3),
          r?.bond_holding === undefined
            ? "?"
            : r.bond_holding
            ? "yes"
            : "no ",
        ].join(" | ")
      );
    }
  }
  return rows.join("\n");
}

function renderDivergenceTable(results: TurnRead[]): string {
  const divergent = results.filter((t) => {
    if (!t.windowed || !t.full) return false;
    const w = t.windowed.read;
    const f = t.full.read;
    return (
      w.direction !== f.direction ||
      w.rupture !== f.rupture ||
      w.scope !== f.scope
    );
  });
  if (divergent.length === 0) {
    return "Divergence: none. Windowed and full-history agree on direction/rupture/scope across all turns.";
  }
  const lines = [
    `Divergence: ${divergent.length}/${results.length} turns differ on direction/rupture/scope.`,
    "",
  ];
  for (const t of divergent) {
    const w = t.windowed!.read;
    const f = t.full!.read;
    lines.push(
      `Turn ${t.user_turn_index}: "${truncate(t.user_message, 60)}"`
    );
    lines.push(`  windowed: ${w.direction} / ${w.rupture} / ${w.scope}`);
    lines.push(`  full:     ${f.direction} / ${f.rupture} / ${f.scope}`);
  }
  return lines.join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(
      `replay-monitor: ${(err as Error).message}\n` +
        "Usage: npx tsx --env-file=.env.local scripts/replay-monitor.ts <transcript> [--full-history] [--compare] [--json] [--out=<path>]\n"
    );
    process.exit(2);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      "replay-monitor: ANTHROPIC_API_KEY missing. Run with --env-file=.env.local or export it.\n"
    );
    process.exit(2);
  }

  let messages: TranscriptMessage[];
  try {
    messages = loadTranscript(options.transcript);
  } catch (err) {
    process.stderr.write(
      `replay-monitor: failed to load ${options.transcript}: ${
        (err as Error).message
      }\n`
    );
    process.exit(2);
  }

  const slices = buildSlices(messages);
  if (slices.length === 0) {
    process.stderr.write(
      `replay-monitor: ${options.transcript} contains no user turns; nothing to read.\n`
    );
    process.exit(2);
  }

  const passes = options.compare ? 2 : 1;
  const calls = slices.length * passes;
  process.stderr.write(
    `replay-monitor: ${basename(options.transcript)} — ${
      messages.length
    } messages, ${slices.length} user turns, ${passes} pass${
      passes > 1 ? "es" : ""
    } = ${calls} Anthropic call${calls > 1 ? "s" : ""}.\n`
  );

  const results = await runAll(messages, options);

  if (options.json) {
    process.stdout.write(JSON.stringify({ source: options.transcript, results }, null, 2) + "\n");
  } else {
    process.stdout.write(renderHumanBlocks(results, options) + "\n\n");
    process.stdout.write("SUMMARY TABLE\n");
    process.stdout.write(renderSummaryTable(results, options) + "\n");
    if (options.compare) {
      process.stdout.write("\n" + renderDivergenceTable(results) + "\n");
    }
  }

  if (options.outPath) {
    writeFileSync(
      options.outPath,
      JSON.stringify({ source: options.transcript, results }, null, 2)
    );
    process.stderr.write(`replay-monitor: wrote JSON to ${options.outPath}\n`);
  }
}

// Only run when invoked directly. Lets tests import the pure helpers
// (parsePlainTextTranscript, parseJsonTranscript, buildSlices) without
// triggering an API call.
const invokedDirectly =
  // Node ESM-style entrypoint detection. process.argv[1] is the script
  // path; comparing the file URL is the canonical "did node run me?"
  // check that survives across tsx, ts-node, and plain node.
  process.argv[1] && (process.argv[1].endsWith("replay-monitor.ts") ||
    process.argv[1].endsWith("replay-monitor.js"));

if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(
      `replay-monitor: unexpected error: ${(err as Error).stack || err}\n`
    );
    process.exit(1);
  });
}
