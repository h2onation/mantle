import { anthropicFetch, extractResponseText } from "@/lib/anthropic";
import { COMPOSITION_MODEL } from "@/lib/persona/config";
import {
  SCORE_DIMENSIONS,
  type DimensionScore,
  type ScoreDimensionId,
  type ScoreRecommendation,
  type ScoreResult,
  type ScoreRupture,
} from "@/lib/scoring/dimensions";

// Applies the conductor scoring rubric (Part 1) to one full transcript in a
// single model call. Admin-triggered only — this is an observational tuning
// instrument; nothing in the product pipeline may call it or read its output
// into Jove's behavior (Goodhart guard: the moment Jove is optimized toward
// the score, the score stops measuring anything).

// Same Opus pin as the entry composer — one place to bump the model family.
export const SCORING_MODEL = COMPOSITION_MODEL;

export interface TranscriptMessage {
  role: string;
  content: string;
}

// Bound the transcript so a marathon session can't blow the request. The
// rubric wants the whole arc, so we drop from the TOP when over budget and
// say so in the transcript header (early turns are the cheapest to lose —
// the boundary turn and close live at the end).
const TRANSCRIPT_CHAR_BUDGET = 150_000;

/** Number turns the way the rubric's Setup step requires: J1, U1, J2, U2…
 *  counted per speaker from the top. System rows (checkpoint pipeline events,
 *  e.g. the synthetic save line) render unnumbered as [system] — the rubric's
 *  save-signal rule keys on them. */
export function buildNumberedTranscript(messages: TranscriptMessage[]): string {
  let j = 0;
  let u = 0;
  const lines = messages
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => {
      if (m.role === "assistant") return `J${++j}: ${m.content}`;
      if (m.role === "user") return `U${++u}: ${m.content}`;
      return `[system] ${m.content}`;
    });

  let dropped = 0;
  let total = lines.reduce((a, l) => a + l.length + 2, 0);
  while (total > TRANSCRIPT_CHAR_BUDGET && dropped < lines.length - 1) {
    total -= lines[dropped].length + 2;
    dropped += 1;
  }
  const kept = lines.slice(dropped);
  const header =
    dropped > 0
      ? `[transcript truncated: the first ${dropped} turns are omitted; numbering is preserved]\n\n`
      : "";
  return header + kept.join("\n\n");
}

function buildScoringInstructions(): string {
  return `You are an adversarial conversation-quality auditor. You will score ONE 1:1 conversation between Jove (an AI, turns numbered J1, J2, …) and a user (turns numbered U1, U2, …) against the scoring rubric provided in the next block.

Apply Part 1 of the rubric mechanically:
- Compute the three mechanical signals (bare-yes streak, boundary turn, correction count).
- Score all six dimensions D1–D6 from 1 to 5 against the anchors. Every score of 1, 2, 4, or 5 must cite turn numbers — an uncited score is invalid.
- One root event counts once: assign it to its primary dimension; echoes in other dimensions are same-root and do not trigger caps.
- Record every rupture event and whether it was repaired.
- Name the strongest and the weakest moment, each with its mechanism and a turn citation.

Hard stances:
- Be adversarial. A 4 or 5 must be earned by cited evidence, never granted on overall impression.
- The user is the author: any reading that rewards Jove for steering, concluding for the user, or hunting for an entry is a misreading.
- Asymmetry: ending too early is worse than going too long.
- [system] lines are pipeline events, not conversation turns. An entry was saved ONLY if a [system] line says so — user agreement in chat never means a save happened.

The "so what" of each number: for every dimension scored 4 or below, add a "gap" — one sentence naming the 5-anchor behavior that was missing at the cited turn (what a 5 would have looked like there). Omit "gap" on 5s.

After scoring, pick the SINGLE biggest lever — the one dimension where a behavior change would most raise the next session — and emit it as "recommendation": a failure-shape slug, the evidence turns, and a one-sentence remedy direction. This is a ledger candidate, not a prompt edit — never propose prompt wording. Use a known slug when the shape matches (stable naming is what makes recurrence countable across runs); coin a new kebab-case slug only for a genuinely new shape. Known slugs: stating-not-handing, whole-version-re-render, draft-in-chat, lid-accepted, ungrounded-second-lid, push-past-pivot, unconsented-depth, bare-yes-collection, writer-speak-register, jove-coinage-contamination, early-landing, spike-treated-as-readiness, deferred-pen-missed-fire. If every dimension is a 5, "recommendation" is null.

Return ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "dimensions": [
    { "id": "D1", "score": 3, "citations": ["U12", "J14"], "note": "one-sentence justification", "gap": "one sentence: the missing 5-anchor behavior (omit when score is 5)" }
    // exactly six entries, ids D1 through D6, integer scores 1–5
  ],
  "signals": {
    "bare_yes_streak": "longest streak, where it began, and what Jove was doing — or 'none'",
    "boundary_turn": "e.g. 'U22', or 'none'",
    "correction_count": 0
  },
  "ruptures": [
    { "at": "U18", "type": "confrontation", "repaired": true, "note": "one sentence" }
    // type is "confrontation" or "withdrawal"; empty array if none
  ],
  "predicted_bounce": "turn label, or null if none",
  "strongest": "one sentence with turn citation",
  "weakest": "one sentence with turn citation",
  "recommendation": { "pattern": "kebab-case-slug", "dimension": "D2", "evidence": ["J25", "J28"], "note": "one-sentence remedy direction" }
  // recommendation is null when every dimension is a 5
}`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

/** Validate the model's JSON into a ScoreResult. Throws (without echoing
 *  content) when the shape is unusable — the route surfaces a retryable
 *  error instead of storing a malformed row. */
export function validateScoreResult(parsed: unknown): ScoreResult {
  const p = parsed as Record<string, unknown>;
  const rawDims = Array.isArray(p?.dimensions) ? p.dimensions : [];

  const dimensions: DimensionScore[] = SCORE_DIMENSIONS.map((spec) => {
    const found = (rawDims as Array<Record<string, unknown>>).find(
      (d) => d?.id === spec.id,
    );
    const score = Number(found?.score);
    if (!found || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`scorer returned invalid score for ${spec.id}`);
    }
    // The gap is the "so what" of any sub-5 score; a gap on a 5 is noise.
    const gap =
      score < 5 && typeof found.gap === "string" && found.gap.trim().length > 0
        ? found.gap.trim()
        : undefined;
    return {
      id: spec.id,
      score,
      citations: asStringArray(found.citations),
      note: typeof found.note === "string" ? found.note : "",
      ...(gap ? { gap } : {}),
    };
  });

  const signals = (p?.signals ?? {}) as Record<string, unknown>;
  const correctionCount = Number(signals.correction_count);

  const ruptures: ScoreRupture[] = (Array.isArray(p?.ruptures) ? p.ruptures : [])
    .map((r: Record<string, unknown>) => ({
      at: typeof r?.at === "string" ? r.at : "",
      type: r?.type === "withdrawal" ? ("withdrawal" as const) : ("confrontation" as const),
      repaired: r?.repaired === true,
      note: typeof r?.note === "string" ? r.note : "",
    }))
    .filter((r) => r.at.length > 0);

  // The one-per-run recommendation. Slug is normalized to kebab-case so
  // recurrence counting across runs isn't defeated by casing/spacing drift;
  // an invalid dimension falls back to the lowest-scoring one.
  let recommendation: ScoreRecommendation | null = null;
  const rawRec = p?.recommendation as Record<string, unknown> | null | undefined;
  const pattern =
    typeof rawRec?.pattern === "string"
      ? rawRec.pattern
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : "";
  if (pattern.length > 0) {
    const validIds = SCORE_DIMENSIONS.map((d) => d.id) as string[];
    const lowest = [...dimensions].sort((a, b) => a.score - b.score)[0].id;
    recommendation = {
      pattern,
      dimension: validIds.includes(rawRec?.dimension as string)
        ? (rawRec!.dimension as ScoreDimensionId)
        : lowest,
      evidence: asStringArray(rawRec?.evidence),
      note: typeof rawRec?.note === "string" ? rawRec.note : "",
    };
  }

  return {
    dimensions,
    recommendation,
    signals: {
      bare_yes_streak:
        typeof signals.bare_yes_streak === "string" ? signals.bare_yes_streak : "none",
      boundary_turn:
        typeof signals.boundary_turn === "string" ? signals.boundary_turn : "none",
      correction_count: Number.isFinite(correctionCount) ? correctionCount : 0,
    },
    ruptures,
    predicted_bounce:
      typeof p?.predicted_bounce === "string" && p.predicted_bounce.trim().length > 0
        ? p.predicted_bounce
        : null,
    strongest: typeof p?.strongest === "string" ? p.strongest : "",
    weakest: typeof p?.weakest === "string" ? p.weakest : "",
  };
}

/** One scoring run: rubric + numbered transcript → validated ScoreResult.
 *  The rubric rides in its own cached system block so a batch of runs within
 *  the cache window only pays for it once. */
export async function scoreTranscript(
  rubricText: string,
  transcript: string,
): Promise<ScoreResult> {
  const response = await anthropicFetch(
    {
      model: SCORING_MODEL,
      max_tokens: 3000,
      system: [
        { type: "text", text: buildScoringInstructions() },
        {
          type: "text",
          text: `THE SCORING RUBRIC:\n\n${rubricText}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `THE TRANSCRIPT TO SCORE:\n\n${transcript}\n\nScore it against Part 1 of the rubric. Return the JSON.`,
        },
      ],
    },
    90_000,
  );

  const cleaned = extractResponseText(response)
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  return validateScoreResult(JSON.parse(cleaned));
}
