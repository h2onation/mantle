import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Global feature gates — runtime on/off switches for ancillary Jove
 * subsystems, used to isolate the core voice + extraction loop for
 * debugging. Backed by the `feature_gates` table (one row per gate),
 * read once per turn inside loadConversationContext and written only via
 * /api/admin/feature-gates.
 *
 * One gate remains after the modules cutover (the three per-mode door gates
 * were deleted 2026-07-15 — a module's own `enabled` flag is the only door
 * switch now, edited at /admin/modules):
 *
 *   extractionBrief    OFF → voice-only: the background Sonnet extraction call
 *                            is skipped, so nothing is analyzed and the save-time
 *                            composer gets no accumulated understanding.
 *
 * The gate defaults ON, and the read fails open to ON on any error or missing
 * row, so production behaves exactly as it does today when the table is
 * absent or unreachable. Debug scaffolding with a documented deletion
 * condition (see the migration), not a permanent fork.
 */
export interface FeatureGates {
  extractionBrief: boolean;
}

export const DEFAULT_FEATURE_GATES: FeatureGates = {
  extractionBrief: true,
};

/**
 * Maps the `feature_gates.key` column values to the FeatureGates fields.
 * This is the single source of truth for the valid gate keys — the admin
 * route validates writes against it and the reader maps rows through it.
 */
export const FEATURE_GATE_KEYS: Record<string, keyof FeatureGates> = {
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
