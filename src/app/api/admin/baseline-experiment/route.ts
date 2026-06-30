import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  getBaselineExperiment,
  isBaselineGateKey,
  BASELINE_GATE_KEYS,
} from "@/lib/persona/baseline-experiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ⚠ TEMPORARY strip-to-baseline experiment (Part A). Admin-only read/write of
// the baseline_experiment_gates switches. These strip safety-shaping/timing out
// of Jove; they are applied ONLY for admin conversations (persona-pipeline.ts),
// so a stripped Jove can never reach a real user. Delete this route at teardown.

// Read the current experiment state. Admin only. Returns the resolved
// { enabled, forces } object (experiment-off if the table is missing/unreachable).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const experiment = await getBaselineExperiment(admin);
  return Response.json({ experiment });
}

// Flip one switch. Admin only. Body: { key, enabled }. The key must be one of
// the known baseline_experiment_gates keys; anything else is rejected so a typo
// can't silently create an orphan row.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    enabled?: unknown;
  } | null;

  if (
    !body ||
    !isBaselineGateKey(body.key) ||
    typeof body.enabled !== "boolean"
  ) {
    return Response.json(
      {
        error:
          "Body must be { key, enabled } where key is one of: " +
          Object.keys(BASELINE_GATE_KEYS).join(", "),
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("baseline_experiment_gates")
    .upsert(
      {
        key: body.key,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "key" },
    );

  if (error) {
    return Response.json({ error: "Failed to update switch" }, { status: 500 });
  }

  const experiment = await getBaselineExperiment(admin);
  return Response.json({ experiment });
}
