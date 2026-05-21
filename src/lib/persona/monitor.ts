// ---------------------------------------------------------------------------
// Phase 0 shadow monitor — per-turn alliance read.
//
// The monitor is a Haiku pre-call introduced as the foundation of the
// two-layer engine plan (docs/reference/two-layer-engine-evaluation.md).
// Phase 0 runs it in SHADOW MODE: every web turn, log-only, NO gating on
// its output. We persist reads to public.monitor_reads so we can eyeball
// 20-30 transcripts against the structured outputs before deciding
// whether to promote the monitor onto the critical path.
//
// Inputs: last 8 messages of conversation history. The window is tight on
// purpose — alliance state is about the recent shape of the exchange, not
// the long arc. A wider window costs tokens for no measurable gain at
// this layer.
//
// Output shape: five enum/boolean fields plus a one-sentence reason.
// Models lie. The parse layer below treats every field as adversarial
// input and returns null if anything is off-shape. A failed parse means
// "no read this turn" — telemetry catches it, downstream is unaffected.
// ---------------------------------------------------------------------------

import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { MONITOR_MODEL, PERSONA_NAME } from "@/lib/persona/config";

// Mirror the CHECK constraints in
// supabase/migrations/20260521120000_add_monitor_reads.sql. Drift here
// causes an INSERT to fail. Any new enum value needs both a code change
// AND a new migration to relax the check.
export type MonitorScope = "in_scope" | "drifting" | "out_of_scope";
export type MonitorRupture = "none" | "withdrawal" | "confrontation";
export type MonitorDirection = "steadying" | "drifting" | "sinking";

export interface MonitorRead {
  bond_holding: boolean;
  task_agreed: boolean;
  scope: MonitorScope;
  rupture: MonitorRupture;
  direction: MonitorDirection;
  reason: string;
}

const SCOPES: readonly MonitorScope[] = ["in_scope", "drifting", "out_of_scope"];
const RUPTURES: readonly MonitorRupture[] = ["none", "withdrawal", "confrontation"];
const DIRECTIONS: readonly MonitorDirection[] = ["steadying", "drifting", "sinking"];

// How many turns the monitor sees. Direction is a sliding-window read so
// the window must be wide enough to see a slope. Eight messages = ~4
// exchanges, which captures gradual withdrawal patterns without paying
// for a long context.
export const MONITOR_MESSAGE_WINDOW = 8;

// Max output tokens. The structured response is ~30 tokens; the reason
// sentence ~20. 256 is plenty of headroom and caps the cost.
const MONITOR_MAX_TOKENS = 256;

const MONITOR_SYSTEM = `You read the relationship between ${PERSONA_NAME} (an AI conversationalist) and the user across the last several turns. Your job is NOT to evaluate the topic, the user's pattern, or the truth of any claim. Your job is to read the alliance.

You produce a structured read on five axes. Output ONLY JSON. No prose, no markdown, no explanation outside the reason field.

FIVE AXES

bond_holding (boolean): Does the user appear to trust ${PERSONA_NAME} in this exchange? Trust shows as engagement (elaborating, asking back, taking a position) or alive disagreement (push-back with content). Lack of trust shows as flat compliance, withdrawal, sarcasm not grounded in content, or treating ${PERSONA_NAME} as an obstacle to manage. Default true unless evidence contradicts.

task_agreed (boolean): Are ${PERSONA_NAME} and the user working on the same thing right now? True when the user picks up the thread ${PERSONA_NAME} offered, or names a thread of their own and ${PERSONA_NAME} is following it. False when they are pulling in different directions — ${PERSONA_NAME} deepening on a pattern the user is trying to leave, or the user pulling toward a topic ${PERSONA_NAME} keeps redirecting away from.

scope: "in_scope" | "drifting" | "out_of_scope".
- in_scope: the exchange is about understanding how the user operates. Self-understanding territory.
- drifting: the exchange has tilted toward live decision-making ("what should I do tonight"), applied advice, or a domain ${PERSONA_NAME} should not engage in depth (medication questions, legal, clinical assessment).
- out_of_scope: the exchange is clearly outside what a Manual can hold — the user is asking ${PERSONA_NAME} for treatment, prescribed action, or assessment of someone else.

rupture: "none" | "withdrawal" | "confrontation".
- none: no rupture in this exchange.
- withdrawal: the user has gone flat — short answers, "I don't know," "you're right," "I guess," compliance without engagement. Distinct from genuine brevity (a clear short answer to a clear short question). The shape is REDUCING signal in response to ${PERSONA_NAME}'s moves.
- confrontation: the user has pushed back with content — "that's not what I meant," "you're missing the point," challenging an observation. NOT the same as withdrawal. The shape is INCREASED signal aimed at correcting ${PERSONA_NAME}.

direction: "steadying" | "drifting" | "sinking". A read of the SLOPE across the recent window, not just the current turn.
- steadying: the exchange is holding or strengthening. User staying engaged or going deeper across turns.
- drifting: losing thread or focus across turns. Not flatness, just loss of traction. Could go either way.
- sinking: the user is going quieter and flatter over time. Multiple recent turns showing reducing signal. THIS is the read that catches the depressive-state-as-pattern failure — when a user's affect is dropping but ${PERSONA_NAME} keeps reading the flatness as cooperation.

reason: one sentence (under 25 words) naming the load-bearing evidence for these reads. Quote a phrase or name a specific shift. NOT a summary of the topic.

CRITICAL RULES

- Read the alliance, not the content. Whether the user is "right" or whether ${PERSONA_NAME}'s observation is correct is irrelevant.
- "Going flat" is the signal you must not miss. A user who responds "you're right," "I guess," "I don't know" three turns running is not cooperating. They are withdrawing. Set rupture=withdrawal and direction=sinking even if the surface text reads as agreement.
- Withdrawal and confrontation are mutually exclusive in any single turn. A withdrawn user might confront later; pick the dominant shape THIS exchange.
- A turn with no user messages (only assistant turns visible, e.g. opener) produces a neutral read: bond_holding=true, task_agreed=true, scope=in_scope, rupture=none, direction=steadying, reason="no user turn to read yet."
- Use ${PERSONA_NAME}'s name when natural; never use the user's name (you don't know it).

OUTPUT FORMAT (strict)

{"bond_holding": true, "task_agreed": true, "scope": "in_scope", "rupture": "none", "direction": "steadying", "reason": "single sentence under 25 words."}

Return ONLY the JSON object. No code fences, no preamble.`;

interface RunMonitorOptions {
  conversationHistory: { role: "user" | "assistant"; content: string }[];
}

export interface MonitorResult {
  read: MonitorRead;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
  };
  latency_ms: number;
}

/**
 * Run the monitor for one turn. Returns the parsed read plus telemetry.
 * Throws on API failure or unparseable output — caller decides whether
 * to swallow (shadow mode) or surface. Phase 0 swallows via
 * fireBackgroundMonitor's .catch.
 */
export async function runMonitor(
  options: RunMonitorOptions
): Promise<MonitorResult> {
  const { conversationHistory } = options;
  const window = conversationHistory.slice(-MONITOR_MESSAGE_WINDOW);

  // Render the window as a compact transcript. Plain "role: content"
  // lines — matches the extraction call's idiom so the model recognizes
  // the convention.
  const transcript = window
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const userContent = `RECENT EXCHANGE (last ${window.length} of ${conversationHistory.length} messages):

${transcript}

Produce the structured read. JSON only.`;

  const started = Date.now();
  const response = await anthropicFetch({
    model: MONITOR_MODEL,
    max_tokens: MONITOR_MAX_TOKENS,
    system: [
      {
        type: "text",
        text: MONITOR_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });
  const latency_ms = Date.now() - started;

  const cleaned = extractResponseText(response)
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const read = parseMonitorRead(cleaned);
  if (!read) {
    throw new Error("monitor returned unparseable read");
  }

  return {
    read,
    usage: {
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
    },
    latency_ms,
  };
}

/**
 * Adversarial parser. Returns null on any shape error so the caller can
 * count parse failures via error_class instead of mis-routing malformed
 * data into the DB. Exported so the test suite can hit every branch
 * without round-tripping through anthropicFetch.
 */
export function parseMonitorRead(raw: string): MonitorRead | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;

  if (typeof p.bond_holding !== "boolean") return null;
  if (typeof p.task_agreed !== "boolean") return null;
  if (typeof p.scope !== "string" || !SCOPES.includes(p.scope as MonitorScope)) {
    return null;
  }
  if (
    typeof p.rupture !== "string" ||
    !RUPTURES.includes(p.rupture as MonitorRupture)
  ) {
    return null;
  }
  if (
    typeof p.direction !== "string" ||
    !DIRECTIONS.includes(p.direction as MonitorDirection)
  ) {
    return null;
  }
  // reason is optional in the schema (we accept a missing field rather
  // than failing the whole read). Coerce to empty string on absence.
  const reason = typeof p.reason === "string" ? p.reason.trim() : "";

  return {
    bond_holding: p.bond_holding,
    task_agreed: p.task_agreed,
    scope: p.scope as MonitorScope,
    rupture: p.rupture as MonitorRupture,
    direction: p.direction as MonitorDirection,
    reason,
  };
}
