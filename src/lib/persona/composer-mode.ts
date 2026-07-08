import type { createAdminClient } from "@/lib/supabase/admin";

// COMPOSER_MODE — which composer writes the Manual entry on pull. A/B test
// scaffolding (see compose-as-conductor.ts): the loser mode + this whole module
// are deleted once a winner is picked.
//
//   composer   — the separate composer re-reads the transcript (composeManualEntry)
//   conductor  — the conductor writes it from full live context (composeEntryAsConductor)
//   compare    — run both, show two candidates, the founder picks one
//
// Resolution order, so the founder can flip it LIVE with no redeploy:
//   1. the admin toggle — an enabled `composer_mode` row in persona_voice_overrides
//      (Feature gates page → /api/admin/composer-mode). Reuses the generic
//      override store (value + enabled + history) so there's no new table.
//   2. the COMPOSER_MODE env var (Vercel / .env.local) — the pre-toggle fallback.
//   3. "composer" — the shipped default (the classic behavior).

export const COMPOSER_MODES = ["composer", "conductor", "compare"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

export const DEFAULT_COMPOSER_MODE: ComposerMode = "composer";

/** The persona_voice_overrides row key the admin toggle writes. */
export const COMPOSER_MODE_KEY = "composer_mode";

/** Coerce arbitrary input to a valid ComposerMode, or null. */
export function normalizeComposerMode(value: unknown): ComposerMode | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (COMPOSER_MODES as readonly string[]).includes(v)
    ? (v as ComposerMode)
    : null;
}

/** The env-var fallback (COMPOSER_MODE), or null if unset/invalid. */
export function envComposerMode(): ComposerMode | null {
  return normalizeComposerMode(process.env.COMPOSER_MODE);
}

/**
 * Resolve the live composer mode. An enabled admin-toggle row wins; otherwise
 * the env var; otherwise the shipped default. Fails safe to the default on any
 * DB error (so a missing table / transient error never breaks the pull). Pass
 * the service-role admin client — the table has no client-readable RLS.
 */
export async function getComposerMode(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ComposerMode> {
  try {
    const { data } = await admin
      .from("persona_voice_overrides")
      .select("text_override, enabled")
      .eq("key", COMPOSER_MODE_KEY)
      .maybeSingle();
    if (data?.enabled) {
      const m = normalizeComposerMode(data.text_override);
      if (m) return m;
    }
  } catch {
    // fall through to env / default
  }
  return envComposerMode() ?? DEFAULT_COMPOSER_MODE;
}
