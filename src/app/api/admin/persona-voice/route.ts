import { requireAdmin } from "@/lib/admin/verify-admin";
import { validateConductorPromptEdit } from "@/lib/persona/conductor-prompt";
import { buildComposerSystemPrompt } from "@/lib/persona/confirm-checkpoint";
import {
  isVoiceOverrideKey,
  VOICE_OVERRIDE_FIELDS,
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

// Every voice-override key is edited here. (The per-door opener keys were
// retired with the modules cutover — module openers live on the modules
// table, edited at /admin/modules.)
const CORE_VOICE_KEYS = Object.keys(VOICE_OVERRIDE_FIELDS);

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

  // The composer's full system prompt for the Tuning page's read-only view,
  // rendered from the SAME function the live call uses (one source of truth).
  // The bar is shown as a placeholder token — its live text is edited in its
  // own field on that page, so it isn't duplicated inside the display.
  const composerPrompt = buildComposerSystemPrompt(
    "[ ENTRY VOICE — THE BAR: the editable standard below is inserted here ]",
  );

  // Override status across ALL keys (including door openers edited elsewhere):
  // the Tuning page's "is anything masking code right now?" strip. Status
  // only — no override text (the door openers keep their own edit surface).
  // The scoring rubric rides along by name: it lives in the same table but
  // outside VOICE_OVERRIDE_FIELDS (its default is a file read, node-only —
  // see /api/admin/scoring-rubric), and an enabled override masks doc edits
  // the same way the voice keys mask code.
  const overrideStatus = [
    ...Object.keys(VOICE_OVERRIDE_FIELDS).map((key) => ({
      key,
      label: VOICE_OVERRIDE_FIELDS[key].label,
      enabled: rows.get(key)?.enabled ?? false,
    })),
    {
      key: "scoring_rubric",
      label: "Scoring rubric (conversation quality)",
      enabled: rows.get("scoring_rubric")?.enabled ?? false,
    },
  ];

  return Response.json({ fields, composerPrompt, overrideStatus });
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

  if (!body || !isVoiceOverrideKey(body.key)) {
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

  // Per-key invariant guard. The conductor prompt is the one field that embeds
  // system contracts (crisis resources + the two hidden UI markers) — an edit
  // that drops any of them is rejected with a plain-language error naming what
  // went missing. The other core fields carry no load-bearing phrase; their
  // only guard is non-empty, already checked above.
  if (key === "conductor_prompt") {
    const invalid = validateConductorPromptEdit(body.text);
    if (invalid) {
      return Response.json({ error: invalid }, { status: 400 });
    }
  }

  const ok = await saveOverride(admin, key, body.text, userId);
  if (!ok) {
    return Response.json({ error: "Failed to save field" }, { status: 500 });
  }
  return Response.json({ ok: true, key, enabled: true });
}
