import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  readOverrideRows,
  saveOverride,
  resetOverride,
} from "@/lib/persona/voice-overrides";
import { readRubricDefault, rubricSha, SCORING_RUBRIC_KEY } from "@/lib/scoring/rubric";

// The scoring rubric's edit surface — same override system as the conductor
// prompt (persona_voice_overrides + history), same floor semantics (the repo
// doc is the code default; reset = enabled=false). Separate route because the
// persona-voice route's key registry (VOICE_OVERRIDE_FIELDS) is edge-read on
// every chat turn and its defaults are sync code constants — this default is
// a file read only admin needs. nodejs runtime for that read.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  try {
    const [rows, defaultText] = await Promise.all([
      readOverrideRows(admin),
      readRubricDefault(),
    ]);
    const row = rows.get(SCORING_RUBRIC_KEY);
    return Response.json({
      field: {
        key: SCORING_RUBRIC_KEY,
        label: "Scoring rubric (conversation quality)",
        default: defaultText,
        override: row?.text_override ?? null,
        enabled: row?.enabled ?? false,
      },
      defaultSha: rubricSha(defaultText),
    });
  } catch (err) {
    console.error("[admin/scoring-rubric] GET error:", err);
    return Response.json({ error: "Failed to load rubric" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  try {
    const body = await request.json().catch(() => ({}));

    if (body?.reset === true) {
      const ok = await resetOverride(admin, SCORING_RUBRIC_KEY, userId);
      if (!ok) return Response.json({ error: "Reset failed" }, { status: 500 });
      return Response.json({ ok: true });
    }

    const text = body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return Response.json({ error: "text is required" }, { status: 400 });
    }
    const ok = await saveOverride(admin, SCORING_RUBRIC_KEY, text, userId);
    if (!ok) return Response.json({ error: "Save failed" }, { status: 500 });
    return Response.json({ ok: true, sha: rubricSha(text) });
  } catch (err) {
    console.error("[admin/scoring-rubric] PATCH error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
