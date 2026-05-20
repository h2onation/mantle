import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/verify-admin";
import docMtimes from "@/lib/admin/docs-mtime.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same set as the list endpoint — keep these in sync.
const DOC_PATHS: Record<string, { filename: string; relative: string }> = {
  claude: { filename: "CLAUDE.md", relative: "CLAUDE.md" },
  intent: { filename: "intent.md", relative: "docs/intent.md" },
  system: { filename: "system.md", relative: "docs/system.md" },
  rules: { filename: "rules.md", relative: "docs/rules.md" },
  state: { filename: "state.md", relative: "docs/state.md" },
  decisions: { filename: "decisions.md", relative: "docs/decisions.md" },
};

const MTIMES = docMtimes as Record<string, string>;

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const entry = DOC_PATHS[params.name];
  if (!entry) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), entry.relative);
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath),
    ]);
    // Prefer git-captured mtime (see scripts/capture-docs-mtime.mjs).
    const lastModified = MTIMES[entry.relative] ?? stat.mtime.toISOString();
    return Response.json({
      name: params.name,
      filename: entry.filename,
      lastModified,
      content,
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
