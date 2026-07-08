export const runtime = "edge";

import { requireAdmin } from "@/lib/admin/verify-admin";
import { LAYERS } from "@/lib/manual/layers";
import { POPULATE_FIXTURES } from "./fixtures";

// Fixtures keyed by section slug. The picker sends section display indices
// (1-5); each maps to its slug via LAYERS, then to the fixture for that section.
const FIXTURE_BY_SECTION = new Map(
  POPULATE_FIXTURES.map((f) => [f.section, f])
);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  const { layers } = (await request.json()) as { layers: number[] };

  if (!layers || !Array.isArray(layers) || layers.length === 0) {
    return Response.json({ error: "layers array required" }, { status: 400 });
  }

  // Validate picker indices (1-5, one per section in display order).
  const validLayers = layers.filter((l) => l >= 1 && l <= 5);
  if (validLayers.length === 0) {
    return Response.json({ error: "No valid sections (1-5)" }, { status: 400 });
  }

  // One row per requested section, drawn from the frozen composer fixtures
  // (real composeManualEntry output — see fixtures.ts). New-model shape:
  // section is the structural key, layer is null. Explicit column list so a
  // future schema change surfaces as a loud insert error, not a wrong row.
  const rows = validLayers.flatMap((index) => {
    const slug = LAYERS[index - 1]?.slug;
    const fx = slug ? FIXTURE_BY_SECTION.get(slug) : undefined;
    if (!fx) return [];
    return [
      {
        user_id: userId,
        layer: null,
        section: fx.section,
        tags: fx.tags,
        name: fx.name,
        content: fx.content,
        summary: fx.summary,
        key_words: fx.key_words,
      },
    ];
  });

  if (rows.length === 0) {
    return Response.json({ error: "No fixtures for requested sections" }, { status: 400 });
  }

  // Narrowed delete — only removes prior populate-seeded rows. Every real or
  // Simulate-generated entry is written through the confirm_checkpoint_write
  // RPC, which always stamps source_message_id; dev-populate is the only path
  // that inserts directly, leaving it null. So `source_message_id IS NULL`
  // matches exactly the seed rows and never real test data. (Was `name IS
  // NULL`, which broke once seeds gained composed titles.)
  await admin
    .from("manual_entries")
    .delete()
    .eq("user_id", userId)
    .is("source_message_id", null);

  const { error } = await admin.from("manual_entries").insert(rows);

  if (error) {
    console.error("[dev-populate] Insert error:", error);
    return Response.json({ error: "Failed to insert components" }, { status: 500 });
  }

  // (The old "mark sections explored in extraction_state" step was removed
  // 2026-07-07 — it wrote layers[].signal, a field the extraction schema
  // deleted in the Wave-3 trim; the write had been a silent no-op.)


  return Response.json({ ok: true, count: rows.length });
}
