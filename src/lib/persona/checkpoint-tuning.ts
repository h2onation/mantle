import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Checkpoint tuning — admin-editable thresholds that decide WHEN a checkpoint
 * fires, so the founder can dial Jove's eagerness live without a code deploy.
 * Backed by the single-row `checkpoint_tuning` table, read once per turn inside
 * loadConversationContext (folded into its existing parallel DB batch) and
 * written only via /api/admin/checkpoint-tuning.
 *
 * The code constants (CHECKPOINT_TUNING_DEFAULTS) are the permanent floor: a
 * column is honored ONLY when it holds a non-null, in-range value. Any null,
 * out-of-range, or DB-error case resolves to the code default, so a missing or
 * empty row behaves exactly as production does today.
 *
 * These dials move EAGERNESS only. The quality gates (has_mechanism, charged
 * language, pattern_engaged, crisis) stay locked in code — no admin value can
 * lower the quality floor or open the door to junk entries.
 */

/** The five conversation-depth levels, shallow → deep. Single source of truth
 *  for the depth comparison in persona-pipeline (DEPTH_ORDER) and the depth_floor
 *  dial's allowed values. */
export const DEPTH_LEVELS = [
  "surface",
  "behavior",
  "feeling",
  "mechanism",
  "origin",
] as const;
export type DepthLevel = (typeof DEPTH_LEVELS)[number];

export interface CheckpointTuning {
  /** How many concrete, narrated scenes the user must give before a proposal. */
  minScenes: number;
  /** Minimum user turns between checkpoints (anti-spam cooldown). */
  cooldownTurns: number;
  /** Fire even if the engagement signal never trips, once past this turn. */
  failsafeTurn: number;
  /** How deep the conversation must descend before a checkpoint can fire. */
  depthFloor: DepthLevel;
}

/**
 * Single source of truth for the four dials: the DB column each maps to, its
 * UI label, its kind + bounds (numbers) or options (enum), and its code
 * default. The getter resolves through it, the admin route validates writes
 * against it, and the panel renders from it.
 */
export const CHECKPOINT_TUNING_FIELDS = {
  minScenes: {
    column: "min_scenes",
    label: "Examples before proposing",
    help: "Specific, real-life moments the user must describe before Jove offers to save an entry. Lower fires sooner.",
    kind: "int",
    min: 1,
    max: 5,
    default: 2,
  },
  cooldownTurns: {
    column: "cooldown_turns",
    label: "Messages between entries",
    help: "After an entry is saved, how many of the user's messages must pass before Jove can propose another. Stops back-to-back proposals. Lower proposes again sooner.",
    kind: "int",
    min: 0,
    max: 20,
    default: 5,
  },
  failsafeTurn: {
    column: "failsafe_turn",
    label: "Propose-anyway after (messages)",
    help: "Jove normally waits until it detects a real behavioral pattern. If that never happens, it may propose anyway once the user passes this message count — the quality floor still applies. Higher waits longer.",
    kind: "int",
    min: 3,
    max: 40,
    default: 12,
  },
  depthFloor: {
    column: "depth_floor",
    label: "Minimum depth",
    help: "How far past 'what happened' the talk must go before Jove can propose. Deeper = more conservative.",
    kind: "enum",
    options: DEPTH_LEVELS,
    default: "mechanism",
  },
} as const;

export type CheckpointTuningField = keyof typeof CHECKPOINT_TUNING_FIELDS;

/** The permanent code floor — derived from the field map so there's one place
 *  a default is written. */
export const CHECKPOINT_TUNING_DEFAULTS: CheckpointTuning = {
  minScenes: CHECKPOINT_TUNING_FIELDS.minScenes.default,
  cooldownTurns: CHECKPOINT_TUNING_FIELDS.cooldownTurns.default,
  failsafeTurn: CHECKPOINT_TUNING_FIELDS.failsafeTurn.default,
  depthFloor: CHECKPOINT_TUNING_FIELDS.depthFloor.default,
};

export function isCheckpointTuningField(
  value: unknown,
): value is CheckpointTuningField {
  return typeof value === "string" && value in CHECKPOINT_TUNING_FIELDS;
}

export function isDepthLevel(value: unknown): value is DepthLevel {
  return typeof value === "string" && (DEPTH_LEVELS as readonly string[]).includes(value);
}

/** Resolve one integer dial: honor the stored value only if it's an integer in
 *  range; otherwise fall back to the code default (fail-safe). */
function resolveInt(
  raw: unknown,
  spec: { min: number; max: number; default: number },
): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return spec.default;
  if (raw < spec.min || raw > spec.max) return spec.default;
  return raw;
}

/**
 * Read the current checkpoint tuning. Fails open to CHECKPOINT_TUNING_DEFAULTS
 * on any error, missing row, null column, or out-of-range value, so a missing
 * table or a transient DB error never changes production behavior. Pass the
 * service-role admin client — the table has no client-readable RLS policy by
 * design.
 */
export async function getCheckpointTuning(
  admin: ReturnType<typeof createAdminClient>,
): Promise<CheckpointTuning> {
  try {
    const { data, error } = await admin
      .from("checkpoint_tuning")
      .select("min_scenes, cooldown_turns, failsafe_turn, depth_floor")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return { ...CHECKPOINT_TUNING_DEFAULTS };

    const row = data as {
      min_scenes: number | null;
      cooldown_turns: number | null;
      failsafe_turn: number | null;
      depth_floor: string | null;
    };
    return {
      minScenes: resolveInt(row.min_scenes, CHECKPOINT_TUNING_FIELDS.minScenes),
      cooldownTurns: resolveInt(
        row.cooldown_turns,
        CHECKPOINT_TUNING_FIELDS.cooldownTurns,
      ),
      failsafeTurn: resolveInt(
        row.failsafe_turn,
        CHECKPOINT_TUNING_FIELDS.failsafeTurn,
      ),
      depthFloor: isDepthLevel(row.depth_floor)
        ? row.depth_floor
        : CHECKPOINT_TUNING_DEFAULTS.depthFloor,
    };
  } catch {
    return { ...CHECKPOINT_TUNING_DEFAULTS };
  }
}
