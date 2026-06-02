import { requireAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// New-signup count: waiting AND not yet seen. Powers the admin nav badge and
// the in-app admin "new signups" badge. Marking a row seen clears it from this
// count without changing its status. Admin-only (middleware also gates
// /api/admin/*, and requireAdmin double-checks).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const { count, error } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("status", "waiting")
    .eq("seen", false);

  if (error) {
    console.error("[admin/waitlist/count] error:", error.message);
    return Response.json({ error: "Failed" }, { status: 500 });
  }

  return Response.json({ waiting: count ?? 0 });
}
