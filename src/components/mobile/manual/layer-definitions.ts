import type { ManualEntry } from "@/lib/types";
import {
  LAYERS,
  HELD_SECTION,
  HELD_GROUP_LABEL,
  HELD_GROUP_ABOUT,
  sectionForEntry,
} from "@/lib/manual/layers";

export const LAYER_ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

export interface Entry {
  id: string;
  name: string;
  body: string;
  /** ISO timestamp the entry was confirmed. Drives the read-view
   *  provenance line ("Added from a conversation · {month}"). */
  createdAt?: string;
}

export interface Layer {
  id: number;
  /** Section slug (or HELD_SECTION for the held group). */
  slug: string;
  name: string;
  about: string;
  tagline: string;
  entries: Entry[];
  isNew?: boolean;
  /** True for the "held" group — parked (NULL-section) entries. The UI uses
   *  this to render it apart from the five life-area sections. */
  isHeld?: boolean;
}

// Adapter from the canonical LAYERS definition (src/lib/manual/layers.ts) to
// the shape this UI expects. LAYERS is the source of truth — never hardcode
// section names here.
const LAYER_DEFINITIONS: Omit<Layer, "entries">[] = LAYERS.map((l) => ({
  id: l.id,
  slug: l.slug,
  name: l.name,
  about: l.description,
  tagline: l.tagline,
}));

function toEntry(e: ManualEntry, groupKey: string): Entry {
  return {
    id: e.id || `entry-${groupKey}-${e.name ?? e.content.slice(0, 20)}`,
    name: e.name || "Untitled",
    body: e.content,
    createdAt: e.created_at,
  };
}

export function buildLayers(entries: ManualEntry[]): Layer[] {
  // Group by SECTION (the structural key). The frozen `layer` integer is not
  // used here. sectionForEntry is pure display — it never writes back, so a
  // parked entry stays NULL in the data (the no-write-back guard).
  const sections: Layer[] = LAYER_DEFINITIONS.map((def) => ({
    ...def,
    entries: entries
      .filter((e) => sectionForEntry(e) === def.slug)
      .map((e) => toEntry(e, def.slug)),
  }));

  // The held group: parked (NULL-section) entries. Rendered only when non-empty,
  // and visually apart (isHeld). COPY STUB label/about — Jeff finalizes (D2).
  const heldEntries = entries
    .filter((e) => sectionForEntry(e) === HELD_SECTION)
    .map((e) => toEntry(e, "held"));
  if (heldEntries.length > 0) {
    sections.push({
      id: 99,
      slug: HELD_SECTION,
      name: HELD_GROUP_LABEL,
      about: HELD_GROUP_ABOUT,
      tagline: "",
      isHeld: true,
      entries: heldEntries,
    });
  }

  return sections;
}
