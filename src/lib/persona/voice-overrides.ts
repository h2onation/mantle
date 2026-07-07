import type { createAdminClient } from "@/lib/supabase/admin";
import {
  CONDUCTOR_PROMPT,
  FIRST_ENTRY_EDUCATION,
} from "@/lib/persona/conductor-prompt";
import { POST_CONFIRM_FIRST_ENTRY_SCAFFOLD } from "@/lib/persona/system-prompt";
import { SITUATION_OPENER } from "@/lib/persona/situation-copy";
import { UPLOAD_OPENER } from "@/lib/persona/upload-copy";
import { COMPOSER_ENTRY_BAR } from "@/lib/persona/confirm-checkpoint";

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
 * The conductor prompt itself (Jove's whole 1:1 personality) is editable as
 * ONE document via the `conductor_prompt` key — but a save that drops a
 * non-negotiable line (crisis 988/741741, the ---reflection-ready--- and
 * ---chips--- markers) is rejected at the API by validateConductorPromptEdit
 * (conductor-prompt.ts). Still code-only: the CRISIS_PHRASES pipeline
 * detector, the composer's entry structure/schema rules, and the OTP caps.
 */

/** The resolved override map. Each field is present only when an enabled row
 *  overrides the code default; absent fields fall back to the constant. */
export interface VoiceOverrides {
  /** The whole conductor prompt (Jove's 1:1 personality) as one document.
   *  Applied as the `tier1` block in buildSystemPromptBlocks; absent falls
   *  back to CONDUCTOR_PROMPT. Guarded at save by validateConductorPromptEdit. */
  conductorPrompt?: string;
  situationOpener?: string;
  uploadOpener?: string;
  postConfirmFirstEntry?: string;
  /** The composer's editable depth standard (THE BAR) — how an entry should
   *  read. Threaded into composeManualEntry; the entry's structure, schema, and
   *  safety rules stay code-only. */
  composerEntryBar?: string;
  /** The one-time first-entry orientation Jove speaks when readiness first
   *  lands for a user with an empty Manual. Injected into the prompt's dynamic
   *  tail by buildSystemPromptBlocks only on qualifying turns; absent falls
   *  back to FIRST_ENTRY_EDUCATION (conductor-prompt.ts). */
  firstEntryEducation?: string;
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
  conductor_prompt: {
    field: "conductorPrompt",
    label: "Jove's prompt (the conductor — the whole 1:1 voice)",
    getDefault: () => CONDUCTOR_PROMPT,
  },
  situation_opener: {
    field: "situationOpener",
    label: "Situation opener",
    getDefault: () => SITUATION_OPENER,
  },
  upload_opener: {
    field: "uploadOpener",
    label: "Upload opener",
    getDefault: () => UPLOAD_OPENER,
  },
  post_confirm_first_entry: {
    field: "postConfirmFirstEntry",
    label: "Post-confirm line (first entry)",
    getDefault: () => POST_CONFIRM_FIRST_ENTRY_SCAFFOLD,
  },
  composer_entry_bar: {
    field: "composerEntryBar",
    label: "Entry voice — the bar (composer)",
    getDefault: () => COMPOSER_ENTRY_BAR,
  },
  first_entry_education: {
    field: "firstEntryEducation",
    label: "First-entry orientation (Jove's one-time education)",
    getDefault: () => FIRST_ENTRY_EDUCATION,
  },
};

export type VoiceOverrideKey = keyof typeof VOICE_OVERRIDE_FIELDS;

export function isVoiceOverrideKey(value: unknown): value is VoiceOverrideKey {
  return typeof value === "string" && value in VOICE_OVERRIDE_FIELDS;
}

/**
 * The door-opener keys with a FIXED, editable opening message. These are still
 * resolved by the prompt reader (getVoiceOverrides) like any other voice
 * field, but they're EDITED through the per-door "Intake doors" admin panel
 * (grouped with each door's intro copy), not the generic Voice editor — so
 * each key has exactly one edit surface. (Guided-intake is absent: its opener
 * is a model-generated tee-up, not a fixed string.)
 */
export const DOOR_OPENER_KEYS = ["situation_opener", "upload_opener"] as const;

export function isDoorOpenerKey(value: unknown): value is (typeof DOOR_OPENER_KEYS)[number] {
  return typeof value === "string" && (DOOR_OPENER_KEYS as readonly string[]).includes(value);
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

// ---------------------------------------------------------------------------
// Shared row read/write for the persona_voice_overrides table. Both admin
// routes (persona-voice for core voice, intake-doors for per-door copy) write
// the same table the same way — one source of truth for the upsert + audit
// logic so the two routes can't drift. Callers own key validation against
// their own registry before calling these.
// ---------------------------------------------------------------------------

export interface OverrideRow {
  text_override: string | null;
  enabled: boolean;
}

/** Read override rows as a key→{text_override, enabled} map. Empty map on error. */
export async function readOverrideRows(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Map<string, OverrideRow>> {
  const { data } = await admin
    .from("persona_voice_overrides")
    .select("key, text_override, enabled");
  return new Map(
    (data ?? []).map((r: { key: string } & OverrideRow) => [
      r.key,
      { text_override: r.text_override, enabled: r.enabled },
    ]),
  );
}

/**
 * Save one override: upsert enabled=true with the new text, then append the
 * old→new audit row (best-effort — a history failure never fails the save).
 * Returns true on success. Never logs the text, only the key (security rule).
 */
export async function saveOverride(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  text: string,
  userId: string,
): Promise<boolean> {
  const { data: prior } = await admin
    .from("persona_voice_overrides")
    .select("text_override")
    .eq("key", key)
    .maybeSingle();
  const oldText = (prior as { text_override: string | null } | null)?.text_override ?? null;

  const { error } = await admin.from("persona_voice_overrides").upsert(
    {
      key,
      text_override: text,
      enabled: true,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "key" },
  );
  if (error) return false;

  const { error: historyError } = await admin
    .from("persona_voice_override_history")
    .insert({ key, old_text: oldText, new_text: text, updated_by: userId });
  if (historyError) {
    console.warn("[voice-overrides] history write failed for key=%s", key);
  }
  return true;
}

/**
 * Reset one override to the code default: flip the row off (non-destructive —
 * the text stays for history and a later re-enable). Returns true on success.
 */
export async function resetOverride(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  userId: string,
): Promise<boolean> {
  const { error } = await admin
    .from("persona_voice_overrides")
    .update({ enabled: false, updated_at: new Date().toISOString(), updated_by: userId })
    .eq("key", key);
  return !error;
}
