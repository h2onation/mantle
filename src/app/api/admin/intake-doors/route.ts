import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  VOICE_OVERRIDE_FIELDS,
  DOOR_OPENER_KEYS,
  readOverrideRows,
  saveOverride,
  resetOverride,
  type OverrideRow,
} from "@/lib/persona/voice-overrides";
import {
  DOORS,
  DOOR_INTRO_FIELDS,
  introTitleKey,
  introBodyKey,
} from "@/lib/persona/door-intros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every key this panel may edit: the three door openers (resolved by the
// prompt reader) plus each door's intro title/body (UI copy). Single source
// of truth for PATCH validation.
const EDITABLE_KEYS = new Set<string>([
  ...DOOR_OPENER_KEYS,
  ...Object.keys(DOOR_INTRO_FIELDS),
]);

interface FieldView {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

function fieldView(
  key: string,
  label: string,
  getDefault: () => string,
  rows: Map<string, OverrideRow>,
): FieldView {
  const row = rows.get(key);
  return {
    key,
    label,
    default: getDefault(),
    override: row?.text_override ?? null,
    enabled: row?.enabled ?? false,
  };
}

// One door's editable config, grouped for the admin panel. `opener` is null
// for guided-intake — its opening message is a model-generated tee-up, not a
// fixed editable string, so there's no opener field to surface.
interface DoorView {
  mode: string;
  name: string;
  opener: FieldView | null;
  openerNote?: string;
  title: FieldView;
  body: FieldView;
}

// Read per-door config: opener (when fixed) + intro title + intro body for
// every door, each with its code default + current override state. Admin only.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const rows = await readOverrideRows(admin);

  const doors: DoorView[] = DOORS.map((d) => {
    const titleKey = introTitleKey(d.slug);
    const bodyKey = introBodyKey(d.slug);
    return {
      mode: d.mode,
      name: d.name,
      opener: d.openerKey
        ? fieldView(
            d.openerKey,
            "Opening message",
            VOICE_OVERRIDE_FIELDS[d.openerKey].getDefault,
            rows,
          )
        : null,
      openerNote: d.openerKey
        ? undefined
        : "Jove generates this door's opener live (a guided tee-up) — no fixed text to edit.",
      title: fieldView(
        titleKey,
        "Intro title",
        DOOR_INTRO_FIELDS[titleKey].getDefault,
        rows,
      ),
      body: fieldView(
        bodyKey,
        "Intro body",
        DOOR_INTRO_FIELDS[bodyKey].getDefault,
        rows,
      ),
    };
  });

  return Response.json({ doors });
}

// Save or reset one per-door field. Admin only.
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

  if (!body || typeof body.key !== "string" || !EDITABLE_KEYS.has(body.key)) {
    return Response.json(
      { error: "Body must include a valid per-door key" },
      { status: 400 },
    );
  }
  const key = body.key;

  if (body.reset === true) {
    const ok = await resetOverride(admin, key, userId);
    if (!ok) {
      return Response.json({ error: "Failed to reset field" }, { status: 500 });
    }
    return Response.json({ ok: true, key, enabled: false });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return Response.json(
      { error: "text must be a non-empty string (or pass reset:true)" },
      { status: 400 },
    );
  }

  const ok = await saveOverride(admin, key, body.text, userId);
  if (!ok) {
    return Response.json({ error: "Failed to save field" }, { status: 500 });
  }
  return Response.json({ ok: true, key, enabled: true });
}
