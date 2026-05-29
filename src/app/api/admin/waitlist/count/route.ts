import { requireAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pending (status = 'waiting') waitlist count. Powers the admin nav badge and
// the in-app admin "new signups" badge. Admin-only (middleware also gates
// /api/admin/*, and requireAdmin double-checks).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const { count, error } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("status", "waiting");

  if (error) {
    console.error("[admin/waitlist/count] error:", error.message);
    return Response.json({ error: "Failed" }, { status: 500 });
  }

  return Response.json({ waiting: count ?? 0 });
}
