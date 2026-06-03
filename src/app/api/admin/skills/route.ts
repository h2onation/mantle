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
  scope:
    | "project-command"
    | "project-agent"
    | "project-skill"
    | "user-agent"
    | "user-skill";
  origin: "built" | "installed";
  source: string;
  body: string;
};

// Reference capabilities — tools and external skills available in this
// workspace that are NOT committed mywalnut skills, so the filesystem scan
// below won't reliably surface them (symlinks into ~/.agents don't deploy;
// Dynamic Workflows is a built-in Claude Code tool with no file at all).
// Listed here purely as a reference so they aren't forgotten. Merged into the
// scan results by id, so a locally-discovered copy always wins over these.
const REFERENCE_CAPABILITIES: Skill[] = [
  {
    id: "remotion-best-practices",
    name: "remotion-best-practices",
    description:
      "Best practices for Remotion — building videos in React. Compositions are React components; `npx remotion render` turns them into MP4s. Used for the mywalnut pitch/walkthrough video in pitch-video/.",
    invocation: "/remotion-best-practices",
    scope: "project-skill",
    origin: "installed",
    source: ".agents/skills/remotion-best-practices (symlinked into .claude/skills)",
    body: "Domain knowledge for working with Remotion code: project setup, composition structure, animation patterns, and rendering. Run `npx remotion studio` (live editor) or `npx remotion render` (export MP4) from the pitch-video/ project. Tags: remotion, video, react, animation, composition.",
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    description:
      "Create distinctive, production-grade frontend interfaces with high design quality. Use when building web components, pages, artifacts, posters, or applications — generates polished UI that avoids generic AI aesthetics.",
    invocation: "/frontend-design",
    scope: "user-skill",
    origin: "installed",
    source: "~/.claude/skills/frontend-design",
    body: "Guides creation of distinctive, production-grade frontend interfaces that avoid generic 'AI slop' aesthetics. Implements real working code with attention to aesthetic detail and creative choices given a component, page, or interface to build.",
  },
  {
    id: "dynamic-workflows",
    name: "Dynamic Workflows",
    description:
      "Built-in Claude Code orchestration tool. Runs a deterministic script that fans work out across many subagents (parallel/pipeline stages, adversarial verification, loop-until-done) for comprehensive, multi-step tasks. Opt-in per request — e.g. 'use a workflow' or the 'ultracode' keyword.",
    invocation: null,
    scope: "user-skill",
    origin: "installed",
    source: "Built-in Claude Code tool (no file)",
    body: "Not a filesystem skill — a built-in tool. Structures work across many agents to be comprehensive (decompose and cover in parallel), confident (independent perspectives and adversarial checks before committing), or to take on scale one context can't hold (migrations, audits, broad sweeps). Must be explicitly opted into; it can spawn many agents and consume significant tokens.",
  },
];

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
    // Skills are <dir>/SKILL.md → id is the parent directory name.
    // Commands and agents are <dir>/<name>.md → id is the file basename.
    const id =
      path.basename(filePath) === "SKILL.md"
        ? path.basename(path.dirname(filePath))
        : path.basename(filePath, path.extname(filePath));
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

  // Project agents at .claude/agents/<name>.md — subagents the main agent
  // can delegate to. Invoked via natural language or the /agents menu,
  // not a slash command, so invocation is null.
  const projectAgentsDir = path.join(process.cwd(), ".claude", "agents");
  for (const file of await readDir(projectAgentsDir)) {
    if (!file.endsWith(".md")) continue;
    const skill = await readSkillFile(
      path.join(projectAgentsDir, file),
      "project-agent",
      "built",
      null,
    );
    if (skill) skills.push(skill);
  }

  // User agents at ~/.claude/agents/<name>.md
  const userAgentsDir = path.join(os.homedir(), ".claude", "agents");
  for (const file of await readDir(userAgentsDir)) {
    if (!file.endsWith(".md")) continue;
    const skill = await readSkillFile(
      path.join(userAgentsDir, file),
      "user-agent",
      "installed",
      null,
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

  // Merge in reference capabilities not already discovered on disk, so they
  // show up even where the symlinks/built-in tools aren't present (e.g. the
  // deployed admin page). A locally-discovered copy always wins.
  const discoveredIds = new Set(skills.map((s) => s.id));
  for (const cap of REFERENCE_CAPABILITIES) {
    if (!discoveredIds.has(cap.id)) skills.push(cap);
  }

  return Response.json({ skills });
}
