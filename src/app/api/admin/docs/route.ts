import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOC_NAMES = ["intent", "system", "rules", "state", "decisions"] as const;

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const docsDir = path.join(process.cwd(), "docs");
  const docs = await Promise.all(
    DOC_NAMES.map(async (name) => {
      const filename = `${name}.md`;
      const filePath = path.join(docsDir, filename);
      try {
        const [content, stat] = await Promise.all([
          fs.readFile(filePath, "utf8"),
          fs.stat(filePath),
        ]);
        return {
          name,
          filename,
          lastModified: stat.mtime.toISOString(),
          content,
        };
      } catch {
        return null;
      }
    })
  );

  return Response.json({ docs: docs.filter(Boolean) });
}
