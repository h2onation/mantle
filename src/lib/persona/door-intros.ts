import type { createAdminClient } from "@/lib/supabase/admin";
import type { ConversationMode } from "@/lib/persona/config";
import { readOverrideRows } from "@/lib/persona/voice-overrides";

/**
 * Per-door intro copy — the one-time "how this works" explainer each intake
 * door shows the first time a user opens it. Admin-editable (title + body per
 * door) via the "Intake doors" panel, stored as rows in the shared
 * persona_voice_overrides table keyed by `{slug}_intro_title` /
 * `{slug}_intro_body`. The code defaults below are the permanent floor — a
 * missing/disabled row or a DB error falls back to them, so the modal always
 * has copy to show.
 *
 * This is UI copy shown to the user, NOT prompt text — it is deliberately
 * read by its own reader (getDoorIntros), separate from getVoiceOverrides,
 * so it never leaks into Jove's system prompt.
 *
 * The eyebrow ("BEFORE YOU BEGIN") is a fixed UI constant, not per-door
 * config — one less field to tune. The opening message Jove speaks is the
 * door's *opener* (situation/guided-intake/upload), edited in the same panel
 * but resolved through getVoiceOverrides (see DOOR_OPENER_KEYS).
 */

export const DOOR_INTRO_EYEBROW = "BEFORE YOU BEGIN";

const NOTHING_LINE = "Nothing gets written without your yes.";

export interface DoorDef {
  mode: ConversationMode;
  /** Underscore slug used in override keys (mode with hyphens → underscores). */
  slug: string;
  /** Door name shown in the welcome cards + the default intro title. */
  name: string;
  /**
   * Override key for this door's opening message (in VOICE_OVERRIDE_FIELDS).
   * Undefined for guided-intake: its opener is a model-generated tee-up, not
   * a fixed editable string, so there is no opener field to surface in admin.
   */
  openerKey?: string;
}

// Order matches the welcome-screen entry cards (situation first).
export const DOORS: DoorDef[] = [
  {
    mode: "situation",
    slug: "situation",
    name: "Navigate a situation",
    // No openerKey — the model opens live; the old fixed SITUATION_OPENER was
    // never consumed by any runtime path (dead key removed 2026-07-07).
  },
  {
    mode: "guided-intake",
    slug: "guided_intake",
    name: "Guided intake",
    // No openerKey — opener is generated live (see TEE-UP in system-prompt).
  },
  {
    mode: "upload",
    slug: "upload",
    name: "Upload",
    openerKey: "upload_opener",
  },
];

export function doorForMode(mode: ConversationMode): DoorDef | undefined {
  return DOORS.find((d) => d.mode === mode);
}

// Default intro copy per door. Title defaults to the door name (so the modal
// names the door the user just opened); body is a concise "how this works"
// that keeps the "nothing without your yes" anchor.
const DEFAULT_INTRO: Record<string, { title: string; body: string }> = {
  situation: {
    title: "Navigate a situation",
    body:
      "Bring something specific that's on your mind — a conflict you're still chewing on, a reaction that surprised you, a pattern you keep noticing. Talk it through with Jove. As you do, Jove reflects back what it notices about how you operate. What you confirm gets written to your Manual.\n\n" +
      NOTHING_LINE,
  },
  guided_intake: {
    title: "Guided intake",
    body:
      "Not sure where to start? Let Jove lead. It asks a series of questions — about the people, routines, and moments that shape your days — and builds from your answers. Tap an option or type your own. What you confirm gets written to your Manual.\n\n" +
      NOTHING_LINE,
  },
  upload: {
    title: "Upload",
    body:
      "Paste something you were part of or that's been sitting with you — a text thread, an email chain, a journal entry. Jove reads the whole thing, then asks what made you want to share it and what it shows about how you operate. What you confirm gets written to your Manual.\n\n" +
      NOTHING_LINE,
  },
};

export function introTitleKey(slug: string): string {
  return `${slug}_intro_title`;
}
export function introBodyKey(slug: string): string {
  return `${slug}_intro_body`;
}

/**
 * Maps each intro-copy override key to its code default. Single source of
 * truth for valid intro keys: the admin route validates writes against it and
 * the reader maps rows through it.
 */
export const DOOR_INTRO_FIELDS: Record<
  string,
  { label: string; getDefault: () => string }
> = Object.fromEntries(
  DOORS.flatMap((d) => [
    [
      introTitleKey(d.slug),
      {
        label: `${d.name} — intro title`,
        getDefault: () => DEFAULT_INTRO[d.slug].title,
      },
    ],
    [
      introBodyKey(d.slug),
      {
        label: `${d.name} — intro body`,
        getDefault: () => DEFAULT_INTRO[d.slug].body,
      },
    ],
  ]),
);

export function isDoorIntroKey(value: unknown): boolean {
  return typeof value === "string" && value in DOOR_INTRO_FIELDS;
}

export interface DoorIntro {
  eyebrow: string;
  title: string;
  body: string;
}

/**
 * Resolve the per-door intro copy (eyebrow + title + body) for every door.
 * Reads the shared overrides table once; any missing/disabled row falls back
 * to the code default. Returns a map keyed by ConversationMode.
 */
export async function getDoorIntros(
  admin: ReturnType<typeof createAdminClient>,
): Promise<Record<ConversationMode, DoorIntro>> {
  let rows: Awaited<ReturnType<typeof readOverrideRows>>;
  try {
    rows = await readOverrideRows(admin);
  } catch {
    rows = new Map();
  }

  const resolve = (key: string): string => {
    const row = rows.get(key);
    if (row?.enabled && typeof row.text_override === "string" && row.text_override.trim()) {
      return row.text_override;
    }
    return DOOR_INTRO_FIELDS[key].getDefault();
  };

  const out = {} as Record<ConversationMode, DoorIntro>;
  for (const d of DOORS) {
    out[d.mode] = {
      eyebrow: DOOR_INTRO_EYEBROW,
      title: resolve(introTitleKey(d.slug)),
      body: resolve(introBodyKey(d.slug)),
    };
  }
  return out;
}
