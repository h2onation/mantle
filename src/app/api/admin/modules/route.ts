import { requireAdmin } from "@/lib/admin/verify-admin";
import {
  getModules,
  isValidModuleSlug,
  validateModuleBrief,
} from "@/lib/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin CRUD for modules — the unified door + Manual-section rows. The voice
// is never per-module (ADR-054): a module carries a BRIEF that composes with
// the shared conductor, not a prompt of its own.

const MAX_TEXT = 200; // name / cue caps — card copy, not prose
const MAX_PROSE = 4000; // description / intro / opener / brief caps

// Fields an admin may write, with per-field coercion. Empty strings on the
// nullable prose fields coerce to null ("not set") so a cleared textarea
// never stores "".
type ModuleWrite = {
  name?: string;
  description?: string;
  cue?: string;
  intro_title?: string | null;
  intro_body?: string | null;
  opener_text?: string | null;
  brief?: string | null;
  enabled?: boolean;
  sort_order?: number;
};

function coerceWrite(body: Record<string, unknown>): ModuleWrite | string {
  const out: ModuleWrite = {};

  const text = (key: string, max: number): string | null | undefined | string[] => {
    const v = body[key];
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== "string") return [`${key} must be a string`];
    if (v.length > max) return [`${key} is too long (max ${max} characters)`];
    return v;
  };

  const name = text("name", MAX_TEXT);
  if (Array.isArray(name)) return name[0];
  if (name !== undefined) {
    if (!name || !name.trim()) return "name cannot be empty";
    out.name = name.trim();
  }

  const description = text("description", MAX_PROSE);
  if (Array.isArray(description)) return description[0];
  if (description !== undefined) out.description = description ?? "";

  const cue = text("cue", MAX_TEXT);
  if (Array.isArray(cue)) return cue[0];
  if (cue !== undefined) out.cue = cue?.trim() || "Begin";

  for (const key of [
    "intro_title",
    "intro_body",
    "opener_text",
  ] as const) {
    const v = text(key, MAX_PROSE);
    if (Array.isArray(v)) return v[0];
    if (v !== undefined) out[key] = v && v.trim() ? v : null;
  }

  const brief = text("brief", MAX_PROSE);
  if (Array.isArray(brief)) return brief[0];
  if (brief !== undefined) {
    const normalized = brief && brief.trim() ? brief : null;
    const invalid = validateModuleBrief(normalized);
    if (invalid) return invalid;
    out.brief = normalized;
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return "enabled must be a boolean";
    out.enabled = body.enabled;
  }

  if (body.sort_order !== undefined) {
    if (
      typeof body.sort_order !== "number" ||
      !Number.isInteger(body.sort_order)
    ) {
      return "sort_order must be an integer";
    }
    out.sort_order = body.sort_order;
  }

  return out;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  return Response.json({ modules: await getModules(admin) });
}

// Create a module. Body: { slug, name, ...optional fields }.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  if (!isValidModuleSlug(body.slug)) {
    return Response.json(
      {
        error:
          "slug must be lowercase letters/digits with - or _ (e.g. burnout-at-work). It becomes the module's permanent id and can't be changed later.",
      },
      { status: 400 },
    );
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const write = coerceWrite(body);
  if (typeof write === "string") {
    return Response.json({ error: write }, { status: 400 });
  }

  const { error } = await admin.from("modules").insert({
    slug: body.slug,
    ...write,
    updated_by: userId,
  });

  if (error) {
    const duplicate = error.code === "23505";
    return Response.json(
      {
        error: duplicate
          ? `A module with slug "${body.slug}" already exists.`
          : "Failed to create module",
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return Response.json({ modules: await getModules(admin) });
}

// Update a module by slug. Slug itself is immutable — it is stamped on
// conversations (mode) and entries (section), so renaming happens via the
// display name, never the id.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !isValidModuleSlug(body.slug)) {
    return Response.json({ error: "Body must include a valid slug" }, { status: 400 });
  }

  const write = coerceWrite(body);
  if (typeof write === "string") {
    return Response.json({ error: write }, { status: 400 });
  }
  if (Object.keys(write).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("modules")
    .update({
      ...write,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("slug", body.slug)
    .select("slug");

  if (error) {
    return Response.json({ error: "Failed to update module" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ error: "Module not found" }, { status: 404 });
  }

  return Response.json({ modules: await getModules(admin) });
}

// Delete a module. Two tiers:
//   - Plain delete: allowed only while NOTHING references the slug. If
//     references exist, responds 409 WITH the counts so the admin panel can
//     stage the strong confirm.
//   - deleteEntries: true — the founder confirmed the destructive path:
//     permanently deletes the module's Manual entries (every user's), then
//     the module row. Conversations are NEVER deleted — history is kept;
//     they lose their door and fall back to the shared conductor. This is
//     the "experiment is trash" cleanup; the gentle alternative stays
//     `enabled: false` (door hides, section + entries remain).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;
  const { admin } = auth;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !isValidModuleSlug(body.slug)) {
    return Response.json({ error: "Body must include a valid slug" }, { status: 400 });
  }
  const slug = body.slug;
  const deleteEntries = body.deleteEntries === true;

  const [convs, entries] = await Promise.all([
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("mode", slug),
    admin
      .from("manual_entries")
      .select("id", { count: "exact", head: true })
      .eq("section", slug),
  ]);

  if (convs.error || entries.error) {
    return Response.json(
      { error: "Could not verify the module is unused" },
      { status: 500 },
    );
  }
  const convCount = convs.count ?? 0;
  const entryCount = entries.count ?? 0;

  if ((convCount > 0 || entryCount > 0) && !deleteEntries) {
    // Counts ride along so the panel can render the typed-slug confirm with
    // the real blast radius.
    return Response.json(
      {
        error: `"${slug}" has ${convCount} conversation(s) and ${entryCount} entrie(s) attached.`,
        requiresForce: true,
        conversations: convCount,
        entries: entryCount,
      },
      { status: 409 },
    );
  }

  if (deleteEntries && entryCount > 0) {
    const { error: entriesError } = await admin
      .from("manual_entries")
      .delete()
      .eq("section", slug);
    if (entriesError) {
      return Response.json(
        { error: "Failed to delete the module's entries — module left in place" },
        { status: 500 },
      );
    }
    // Counts only — never entry content (CLAUDE.md security rules).
    console.log(
      "[admin/modules] force-delete removed %d entrie(s) under module %s",
      entryCount,
      slug,
    );
  }

  const { error } = await admin.from("modules").delete().eq("slug", slug);
  if (error) {
    return Response.json({ error: "Failed to delete module" }, { status: 500 });
  }

  return Response.json({
    modules: await getModules(admin),
    deletedEntries: deleteEntries ? entryCount : 0,
  });
}
