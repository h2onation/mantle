import type { createAdminClient } from "@/lib/supabase/admin";
import {
  CONDUCTOR_PROMPT,
  validateConductorPromptEdit,
} from "@/lib/persona/conductor-prompt";

/**
 * Modules — the unified door + Manual-section abstraction.
 *
 * A module is simultaneously an entry door on the Home screen and a section
 * of the Manual. The set of modules is founder-authored data (the `modules`
 * table, edited via /admin/modules), not code: creating a module in admin
 * adds a door AND grows the Manual's table of contents.
 *
 * Each module carries everything that makes a door:
 *   - card copy (name / description / cue / icon) for the Home list
 *   - optional one-time intro modal copy
 *   - optional fixed opener (server-emitted first message, no model call)
 *   - optional full custom Jove prompt — see resolveModulePrompt below
 *   - enabled flag + sort order
 *
 * Voice resolution is a strict ladder: module custom prompt → admin conductor
 * override → code conductor. A module with no custom prompt runs the live
 * shared conductor, so the default remains ONE voice (ADR-052's spirit);
 * a custom prompt is a deliberate per-module fork, save-guarded by the same
 * required fragments as the conductor (crisis lines + reflection markers).
 *
 * Reads are service-role only (RLS with no policies, like feature_gates);
 * every user-facing surface gets module data through a server route.
 */

export interface Module {
  slug: string;
  name: string;
  description: string;
  cue: string;
  icon: string;
  introTitle: string | null;
  introBody: string | null;
  openerText: string | null;
  customPrompt: string | null;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string | null;
}

/** Mirrors the modules_slug_format CHECK constraint — keep the two in sync. */
export const MODULE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidModuleSlug(value: unknown): value is string {
  return typeof value === "string" && MODULE_SLUG_PATTERN.test(value);
}

interface ModuleRow {
  slug: string;
  name: string;
  description: string;
  cue: string;
  icon: string;
  intro_title: string | null;
  intro_body: string | null;
  opener_text: string | null;
  custom_prompt: string | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string | null;
}

function rowToModule(row: ModuleRow): Module {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    cue: row.cue ?? "Begin",
    icon: row.icon ?? "chat",
    introTitle: row.intro_title,
    introBody: row.intro_body,
    openerText: row.opener_text,
    customPrompt: row.custom_prompt,
    enabled: row.enabled,
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at,
  };
}

/**
 * All modules, enabled and disabled, in display order. Fails safe to an empty
 * list on any error — callers must treat "no modules" as a real state (the
 * founder starts from a blank set), so an empty list never crashes a surface.
 */
export async function getModules(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Module[]> {
  try {
    const { data, error } = await admin
      .from("modules")
      .select(
        "slug, name, description, cue, icon, intro_title, intro_body, opener_text, custom_prompt, enabled, sort_order, updated_at",
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data) return [];
    return (data as ModuleRow[]).map(rowToModule);
  } catch {
    return [];
  }
}

/** Enabled modules only — the set that renders as doors and accepts new conversations. */
export async function getEnabledModules(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Module[]> {
  return (await getModules(admin)).filter((m) => m.enabled);
}

/** One module by slug, or null. Disabled modules are still returned — their
 * Manual section stays live; only the door hides. */
export async function getModule(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
): Promise<Module | null> {
  if (!isValidModuleSlug(slug)) return null;
  try {
    const { data, error } = await admin
      .from("modules")
      .select(
        "slug, name, description, cue, icon, intro_title, intro_body, opener_text, custom_prompt, enabled, sort_order, updated_at",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return rowToModule(data as ModuleRow);
  } catch {
    return null;
  }
}

/**
 * The voice ladder: module custom prompt → admin conductor override → code
 * conductor. Blank/whitespace custom prompts are treated as "not set" so a
 * cleared admin field can never ship an empty system prompt.
 */
export function resolveModulePrompt(
  customPrompt: string | null | undefined,
  conductorOverride: string | null | undefined,
): string {
  if (typeof customPrompt === "string" && customPrompt.trim()) {
    return customPrompt;
  }
  if (typeof conductorOverride === "string" && conductorOverride.trim()) {
    return conductorOverride;
  }
  return CONDUCTOR_PROMPT;
}

/**
 * Validate a module's custom prompt before save. Empty/null is always valid
 * (it means "run the shared conductor"). A non-empty prompt must pass the
 * SAME required-fragment guard as the conductor itself — the crisis lines and
 * the reflection markers can never be edited away, on any module.
 * Returns null when safe, or a plain-language error.
 */
export function validateModulePrompt(
  customPrompt: string | null | undefined,
): string | null {
  if (customPrompt == null || !customPrompt.trim()) return null;
  return validateConductorPromptEdit(customPrompt);
}
