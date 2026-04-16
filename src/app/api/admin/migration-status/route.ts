import { promises as fs } from "node:fs";
import path from "node:path";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AppliedMigration {
  version: string;
  name: string | null;
}

interface FileMigration {
  version: string;
  filename: string;
}

interface MigrationStatusResponse {
  applied: AppliedMigration[];
  files: FileMigration[];
  missingInDb: FileMigration[]; // file exists on disk but not applied in prod
  missingOnDisk: AppliedMigration[]; // applied in prod but file missing from repo
  inSync: boolean;
  checkedAt: string;
}

// Parse a migration filename like "20260417000002_admin_list_migrations.sql"
// into { version: "20260417000002", filename: "20260417000002_admin_list_migrations.sql" }.
// Returns null if the file doesn't match the Supabase CLI naming convention.
function parseMigrationFilename(filename: string): FileMigration | null {
  const match = filename.match(/^(\d{14})_.+\.sql$/);
  if (!match) return null;
  return { version: match[1], filename };
}

export async function GET(): Promise<Response> {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. List migration files on disk.
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  let fileList: string[] = [];
  try {
    fileList = await fs.readdir(migrationsDir);
  } catch (err) {
    console.error("[admin/migration-status] Failed to read migrations dir:", err);
    return Response.json(
      { error: "Failed to read migrations directory" },
      { status: 500 }
    );
  }

  const files: FileMigration[] = fileList
    .map(parseMigrationFilename)
    .filter((f): f is FileMigration => f !== null)
    .sort((a, b) => a.version.localeCompare(b.version));

  // 2. Query applied migrations via the wrapper function installed in
  //    20260417000002_admin_list_migrations.sql.
  const admin = createAdminClient();
  const { data: appliedRows, error } = await admin.rpc("admin_list_migrations");

  if (error) {
    console.error("[admin/migration-status] RPC error:", error);
    return Response.json(
      { error: "Failed to query applied migrations" },
      { status: 500 }
    );
  }

  const applied: AppliedMigration[] = (appliedRows || []).map(
    (r: { version: string; name: string | null }) => ({
      version: r.version,
      name: r.name,
    })
  );
  applied.sort((a, b) => a.version.localeCompare(b.version));

  // 3. Diff the two lists.
  const appliedVersions = new Set(applied.map((a) => a.version));
  const fileVersions = new Set(files.map((f) => f.version));

  const missingInDb = files.filter((f) => !appliedVersions.has(f.version));
  const missingOnDisk = applied.filter((a) => !fileVersions.has(a.version));

  const response: MigrationStatusResponse = {
    applied,
    files,
    missingInDb,
    missingOnDisk,
    inSync: missingInDb.length === 0 && missingOnDisk.length === 0,
    checkedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
