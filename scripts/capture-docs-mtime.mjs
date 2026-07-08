#!/usr/bin/env node
// Captures the last-commit ISO timestamp for each doc surfaced by
// /admin/docs and writes them to src/lib/admin/docs-mtime.json so the
// admin/docs API route can serve accurate dates in production.
//
// Why this exists: Vercel's build doesn't preserve file mtimes — every
// file in the deployment bundle reads as the same fixed epoch timestamp
// (around 2018), so `fs.stat().mtime` lies in production. Git history
// is the source of truth; we capture it at build time.
//
// Runs as `prebuild`. Failures are non-fatal — if git isn't available
// or a file isn't in history, that entry is just absent from the JSON
// and the API route falls back to fs.stat.

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const FILES = [
  "CLAUDE.md",
  "docs/intent.md",
  "docs/system.md",
  "docs/rules.md",
  "docs/state.md",
  "docs/decisions.md",
  "docs/reference/conductor-scoring.md",
];

function lastCommitIso(file) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${file}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const data = {};
for (const f of FILES) {
  const iso = lastCommitIso(f);
  if (iso) data[f] = iso;
}

const outDir = path.join(process.cwd(), "src", "lib", "admin");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "docs-mtime.json");
writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");

console.log(
  `[capture-docs-mtime] wrote ${Object.keys(data).length} / ${FILES.length} entries to ${path.relative(process.cwd(), outPath)}`,
);
