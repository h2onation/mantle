import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("beta_allowlist")
      .select("id, email, notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/beta-allowlist] select error:", error.message);
      return Response.json({ error: "Failed to load" }, { status: 500 });
    }

    return Response.json({ items: data ?? [] });
  } catch (err) {
    console.error("[admin/beta-allowlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "missing_id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("beta_allowlist")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[admin/beta-allowlist] delete error:", error.message);
      return Response.json({ error: "Failed to remove" }, { status: 500 });
    }

    return Response.json({ result: "removed" });
  } catch (err) {
    console.error("[admin/beta-allowlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { email?: unknown; waitlist_id?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const rawEmail = body.email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check for duplicate
    const { data: existing } = await admin
      .from("beta_allowlist")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return Response.json({ result: "already_exists" });
    }

    // Insert into beta_allowlist
    const today = new Date().toISOString().split("T")[0];
    const { error: insertError } = await admin
      .from("beta_allowlist")
      .insert({ email, notes: `Added via admin on ${today}` });

    if (insertError) {
      console.error("[admin/beta-allowlist] insert error:", insertError.message);
      return Response.json({ error: "Failed to add" }, { status: 500 });
    }

    console.log("[admin/beta-allowlist] inserted email=%s", email);

    // If a waitlist_id was provided, also update that row's status to "invited"
    const waitlistId = body.waitlist_id;
    if (typeof waitlistId === "string" && waitlistId) {
      const { error: updateError } = await admin
        .from("waitlist")
        .update({ status: "invited" })
        .eq("id", waitlistId);

      if (updateError) {
        console.error("[admin/beta-allowlist] waitlist update error:", updateError.message);
        // Non-fatal — the allowlist insert succeeded
      }
    }

    return Response.json({ result: "added" });
  } catch (err) {
    console.error("[admin/beta-allowlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
