import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Checkpoint tuning — admin-editable settings backed by the single-row
 * `checkpoint_tuning` table, read once per turn inside loadConversationContext
 * (folded into its existing parallel DB batch) and written only via
 * /api/admin/checkpoint-tuning.
 *
 * The code constants (CHECKPOINT_TUNING_DEFAULTS) are the permanent floor: a
 * column is honored ONLY when it holds a non-null, in-range value. Any null,
 * out-of-range, or DB-error case resolves to the code default, so a missing or
 * empty row behaves exactly as production does today.
 *
 * Only `cooldownTurns` remains live: it caps the reflection meter's post-save
 * recharge (reflectionMeterFill). The push-model firing dials (min_scenes,
 * failsafe_turn, depth_floor) were removed 2026-07-03 with the Jove-pushed
 * checkpoint path (Wave 3 ship 2); their DB columns are left in place, unread.
 */

/** The five conversation-depth levels, shallow → deep. Single source of truth
 *  for the depth ordering read by extraction's monotonic depth guard
 *  (mergeExtractionState). No longer a tuning dial — kept here as the canonical
 *  depth vocabulary. */
export const DEPTH_LEVELS = [
  "surface",
  "behavior",
  "feeling",
  "mechanism",
  "origin",
] as const;
export type DepthLevel = (typeof DEPTH_LEVELS)[number];

export interface CheckpointTuning {
  /** Minimum user turns between saves — caps the reflection meter's post-save
   *  recharge so the bar rebuilds over a few turns rather than snapping back. */
  cooldownTurns: number;
}

/**
 * Single source of truth for the tuning dial(s): the DB column each maps to, its
 * UI label, its kind + bounds, and its code default. The getter resolves through
 * it, the admin route validates writes against it, and the panel renders from it.
 */
export const CHECKPOINT_TUNING_FIELDS = {
  cooldownTurns: {
    column: "cooldown_turns",
    label: "Messages between entries",
    help: "After an entry is saved, how many of the user's messages must pass before the reflection meter recharges. Stops the bar snapping straight back to full. Lower recharges sooner.",
    kind: "int",
    min: 0,
    max: 20,
    default: 5,
  },
} as const;

export type CheckpointTuningField = keyof typeof CHECKPOINT_TUNING_FIELDS;

/** The permanent code floor — derived from the field map so there's one place
 *  a default is written. */
export const CHECKPOINT_TUNING_DEFAULTS: CheckpointTuning = {
  cooldownTurns: CHECKPOINT_TUNING_FIELDS.cooldownTurns.default,
};

export function isCheckpointTuningField(
  value: unknown,
): value is CheckpointTuningField {
  return typeof value === "string" && value in CHECKPOINT_TUNING_FIELDS;
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
      .select("cooldown_turns")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return { ...CHECKPOINT_TUNING_DEFAULTS };

    const row = data as {
      cooldown_turns: number | null;
    };
    return {
      cooldownTurns: resolveInt(
        row.cooldown_turns,
        CHECKPOINT_TUNING_FIELDS.cooldownTurns,
      ),
    };
  } catch {
    return { ...CHECKPOINT_TUNING_DEFAULTS };
  }
}
