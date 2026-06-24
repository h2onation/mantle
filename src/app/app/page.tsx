import MainApp from "@/components/MainApp";
import AdminSignupsBadge from "@/components/admin/AdminSignupsBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureGates } from "@/lib/persona/feature-gates";
import type { ConversationMode } from "@/lib/persona/config";

// Force dynamic rendering. Without this, Next.js prerenders this route as
// a static HTML file at build time, and Vercel serves it straight from the
// edge cache WITHOUT running middleware — unauth visitors would receive the
// static app shell instead of a redirect to /login. force-dynamic makes the
// page server-render per request, so middleware runs every time.
//
// Auth is still enforced by middleware — if the user reaches this page, they
// are authenticated. A redundant getUser() here caused Google OAuth login
// failures in the past, so we deliberately do not re-check auth here.
export const dynamic = "force-dynamic";

export default async function App() {
  // Read the per-mode gates server-side and hand the client which entry doors
  // are live. Reuses the same getFeatureGates the chat pipeline uses (fails open
  // to all-ON), so a missing/unreachable table just shows every door. Situation
  // is the always-on floor and has no gate. One cheap indexed read per render.
  const gates = await getFeatureGates(createAdminClient());
  const enabledModes: Record<ConversationMode, boolean> = {
    situation: true,
    "guided-intake": gates.guidedIntake,
    upload: gates.upload,
  };

  return (
    <>
      <MainApp enabledModes={enabledModes} />
      <AdminSignupsBadge />
    </>
  );
}
