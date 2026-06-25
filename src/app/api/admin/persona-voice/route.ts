import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  isVoiceOverrideKey,
  isDoorOpenerKey,
  VOICE_OVERRIDE_FIELDS,
  DOOR_OPENER_KEYS,
  readOverrideRows,
  saveOverride,
  resetOverride,
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

// The door openers are edited through the per-door "Intake doors" panel
// (/api/admin/intake-doors), grouped with each door's intro copy. They're
// excluded here so each key has exactly one edit surface.
const CORE_VOICE_KEYS = Object.keys(VOICE_OVERRIDE_FIELDS).filter(
  (key) => !(DOOR_OPENER_KEYS as readonly string[]).includes(key),
);

// Read every editable CORE voice field — code default + current override row
// state. Admin only. Defaults come from the code constants (the permanent
// floor); the override/enabled come from persona_voice_overrides if a row
// exists.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const rows = await readOverrideRows(admin);

  const fields: VoiceFieldView[] = CORE_VOICE_KEYS.map((key) => {
    const spec = VOICE_OVERRIDE_FIELDS[key];
    const row = rows.get(key);
    return {
      key,
      label: spec.label,
      default: spec.getDefault(),
      override: row?.text_override ?? null,
      enabled: row?.enabled ?? false,
    };
  });

  return Response.json({ fields });
}

// Save or reset one core voice field. Admin only.
//   { key, text }        → save: upsert enabled=true with the new text.
//   { key, reset: true } → reset to the code default (enabled=false).
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    text?: unknown;
    reset?: unknown;
  } | null;

  if (!body || !isVoiceOverrideKey(body.key) || isDoorOpenerKey(body.key)) {
    return Response.json(
      {
        error:
          "Body must include key, one of: " + CORE_VOICE_KEYS.join(", "),
      },
      { status: 400 },
    );
  }
  const key = body.key;

  // Reset path.
  if (body.reset === true) {
    const ok = await resetOverride(admin, key, userId);
    if (!ok) {
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

  // Per-key invariant guard. None of the core fields embed a system contract
  // (CHARACTER and the post-confirm line carry no load-bearing phrase), so the
  // only guard is non-empty, already checked above. This is the seam where a
  // future MECHANICS field would plug in its required-phrase check.

  const ok = await saveOverride(admin, key, body.text, userId);
  if (!ok) {
    return Response.json({ error: "Failed to save field" }, { status: 500 });
  }
  return Response.json({ ok: true, key, enabled: true });
}
