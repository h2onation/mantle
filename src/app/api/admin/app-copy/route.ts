import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  readOverrideRows,
  saveOverride,
  resetOverride,
  type OverrideRow,
} from "@/lib/persona/voice-overrides";
import {
  APP_COPY_FIELDS,
  APP_COPY_GROUPS,
  isAppCopyKey,
} from "@/lib/persona/app-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FieldView {
  key: string;
  label: string;
  group: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

function fieldView(key: string, rows: Map<string, OverrideRow>): FieldView {
  const spec = APP_COPY_FIELDS[key];
  const row = rows.get(key);
  return {
    key,
    label: spec.label,
    group: spec.group,
    default: spec.getDefault(),
    override: row?.text_override ?? null,
    enabled: row?.enabled ?? false,
  };
}

// Return every onboarding/Home copy field — its code default + current override
// state — ordered by group so the panel can render labelled sections. Admin only.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const rows = await readOverrideRows(admin);

  // Group order follows APP_COPY_GROUPS; within a group, registry insertion order.
  const keys = Object.keys(APP_COPY_FIELDS);
  const fields: FieldView[] = APP_COPY_GROUPS.flatMap((group) =>
    keys.filter((k) => APP_COPY_FIELDS[k].group === group).map((k) => fieldView(k, rows)),
  );

  return Response.json({ fields });
}

// Save or reset one copy field. Admin only.
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

  if (!body || !isAppCopyKey(body.key)) {
    return Response.json(
      { error: "Body must include a valid app-copy key" },
      { status: 400 },
    );
  }
  const key = body.key as string;

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
