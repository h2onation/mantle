import { requireAdmin } from "@/lib/admin/verify-admin";
import { isValidEmail, normalizeEmail } from "@/lib/beta-allowlist";
import { listAllAuthUsers } from "@/lib/admin/list-auth-users";

const ALLOWED_STATUSES = ["waiting", "invited", "declined"] as const;
type WaitlistStatus = (typeof ALLOWED_STATUSES)[number];

function isWaitlistStatus(v: unknown): v is WaitlistStatus {
  return typeof v === "string" && (ALLOWED_STATUSES as readonly string[]).includes(v);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    const { data, error } = await admin
      .from("waitlist")
      .select("id, email, source, status, seen, notes, invited_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/waitlist] fetch error:", error.message);
      return Response.json({ error: "Failed to load" }, { status: 500 });
    }

    let rows = data || [];

    // Enrich invited rows with login activity from auth.users (last + first
    // sign-in). Only invited emails can have accounts, so skip the auth list
    // entirely when there are none. Fail-soft: a list error just omits the
    // login fields rather than failing the whole tab.
    if (rows.some((r) => r.status === "invited")) {
      try {
        const { users } = await listAllAuthUsers(admin);
        const byEmail = new Map<string, (typeof users)[number]>();
        for (const u of users) {
          if (u.email) byEmail.set(u.email.toLowerCase(), u);
        }
        rows = rows.map((r) => {
          const u = byEmail.get(r.email.toLowerCase());
          return u
            ? {
                ...r,
                last_sign_in_at: u.last_sign_in_at ?? null,
                first_sign_in_at: u.created_at ?? null,
              }
            : r;
        });
      } catch (enrichErr) {
        console.error(
          "[admin/waitlist] auth enrich failed:",
          enrichErr instanceof Error ? enrichErr.message : "unknown"
        );
      }
    }

    return Response.json({ items: rows });
  } catch (err) {
    console.error("[admin/waitlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    let body: { id?: unknown; status?: unknown; seen?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const { id, status, seen } = body;
    if (typeof id !== "string" || !id) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    // Two update modes: mark a row seen (clears it from the new-signup badge,
    // status untouched), or change its status. `seen` takes precedence when set.
    // Flipping status to 'invited' also stamps invited_at (when access was
    // granted), distinct from created_at (when they joined the list).
    let patch:
      | { seen: boolean }
      | { status: WaitlistStatus; invited_at?: string };
    if (typeof seen === "boolean") {
      patch = { seen };
    } else if (isWaitlistStatus(status)) {
      patch =
        status === "invited"
          ? { status, invited_at: new Date().toISOString() }
          : { status };
    } else {
      return Response.json({ error: "invalid_status" }, { status: 400 });
    }

    const { error } = await admin
      .from("waitlist")
      .update(patch)
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

// Manually grant beta access to an email (the admin "Add invited email" box).
// Inserts an invited row, or promotes an existing waiting/declined row to
// invited. seen=true so a manual grant never shows up as a "new signup".
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof Response) return auth;
    const { admin } = auth;

    let body: { email?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const rawEmail = body.email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) {
      return Response.json({ error: "invalid_email" }, { status: 400 });
    }

    const { data: existing, error: lookupError } = await admin
      .from("waitlist")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      console.error("[admin/waitlist] POST lookup error:", lookupError.message);
      return Response.json({ error: "Failed to add" }, { status: 500 });
    }

    if (existing) {
      if (existing.status === "invited") {
        return Response.json({ result: "already_exists" });
      }
      // Promote a waiting/declined row to invited.
      const { error: updateError } = await admin
        .from("waitlist")
        .update({ status: "invited", invited_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) {
        console.error("[admin/waitlist] POST promote error:", updateError.message);
        return Response.json({ error: "Failed to add" }, { status: 500 });
      }
      return Response.json({ result: "added" });
    }

    const { error: insertError } = await admin.from("waitlist").insert({
      email,
      status: "invited",
      seen: true,
      invited_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error("[admin/waitlist] POST insert error:", insertError.message);
      return Response.json({ error: "Failed to add" }, { status: 500 });
    }
    // Don't log the raw email (PII). The row itself is the audit trail.
    console.log("[admin/waitlist] manually invited an email");

    return Response.json({ result: "added" });
  } catch (err) {
    console.error("[admin/waitlist] unexpected error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
