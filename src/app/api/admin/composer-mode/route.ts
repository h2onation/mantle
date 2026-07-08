import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  getComposerMode,
  normalizeComposerMode,
  envComposerMode,
  COMPOSER_MODE_KEY,
  COMPOSER_MODES,
} from "@/lib/persona/composer-mode";
import { saveOverride } from "@/lib/persona/voice-overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read/set the live composer mode (composer | conductor | compare). Admin only.
// Stored as a `composer_mode` row in persona_voice_overrides (reusing the
// generic override store), so it flips live with no redeploy. A/B scaffolding —
// removed with the compare test. See composer-mode.ts.

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const mode = await getComposerMode(admin);
  return Response.json({ mode, envFallback: envComposerMode() });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
  } | null;

  const mode = normalizeComposerMode(body?.mode);
  if (!mode) {
    return Response.json(
      { error: "Body must be { mode } where mode is one of: " + COMPOSER_MODES.join(", ") },
      { status: 400 },
    );
  }

  const ok = await saveOverride(admin, COMPOSER_MODE_KEY, mode, userId);
  if (!ok) {
    return Response.json({ error: "Failed to set composer mode" }, { status: 500 });
  }

  const current = await getComposerMode(admin);
  return Response.json({ mode: current, envFallback: envComposerMode() });
}
