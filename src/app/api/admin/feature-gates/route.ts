import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  getFeatureGates,
  isFeatureGateKey,
  FEATURE_GATE_KEYS,
} from "@/lib/persona/feature-gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read the current global feature-gate state. Admin only. Returns the
// resolved FeatureGates object (all-ON if the table is missing/unreachable).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const gates = await getFeatureGates(admin);
  return Response.json({ gates });
}

// Flip a single gate. Admin only. Body: { key, enabled }. The key must be
// one of the known feature_gates keys; anything else is rejected so a typo
// can't silently create an orphan row.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    enabled?: unknown;
  } | null;

  if (
    !body ||
    !isFeatureGateKey(body.key) ||
    typeof body.enabled !== "boolean"
  ) {
    return Response.json(
      {
        error:
          "Body must be { key, enabled } where key is one of: " +
          Object.keys(FEATURE_GATE_KEYS).join(", "),
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("feature_gates")
    .upsert(
      { key: body.key, enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    return Response.json({ error: "Failed to update gate" }, { status: 500 });
  }

  const gates = await getFeatureGates(admin);
  return Response.json({ gates });
}
