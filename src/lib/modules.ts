import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Modules — the unified door + Manual-section abstraction.
 *
 * A module is simultaneously an entry door on the Home screen and a section
 * of the Manual. The set of modules is founder-authored data (the `modules`
 * table, edited via /admin/modules), not code: creating a module in admin
 * adds a door AND grows the Manual's table of contents.
 *
 * Each module carries everything that makes a door:
 *   - card copy (name / description / cue) for the Home list
 *   - optional one-time intro modal copy
 *   - optional fixed opener (server-emitted first message, no model call)
 *   - optional brief — a few founder-written sentences of steering that
 *     COMPOSE with the shared conductor voice (appended as a labeled
 *     system-prompt section in call-persona.ts). The voice itself is never
 *     per-module: every conversation runs the one conductor (admin Tuning
 *     override → code constant), so Tuning edits reach every module and the
 *     crisis/marker machinery is structurally always present. (The full
 *     per-module prompt fork shipped by ADR-053 was removed by ADR-054 —
 *     it was half-wired and forked away from Tuning edits.)
 *   - enabled flag + sort order
 *
 * Reads are service-role only (RLS with no policies, like feature_gates);
 * every user-facing surface gets module data through a server route.
 */

export interface Module {
  slug: string;
  name: string;
  description: string;
  cue: string;
  introTitle: string | null;
  introBody: string | null;
  openerText: string | null;
  brief: string | null;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string | null;
}

/**
 * The slice of a module the client needs: Home cards + the one-time intro
 * modal. Deliberately excludes opener_text and brief — prompt material
 * never ships to the browser.
 */
export interface HomeModule {
  slug: string;
  name: string;
  description: string;
  cue: string;
  introTitle: string | null;
  introBody: string | null;
  /** Disabled modules hide as doors but their Manual section stays visible. */
  enabled: boolean;
}

export function toHomeModule(m: Module): HomeModule {
  return {
    slug: m.slug,
    name: m.name,
    description: m.description,
    cue: m.cue,
    introTitle: m.introTitle,
    introBody: m.introBody,
    enabled: m.enabled,
  };
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
  intro_title: string | null;
  intro_body: string | null;
  opener_text: string | null;
  brief: string | null;
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
    introTitle: row.intro_title,
    introBody: row.intro_body,
    openerText: row.opener_text,
    brief: row.brief,
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
        "slug, name, description, cue, intro_title, intro_body, opener_text, brief, enabled, sort_order, updated_at",
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
        "slug, name, description, cue, intro_title, intro_body, opener_text, brief, enabled, sort_order, updated_at",
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
 * Standalone UI-marker line, e.g. `---reflection-ready---`. A module brief may
 * never contain one: markers are code-owned machine contract (ui-markers.ts),
 * and a brief that ships one would instruct Jove to emit UI machinery. Same
 * shape as the stray-marker regex in ui-markers.ts.
 */
const MARKER_LINE_PATTERN = /^\s*---[a-z][a-z-]*---\s*$/m;

/**
 * Validate a module brief before save. Empty/null is always valid (no
 * steering — the module runs on card copy + opener alone). The brief composes
 * with the conductor, so no required-fragment guard applies (the crisis lines
 * and markers always arrive with the voice and cannot be edited away here).
 * Returns null when safe, or a plain-language error.
 */
export function validateModuleBrief(
  brief: string | null | undefined,
): string | null {
  if (brief == null || !brief.trim()) return null;
  if (MARKER_LINE_PATTERN.test(brief)) {
    return "The brief can't contain a ---marker--- line — markers are reserved for the app's own machinery.";
  }
  return null;
}
