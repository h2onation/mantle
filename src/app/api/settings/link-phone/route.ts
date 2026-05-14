import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

// Legacy endpoint — kept for backward compatibility.
// New phone linking uses /api/user/phone (Linq-based, no verification code).
// This route only serves GET requests for existing linked phone status.

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_numbers")
    .select("phone, verified, service_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return Response.json({ phone: null });
  }

  return Response.json({
    phone: row.phone,
    verified: row.verified,
    serviceType: row.service_type || null,
  });
}

export async function POST() {
  return Response.json(
    { error: "Phone linking has moved to /api/user/phone" },
    { status: 410 }
  );
}
