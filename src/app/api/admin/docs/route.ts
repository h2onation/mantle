import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each entry: name (slug), filename, absolute-path-resolver.
// CLAUDE.md lives at repo root; the others live under docs/.
interface DocSource {
  name: string;
  filename: string;
  relative: string; // relative to repo root
}

const DOC_SOURCES: DocSource[] = [
  { name: "claude", filename: "CLAUDE.md", relative: "CLAUDE.md" },
  { name: "intent", filename: "intent.md", relative: "docs/intent.md" },
  { name: "system", filename: "system.md", relative: "docs/system.md" },
  { name: "rules", filename: "rules.md", relative: "docs/rules.md" },
  { name: "state", filename: "state.md", relative: "docs/state.md" },
  { name: "decisions", filename: "decisions.md", relative: "docs/decisions.md" },
];

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const root = process.cwd();
  const docs = await Promise.all(
    DOC_SOURCES.map(async (src) => {
      const filePath = path.join(root, src.relative);
      try {
        const [content, stat] = await Promise.all([
          fs.readFile(filePath, "utf8"),
          fs.stat(filePath),
        ]);
        return {
          name: src.name,
          filename: src.filename,
          lastModified: stat.mtime.toISOString(),
          content,
        };
      } catch {
        return null;
      }
    }),
  );

  return Response.json({ docs: docs.filter(Boolean) });
}
