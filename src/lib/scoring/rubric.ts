import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

// The conversation-scoring rubric, resolved the same way as the conductor
// prompt: the repo doc is the permanent floor, an admin override (one row in
// persona_voice_overrides, key `scoring_rubric`) wins while enabled. Node-only
// module (fs) — imported by the admin scoring routes, never by edge code.
// Kept OUT of VOICE_OVERRIDE_FIELDS deliberately: that registry is read on
// every chat turn at the edge, and its defaults are sync code constants; this
// default is an async file read that only admin routes need.

export const SCORING_RUBRIC_KEY = "scoring_rubric";

const RUBRIC_DOC_RELATIVE = "docs/reference/conductor-scoring.md";

/** Short fingerprint of the exact rubric text a scoring run used. Scores are
 *  only comparable within one rubric version, so every run stores this. */
export function rubricSha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

/** Read the rubric doc from the repo bundle (the code-default floor). The
 *  file is traced into the scoring routes' bundles via
 *  outputFileTracingIncludes in next.config.mjs. */
export async function readRubricDefault(): Promise<string> {
  const filePath = path.join(process.cwd(), RUBRIC_DOC_RELATIVE);
  return fs.readFile(filePath, "utf8");
}

export interface ResolvedRubric {
  text: string;
  sha: string;
  source: "override" | "default";
}

/** Resolve the rubric a scoring run should use: enabled override ?? doc file.
 *  Any read error on the override side falls back to the doc, matching the
 *  fail-open convention of getVoiceOverrides. */
export async function loadScoringRubric(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ResolvedRubric> {
  try {
    const { data } = await admin
      .from("persona_voice_overrides")
      .select("text_override, enabled")
      .eq("key", SCORING_RUBRIC_KEY)
      .maybeSingle();
    const row = data as { text_override: string | null; enabled: boolean } | null;
    const text = row?.enabled ? row.text_override : null;
    if (typeof text === "string" && text.trim().length > 0) {
      return { text, sha: rubricSha(text), source: "override" };
    }
  } catch {
    // fall through to the doc default
  }
  const text = await readRubricDefault();
  return { text, sha: rubricSha(text), source: "default" };
}
