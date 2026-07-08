// The six scoring dimensions from docs/reference/conductor-scoring.md Part 1.
// Client-safe (no server imports): the admin UI renders labels from here and
// the scorer validates result shape against the ids. If the rubric's Part 1
// dimension set ever changes, update this list and the rubric doc together.

export const SCORE_DIMENSIONS = [
  { id: "D1", label: "Earned shape before landing" },
  { id: "D2", label: "Formulation discipline" },
  { id: "D3", label: "Workshopping shape" },
  { id: "D4", label: "Push calibration" },
  { id: "D5", label: "Grounding and edge-seeking" },
  { id: "D6", label: "User's-words fidelity and register" },
] as const;

export type ScoreDimensionId = (typeof SCORE_DIMENSIONS)[number]["id"];

export interface DimensionScore {
  id: ScoreDimensionId;
  score: number; // 1–5
  citations: string[]; // turn labels, e.g. "U18", "J25"
  note: string;
  /** Scores under 5 only: the 5-anchor behavior that was missing at the
   *  cited turn — the "so what" of the number. Absent on 5s. */
  gap?: string;
}

/** The single biggest lever from one scoring run — a ledger-style candidate
 *  (stable pattern slug + evidence + remedy direction), NOT a prompt edit.
 *  Recommendations become trustworthy through recurrence: the Tuning panel
 *  counts slugs across runs, and promotion into the prompt stays a founder
 *  decision (soak governance — recurring failures earn lines, one run never
 *  does). */
export interface ScoreRecommendation {
  pattern: string; // kebab-case failure-shape slug, stable across runs
  dimension: ScoreDimensionId;
  evidence: string[]; // turn labels
  note: string; // one-sentence remedy direction
}

export interface ScoreRupture {
  at: string;
  type: "confrontation" | "withdrawal";
  repaired: boolean;
  note: string;
}

/** The validated scorer output stored in conversation_scores.result. */
export interface ScoreResult {
  dimensions: DimensionScore[];
  signals: {
    bare_yes_streak: string;
    boundary_turn: string;
    correction_count: number;
  };
  ruptures: ScoreRupture[];
  predicted_bounce: string | null;
  strongest: string;
  weakest: string;
  /** One per run, or null when there is no meaningful lever (all 5s). */
  recommendation: ScoreRecommendation | null;
}

/** Mean of the six dimension scores, one decimal. */
export function scoreAverage(result: ScoreResult): number {
  const sum = result.dimensions.reduce((a, d) => a + d.score, 0);
  return Math.round((sum / result.dimensions.length) * 10) / 10;
}
