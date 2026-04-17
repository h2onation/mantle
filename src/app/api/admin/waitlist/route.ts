import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = ["waiting", "invited", "declined"] as const;
type WaitlistStatus = (typeof ALLOWED_STATUSES)[number];

function isWaitlistStatus(v: unknown): v is WaitlistStatus {
  return typeof v === "string" && (ALLOWED_STATUSES as readonly string[]).includes(v);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("waitlist")
      .select("id, email, source, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/waitlist] fetch error:", error.message);
      return Response.json({ error: "Failed to load" }, { status: 500 });
    }

    return Response.json({ items: data || [] });
  } catch (err) {
    console.error("[admin/waitlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { id?: unknown; status?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const { id, status } = body;
    if (typeof id !== "string" || !id) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }
    if (!isWaitlistStatus(status)) {
      return Response.json({ error: "invalid_status" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("waitlist")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("[admin/waitlist] update error:", error.message);
      return Response.json({ error: "Failed to update" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[admin/waitlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
