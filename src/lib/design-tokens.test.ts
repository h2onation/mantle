import { describe, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ---------------------------------------------------------------------------
// Design-token guard rail.
//
// Admin UI must source colors from CSS variables (--session-*) declared in
// src/app/globals.css, not from inline rgba()/rgb() literals. This keeps the
// page theme-aware (Hearth + Bloom) and prevents the kind of drift that put
// /admin/extraction-map and /admin/schema-map out of step in May 2026.
//
// To add a vendor / map / panel page: it inherits enforcement automatically.
// Use --session-walnut-tint, --session-walnut-highlight, --session-persona*,
// --session-warning*, etc. — see globals.css for the full inventory.
//
// To opt a file out (e.g. it needs a layer-identity gradient that no token
// expresses): add it to ALLOWLIST with a one-line reason. Removing the file
// from the allowlist once it's tokenized is a clean PR on its own.
// ---------------------------------------------------------------------------

const ROOT = process.cwd();

const ENFORCED_DIRS = [
  "src/app/admin",
  "src/components/admin",
];

// Files exempted from the no-literal rule. Each entry should have a reason.
const ALLOWLIST = new Set<string>([
  // Pre-existing admin components carrying isolated literals from before the
  // token system landed. Eligible for token cleanup as a follow-up; not in
  // scope of the May 2026 admin-map cleanup pass.
  "src/components/admin/AdminNavRail.tsx",
  "src/components/admin/UsersTab.tsx",
  "src/components/admin/WaitlistTab.tsx",
  "src/components/admin/SchemaHealthTab.tsx",
  "src/components/admin/ConfirmHealthPanel.tsx",
  "src/components/admin/ActiveUsersPanel.tsx",
  "src/components/admin/ApiErrorsPanel.tsx",
]);

const COLOR_LITERAL = /\brgba?\s*\(/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...walk(p));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(p);
    }
  }
  return out;
}

describe("design tokens — admin UI must use CSS variables, not color literals", () => {
  it("no rgba()/rgb() literals in admin pages or components", () => {
    const violations: { file: string; line: number; text: string }[] = [];

    for (const baseDir of ENFORCED_DIRS) {
      const absDir = join(ROOT, baseDir);
      let files: string[];
      try {
        files = walk(absDir);
      } catch {
        continue;
      }

      for (const file of files) {
        const rel = relative(ROOT, file).split(sep).join("/");
        if (ALLOWLIST.has(rel)) continue;

        const lines = readFileSync(file, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();
          // Skip pure comment lines so we don't false-flag docs about colors.
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
          if (COLOR_LITERAL.test(line)) {
            violations.push({ file: rel, line: i + 1, text: trimmed });
          }
        }
      }
    }

    if (violations.length > 0) {
      const lines = [
        `Found ${violations.length} hardcoded color literal${violations.length === 1 ? "" : "s"} in admin code.`,
        "Use CSS variables from src/app/globals.css (--session-walnut-tint, --session-walnut-highlight, --session-persona*, --session-warning*, etc.) instead.",
        "",
        ...violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`),
        "",
        "If a literal is truly intentional, add the file to ALLOWLIST in src/lib/design-tokens.test.ts with a one-line reason.",
      ];
      throw new Error(lines.join("\n"));
    }
  });
});
