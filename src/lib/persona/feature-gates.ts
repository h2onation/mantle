import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Global feature gates — runtime on/off switches for ancillary Jove
 * subsystems, used to isolate the core voice + extraction loop for
 * debugging. Backed by the `feature_gates` table (one row per gate),
 * read once per turn inside loadConversationContext and written only via
 * /api/admin/feature-gates.
 *
 * These gates sit at chokepoints where one boolean collapses a whole branch:
 *
 *   personaDeltas      OFF → composeTier2 renders base voice only (the
 *                            neutral "general" voice); the four neurotype
 *                            voice deltas never load.
 *   situation          OFF → the Situation entry door renders disabled
 *                            ("Coming soon") and new / fallback conversations
 *                            resolve to the next enabled mode (guided, then
 *                            upload). Situation remains the engine's ULTIMATE
 *                            hard floor: if every mode gate is off, conversations
 *                            still run "situation" so they're never mode-less.
 *                            Default ON — turning it off enables a guided-solo
 *                            (or upload-solo) configuration.
 *   guidedIntake       OFF → the Guided entry path falls back to the first
 *                            enabled mode: the guided-intake Tier 3 block +
 *                            section-picker handoff never fire, and the Home
 *                            "Guided" door renders disabled ("Coming soon").
 *   upload             OFF → the Upload entry path falls back to the first
 *                            enabled mode: the upload server short-circuit +
 *                            transcript-wrap behavior never fire, and the Home
 *                            "Upload" door renders disabled ("Coming soon").
 *   extractionBrief    OFF → voice-only: the background Sonnet extraction call
 *                            is skipped, so nothing is analyzed and the save-time
 *                            composer gets no accumulated understanding.
 *
 * These debug gates default ON, and the read fails open to ON on any error or
 * missing row, so production behaves exactly as it does today when the table is
 * absent or unreachable. They are debug scaffolding with a documented deletion
 * condition (see the migration), not permanent forks.
 */
export interface FeatureGates {
  personaDeltas: boolean;
  situation: boolean;
  guidedIntake: boolean;
  upload: boolean;
  extractionBrief: boolean;
}

export const DEFAULT_FEATURE_GATES: FeatureGates = {
  personaDeltas: true,
  situation: true,
  guidedIntake: true,
  upload: true,
  extractionBrief: true,
};

/**
 * Maps the `feature_gates.key` column values to the FeatureGates fields.
 * This is the single source of truth for the valid gate keys — the admin
 * route validates writes against it and the reader maps rows through it.
 */
export const FEATURE_GATE_KEYS: Record<string, keyof FeatureGates> = {
  persona_deltas: "personaDeltas",
  situation: "situation",
  guided_intake: "guidedIntake",
  upload: "upload",
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
