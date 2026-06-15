import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  isVoiceOverrideKey,
  VOICE_OVERRIDE_FIELDS,
} from "@/lib/persona/voice-overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One editable voice field, as the admin panel needs it: the code default
// (always shown), the current override text (if any), and whether it's live.
interface VoiceFieldView {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

// Read every editable voice field — code default + current override row state.
// Admin only. The defaults come from the code constants (the permanent floor);
// the override/enabled come from persona_voice_overrides if a row exists.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const { data } = await admin
    .from("persona_voice_overrides")
    .select("key, text_override, enabled");
  const rows = new Map<string, { text_override: string | null; enabled: boolean }>(
    (data ?? []).map((r: { key: string; text_override: string | null; enabled: boolean }) => [
      r.key,
      { text_override: r.text_override, enabled: r.enabled },
    ]),
  );

  const fields: VoiceFieldView[] = Object.entries(VOICE_OVERRIDE_FIELDS).map(
    ([key, spec]) => {
      const row = rows.get(key);
      return {
        key,
        label: spec.label,
        default: spec.getDefault(),
        override: row?.text_override ?? null,
        enabled: row?.enabled ?? false,
      };
    },
  );

  return Response.json({ fields });
}

// Save or reset one voice field. Admin only.
//   { key, text }        → save: upsert enabled=true with the new text, after
//                          a per-key invariant check. Records the change in
//                          persona_voice_override_history (old → new).
//   { key, reset: true } → reset to the code default: set enabled=false
//                          (non-destructive; the prior text stays for history).
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    text?: unknown;
    reset?: unknown;
  } | null;

  if (!body || !isVoiceOverrideKey(body.key)) {
    return Response.json(
      {
        error:
          "Body must include key, one of: " +
          Object.keys(VOICE_OVERRIDE_FIELDS).join(", "),
      },
      { status: 400 },
    );
  }
  const key = body.key;

  // Reset path: flip the row off so the code default resolves again. We keep
  // the row (and its text) so history and a later re-enable are intact.
  if (body.reset === true) {
    const { error } = await admin
      .from("persona_voice_overrides")
      .update({ enabled: false, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("key", key);
    if (error) {
      return Response.json({ error: "Failed to reset field" }, { status: 500 });
    }
    return Response.json({ ok: true, key, enabled: false });
  }

  // Save path.
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return Response.json(
      { error: "text must be a non-empty string (or pass reset:true)" },
      { status: 400 },
    );
  }
  const text = body.text;

  // Per-key invariant guard. None of the v1 fields embed a system contract
  // (CHARACTER and the openers/post-confirm line carry no load-bearing
  // phrase), so the only guard is non-empty, already checked above. This is
  // the seam where a future MECHANICS field would plug in its required-phrase
  // check (reusing detect-checkpoint.ts's regex as the single source of
  // truth) — see voice-overrides.ts.

  // Read the prior text so the history row records old → new.
  const { data: prior } = await admin
    .from("persona_voice_overrides")
    .select("text_override")
    .eq("key", key)
    .maybeSingle();
  const oldText = (prior as { text_override: string | null } | null)?.text_override ?? null;

  const { error: upsertError } = await admin
    .from("persona_voice_overrides")
    .upsert(
      {
        key,
        text_override: text,
        enabled: true,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "key" },
    );
  if (upsertError) {
    return Response.json({ error: "Failed to save field" }, { status: 500 });
  }

  // Append the audit row. Best-effort: a history-write failure must not fail
  // the save itself (the override is already live). Never log the text — only
  // the key, per the security rules.
  const { error: historyError } = await admin
    .from("persona_voice_override_history")
    .insert({ key, old_text: oldText, new_text: text, updated_by: userId });
  if (historyError) {
    console.warn("[persona-voice] history write failed for key=%s", key);
  }

  return Response.json({ ok: true, key, enabled: true });
}
