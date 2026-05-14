import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { verifyAdmin } from "@/lib/admin/verify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Skill = {
  id: string;
  name: string;
  description: string;
  invocation: string | null;
  scope: "project-skill" | "project-command" | "user-skill";
  origin: "built" | "installed";
  source: string;
  body: string;
};

function parseFrontmatter(text: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }
  return { meta, body: match[2] };
}

function prettifyPath(filePath: string): string {
  const home = os.homedir();
  const cwd = process.cwd();
  if (filePath.startsWith(cwd + path.sep)) {
    return filePath.slice(cwd.length + 1);
  }
  if (filePath.startsWith(home + path.sep)) {
    return "~/" + filePath.slice(home.length + 1);
  }
  return filePath;
}

async function readSkillFile(
  filePath: string,
  scope: Skill["scope"],
  origin: Skill["origin"],
  invocation: string | null,
): Promise<Skill | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const id = path.basename(path.dirname(filePath)) === "skills"
      ? path.basename(filePath, path.extname(filePath))
      : path.basename(path.dirname(filePath));
    const name = meta.name || id;
    let description = meta.description || "";
    if (!description) {
      const firstPara = body.trim().split(/\n\n/)[0];
      description = firstPara.replace(/^#+\s*/, "").slice(0, 280);
    }
    return {
      id,
      name,
      description,
      invocation,
      scope,
      origin,
      source: prettifyPath(filePath),
      body,
    };
  } catch {
    return null;
  }
}

async function readDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

async function lstat(p: string) {
  try {
    return await fs.lstat(p);
  } catch {
    return null;
  }
}

export async function GET() {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const skills: Skill[] = [];

  // Project commands at .claude/commands/*.md — invoked as /name
  const cmdDir = path.join(process.cwd(), ".claude", "commands");
  for (const file of await readDir(cmdDir)) {
    if (!file.endsWith(".md")) continue;
    const skill = await readSkillFile(
      path.join(cmdDir, file),
      "project-command",
      "built",
      `/${path.basename(file, ".md")}`,
    );
    if (skill) skills.push(skill);
  }

  // Project skills at .claude/skills/<name>/SKILL.md
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");
  for (const entry of await readDir(projectSkillsDir)) {
    const skillPath = path.join(projectSkillsDir, entry);
    const stat = await lstat(skillPath);
    if (!stat) continue;
    const skillMd = path.join(skillPath, "SKILL.md");
    const isSymlink = stat.isSymbolicLink();
    const skill = await readSkillFile(
      skillMd,
      "project-skill",
      isSymlink ? "installed" : "built",
      `/${entry}`,
    );
    if (skill) skills.push(skill);
  }

  // User-level skills at ~/.claude/skills/<name>/SKILL.md
  const userSkillsDir = path.join(os.homedir(), ".claude", "skills");
  for (const entry of await readDir(userSkillsDir)) {
    const skillMd = path.join(userSkillsDir, entry, "SKILL.md");
    const skill = await readSkillFile(
      skillMd,
      "user-skill",
      "installed",
      `/${entry}`,
    );
    if (skill) skills.push(skill);
  }

  return Response.json({ skills });
}
