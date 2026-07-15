import { PERSONA_NAME } from "@/lib/persona/config";
import type { OverrideRow } from "@/lib/persona/voice-overrides";

/**
 * App copy — admin-editable, user-facing UI strings for the onboarding and
 * Home surfaces: the Home welcome tile, the Manual index headings, and the
 * post-login consent (Seed) screen. (Per-module door copy moved to the
 * modules table in the modules cutover.) Stored as
 * rows in the shared `persona_voice_overrides` table and resolved
 * override-or-default exactly like the door intros. The code defaults below are
 * the permanent floor — a missing/disabled row or a DB error falls back to
 * them, so a screen always has copy.
 *
 * This is UI copy shown to the user, NOT Jove prompt text. It is resolved by
 * its own reader path (resolveAppCopy, fed by the user-facing /api routes) and
 * never enters the system prompt.
 *
 * This module is PURE — its only imports are PERSONA_NAME (a plain constant)
 * and the OverrideRow *type*. That keeps it safe to import from client
 * components, which use APP_COPY_DEFAULTS as their pre-fetch fallback. The
 * server reads the real rows (readOverrideRows) and resolves the full object;
 * the client falls back to these same defaults until that object arrives.
 */

export interface AppCopy {
  waysToBeginLabel: string;
  home: { welcomeEyebrow: string; welcomeBody: string };
  seed: {
    eyebrow: string;
    heading: string;
    body1: string;
    body2: string;
    body3: string;
    ageLabel: string;
    beginButton: string;
  };
}

/** The admin-panel section a field belongs to (drives the section order too). */
export const APP_COPY_GROUPS = [
  "Home",
  "Seed screen",
] as const;

/**
 * Flat registry: every editable key → its admin label, group, and code default.
 * Single source of truth for the valid keys — the admin route validates writes
 * against it, and resolveAppCopy maps rows through it. The defaults are the
 * exact strings the screens shipped with, so an empty table renders identically
 * to before this feature existed.
 */
export const APP_COPY_FIELDS: Record<
  string,
  { label: string; group: (typeof APP_COPY_GROUPS)[number]; getDefault: () => string }
> = {
  // The label above the Home module list. (Per-module card copy lives on the
  // modules table, edited at /admin/modules — not here.)
  ways_to_begin_label: {
    group: "Home",
    label: "Ways-to-begin label",
    getDefault: () => "Ways to begin",
  },

  // ── Home welcome tile (shown to new users with nothing to resume) ──
  home_welcome_eyebrow: {
    group: "Home",
    label: "Welcome tile — eyebrow",
    getDefault: () => "Welcome",
  },
  home_welcome_body: {
    group: "Home",
    label: "Welcome tile — body",
    getDefault: () =>
      "Start a conversation below — what you confirm becomes your Manual, a document about how you operate. Nothing’s saved unless you say so.",
  },

  // ── Seed / consent screen (SeedScreen) ──
  seed_eyebrow: {
    group: "Seed screen",
    label: "Eyebrow",
    getDefault: () => "Before you begin",
  },
  seed_heading: {
    group: "Seed screen",
    label: "Heading (the period is styled separately)",
    getDefault: () => "What this is, and isn’t",
  },
  seed_body1: {
    group: "Seed screen",
    label: "Body — paragraph 1",
    getDefault: () =>
      `${PERSONA_NAME} is AI. It helps you notice patterns in how you work, from what you actually say, in your own words. The things you confirm become entries in your Manual. You’re the authority on how you work, and ${PERSONA_NAME} isn’t here to fix you.`,
  },
  seed_body2: {
    group: "Seed screen",
    label: "Body — paragraph 2 (dimmed)",
    getDefault: () =>
      `This isn’t therapy, and ${PERSONA_NAME} isn’t a clinician. It’s a complement to other support, not a replacement. If something serious comes up, Crisis Support is one tap away in the menu.`,
  },
  seed_body3: {
    group: "Seed screen",
    label: "Body — paragraph 3",
    getDefault: () =>
      "Short answers are fine. “I don’t know” is fine. Leave and come back whenever.",
  },
  seed_age_label: {
    group: "Seed screen",
    label: "Age checkbox label",
    getDefault: () => "I’m 18 or older",
  },
  seed_begin_button: {
    group: "Seed screen",
    label: "Begin button",
    getDefault: () => "Begin",
  },
};

export function isAppCopyKey(value: unknown): boolean {
  return typeof value === "string" && value in APP_COPY_FIELDS;
}

/**
 * Resolve the full AppCopy object from already-read override rows. Pure: the
 * server reads rows (readOverrideRows) and calls this; the client never does
 * (it uses APP_COPY_DEFAULTS or the resolved object the API sends). Any
 * missing, disabled, or blank row falls back to the code default.
 */
export function resolveAppCopy(rows: Map<string, OverrideRow>): AppCopy {
  const r = (key: string): string => {
    const row = rows.get(key);
    if (
      row?.enabled &&
      typeof row.text_override === "string" &&
      row.text_override.trim()
    ) {
      return row.text_override;
    }
    return APP_COPY_FIELDS[key].getDefault();
  };
  return {
    waysToBeginLabel: r("ways_to_begin_label"),
    home: {
      welcomeEyebrow: r("home_welcome_eyebrow"),
      welcomeBody: r("home_welcome_body"),
    },
    seed: {
      eyebrow: r("seed_eyebrow"),
      heading: r("seed_heading"),
      body1: r("seed_body1"),
      body2: r("seed_body2"),
      body3: r("seed_body3"),
      ageLabel: r("seed_age_label"),
      beginButton: r("seed_begin_button"),
    },
  };
}

/** All-defaults AppCopy — the client's pre-fetch fallback and the test baseline. */
export const APP_COPY_DEFAULTS: AppCopy = resolveAppCopy(new Map());
