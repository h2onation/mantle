import type { createAdminClient } from "@/lib/supabase/admin";
import { REBUILT_CHARACTER } from "@/lib/persona/voice-scaffold";
import { POST_CONFIRM_FIRST_ENTRY_SCAFFOLD } from "@/lib/persona/system-prompt";
import { SITUATION_OPENER } from "@/lib/persona/situation-copy";
import { GUIDED_INTAKE_OPENER } from "@/lib/persona/guided-intake-copy";

/**
 * Voice overrides — admin-editable replacements for a small, fixed set of
 * VOICE-text prompt fields, so the founder can tune Jove's voice live without
 * a code deploy. Backed by the `persona_voice_overrides` table (one row per
 * field), read once per turn inside loadConversationContext (folded into its
 * existing parallel DB batch) and written only via /api/admin/persona-voice.
 *
 * The code constants are the permanent floor: a field is overridden ONLY when
 * a row exists AND is enabled. Any missing row, disabled row, or DB error
 * falls back to the code default, so production behaves exactly as it does
 * today when the table is empty or unreachable. "Reset to default" is just
 * `enabled = false` — non-destructive, and the code value always returns.
 *
 * Deliberately NOT editable here (safety + system contracts; see
 * docs/voice-rebuild-proposal and the admin Voice panel's read-only section):
 * REBUILT_LIMITS (crisis 988 protocol, no-clinical-names, no-prescribing),
 * the CRISIS_PHRASES list, the "in your Manual" checkpoint contract +
 * its detector regex, REBUILT_MECHANICS (carries that contract), and the
 * OTP caps. Those stay code-only and appear read-only in the admin viewer.
 */

/** The resolved override map. Each field is present only when an enabled row
 *  overrides the code default; absent fields fall back to the constant. */
export interface VoiceOverrides {
  character?: string;
  situationOpener?: string;
  guidedIntakeOpener?: string;
  postConfirmFirstEntry?: string;
}

/**
 * Maps the `persona_voice_overrides.key` column values to VoiceOverrides
 * fields AND to the code default each one overrides. Single source of truth
 * for the valid keys (the admin route validates writes against it, the reader
 * maps rows through it, and the editor shows the default from it).
 */
export const VOICE_OVERRIDE_FIELDS: Record<
  string,
  { field: keyof VoiceOverrides; label: string; getDefault: () => string }
> = {
  rebuilt_character: {
    field: "character",
    label: "Character",
    getDefault: () => REBUILT_CHARACTER,
  },
  situation_opener: {
    field: "situationOpener",
    label: "Situation opener",
    getDefault: () => SITUATION_OPENER,
  },
  guided_intake_opener: {
    field: "guidedIntakeOpener",
    label: "Guided-intake opener",
    getDefault: () => GUIDED_INTAKE_OPENER,
  },
  post_confirm_first_entry: {
    field: "postConfirmFirstEntry",
    label: "Post-confirm line (first entry)",
    getDefault: () => POST_CONFIRM_FIRST_ENTRY_SCAFFOLD,
  },
};

export type VoiceOverrideKey = keyof typeof VOICE_OVERRIDE_FIELDS;

export function isVoiceOverrideKey(value: unknown): value is VoiceOverrideKey {
  return typeof value === "string" && value in VOICE_OVERRIDE_FIELDS;
}

/**
 * Read the current voice overrides. Fails open to {} (no overrides → all code
 * defaults) on any error, so a missing table, a dropped row, or a transient DB
 * error never changes production behavior. Pass the service-role admin client —
 * the table has no client-readable RLS policy by design. Only ENABLED rows with
 * non-empty text override; everything else falls back to the code constant at
 * the resolution site (`overrides.field ?? CONSTANT`).
 */
export async function getVoiceOverrides(
  admin: ReturnType<typeof createAdminClient>,
): Promise<VoiceOverrides> {
  try {
    const { data, error } = await admin
      .from("persona_voice_overrides")
      .select("key, text_override, enabled");
    if (error || !data) return {};

    const overrides: VoiceOverrides = {};
    for (const row of data as Array<{
      key: string;
      text_override: string | null;
      enabled: boolean;
    }>) {
      const spec = VOICE_OVERRIDE_FIELDS[row.key];
      if (!spec) continue;
      if (!row.enabled) continue;
      const text = row.text_override;
      if (typeof text !== "string" || text.trim().length === 0) continue;
      overrides[spec.field] = text;
    }
    return overrides;
  } catch {
    return {};
  }
}
