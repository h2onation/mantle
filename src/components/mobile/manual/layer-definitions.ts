import type { CSSProperties } from "react";
import type { ManualEntry } from "@/lib/types";
import type { HomeModule } from "@/lib/modules";

// Shared white-tile shell for a section on the Manual page — the same
// material Home uses for its cards (cream-bright fill, hairline border, soft
// card shadow, 16px radius). One source of truth for PopulatedLayer and
// EmptyLayer so the two tile states never drift apart.
export const SECTION_TILE_STYLE: CSSProperties = {
  borderRadius: 16,
  background: "var(--session-cream-bright)",
  border: "1px solid var(--session-hair)",
  boxShadow: "var(--session-card-shadow, none)",
  padding: "16px 18px",
};

export interface Entry {
  id: string;
  name: string;
  body: string;
  /** ISO timestamp the entry was confirmed. Drives the read-view
   *  provenance line ("Added from a conversation · {month}"). */
  createdAt?: string;
}

export interface Layer {
  /** Module slug — the group's identity (and conversations' mode). */
  slug: string;
  name: string;
  about: string;
  /** Short line under the name in section headers (the module description). */
  tagline: string;
  entries: Entry[];
  /** False when the module is disabled: its section still renders (entries
   *  never orphan) but it is not tappable as a door. */
  enabled: boolean;
}

function toEntry(e: ManualEntry, groupKey: string): Entry {
  return {
    id: e.id || `entry-${groupKey}-${e.name ?? e.content.slice(0, 20)}`,
    name: e.name || "Untitled",
    body: e.content,
    createdAt: e.created_at,
  };
}

/**
 * Group Manual entries by module (an entry's `section` is the slug of the
 * module its conversation started inside). One group per module, in module
 * display order. Enabled modules always render (even empty — the section
 * exists the moment the door does); disabled modules render only while they
 * still hold entries, so nothing ever orphans but retired empty modules
 * don't clutter the Manual.
 */
export function buildModuleGroups(
  modules: HomeModule[],
  entries: ManualEntry[],
): Layer[] {
  return modules
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      about: m.description,
      tagline: m.description,
      enabled: m.enabled,
      entries: entries
        .filter((e) => e.section === m.slug)
        .map((e) => toEntry(e, m.slug)),
    }))
    .filter((g) => g.enabled || g.entries.length > 0);
}
