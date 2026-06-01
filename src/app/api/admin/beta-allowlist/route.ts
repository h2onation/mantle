import { requireAdmin } from "@/lib/admin/verify-admin";
import { isValidEmail } from "@/lib/beta-allowlist";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

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
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "missing_id" }, { status: 400 });
    }

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
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

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

    if (!isValidEmail(email)) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }

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

    // Don't log the raw email (PII). The insert itself is the audit trail.
    console.log("[admin/beta-allowlist] inserted allowlist entry");

    // Remove the matching row from the waitlist — once on the allowlist,
    // they should no longer appear as pending. Match by id when supplied,
    // else fall back to email so manual add-form entries also clean up.
    const waitlistId = body.waitlist_id;
    const waitlistDelete = admin.from("waitlist").delete();
    const { error: deleteError } =
      typeof waitlistId === "string" && waitlistId
        ? await waitlistDelete.eq("id", waitlistId)
        : await waitlistDelete.eq("email", email);

    if (deleteError) {
      console.error("[admin/beta-allowlist] waitlist delete error:", deleteError.message);
      // Non-fatal — the allowlist insert succeeded
    }

    return Response.json({ result: "added" });
  } catch (err) {
    console.error("[admin/beta-allowlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
