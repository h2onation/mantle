import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Global feature gates — runtime on/off switches for ancillary Jove
 * subsystems, used to isolate the core voice + extraction loop for
 * debugging. Backed by the `feature_gates` table (one row per gate),
 * read once per turn inside loadConversationContext and written only via
 * /api/admin/feature-gates.
 *
 * Three gates cover five subsystems by sitting at chokepoints where one
 * boolean collapses a whole branch:
 *
 *   personaDeltas      OFF → composeTier2 renders base voice only (the
 *                            neutral "general" voice); the four neurotype
 *                            voice deltas never load.
 *   conversationModes  OFF → every conversation runs in "situation" mode;
 *                            guided-intake / upload entry blocks, the upload
 *                            server short-circuit, and transcript-wrap
 *                            behavior never fire.
 *   checkpoints        OFF → no checkpoint is ever detected, gated, composed,
 *                            or proposed; the checkpoint-derived Tier 3
 *                            overlays (approaching, post-suppression) also go
 *                            dark. Jove keeps naming patterns in conversation
 *                            but never proposes a Manual entry.
 *   extractionBrief    OFF → voice-only: the background Sonnet extraction call
 *                            is skipped and no brief is rendered into Jove's
 *                            prompt, so zero analysis steers the conversation.
 *                            Note: checkpoints depend on extraction state, so
 *                            with this OFF the checkpoint gate fails closed
 *                            (no entries fire) even if `checkpoints` is ON.
 *
 * Every gate defaults ON, and the read fails open to ON on any error or
 * missing row, so production behaves exactly as it does today when the
 * table is absent or unreachable. These are debug scaffolding with a
 * documented deletion condition (see the migration), not permanent forks.
 */
export interface FeatureGates {
  personaDeltas: boolean;
  conversationModes: boolean;
  checkpoints: boolean;
  extractionBrief: boolean;
}

export const DEFAULT_FEATURE_GATES: FeatureGates = {
  personaDeltas: true,
  conversationModes: true,
  checkpoints: true,
  extractionBrief: true,
};

/**
 * Maps the `feature_gates.key` column values to the FeatureGates fields.
 * This is the single source of truth for the valid gate keys — the admin
 * route validates writes against it and the reader maps rows through it.
 */
export const FEATURE_GATE_KEYS: Record<string, keyof FeatureGates> = {
  persona_deltas: "personaDeltas",
  conversation_modes: "conversationModes",
  checkpoints: "checkpoints",
  extraction_brief: "extractionBrief",
};

export type FeatureGateKey = keyof typeof FEATURE_GATE_KEYS;

export function isFeatureGateKey(value: unknown): value is FeatureGateKey {
  return typeof value === "string" && value in FEATURE_GATE_KEYS;
}

/**
 * Read the current gate state. Fails open to DEFAULT_FEATURE_GATES (all ON)
 * on any error, so a missing table, a dropped row, or a transient DB error
 * never changes production behavior. Pass the service-role admin client —
 * the table has no client-readable RLS policy by design.
 */
export async function getFeatureGates(
  admin: ReturnType<typeof createAdminClient>,
): Promise<FeatureGates> {
  try {
    const { data, error } = await admin
      .from("feature_gates")
      .select("key, enabled");
    if (error || !data) return { ...DEFAULT_FEATURE_GATES };

    const gates: FeatureGates = { ...DEFAULT_FEATURE_GATES };
    for (const row of data as Array<{ key: string; enabled: boolean }>) {
      const field = FEATURE_GATE_KEYS[row.key];
      if (field) gates[field] = row.enabled;
    }
    return gates;
  } catch {
    return { ...DEFAULT_FEATURE_GATES };
  }
}
