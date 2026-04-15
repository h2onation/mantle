import { promises as fs } from "node:fs";
import path from "node:path";
import { verifyAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["intent", "system", "rules", "state", "decisions"]);

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = params.name;
  if (!ALLOWED.has(name)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${name}.md`;
  const filePath = path.join(process.cwd(), "docs", filename);

  try {
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      fs.stat(filePath),
    ]);
    return Response.json({
      name,
      filename,
      lastModified: stat.mtime.toISOString(),
      content,
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
