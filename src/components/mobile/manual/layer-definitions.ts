import type { CSSProperties } from "react";
import type { ManualEntry } from "@/lib/types";
import { LAYERS } from "@/lib/manual/layers";

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
  id: number;
  /** Section slug — one of the five life-area sections. */
  slug: string;
  name: string;
  about: string;
  tagline: string;
  entries: Entry[];
  isNew?: boolean;
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
  // Group by SECTION (the structural key). Every entry is homed on one of the
  // five life-area sections; the frozen `layer` integer is not used here. An
  // entry with no matching section simply doesn't render (a guard — composition
  // always assigns one of the five, so this should never happen).
  return LAYER_DEFINITIONS.map((def) => ({
    ...def,
    entries: entries
      .filter((e) => e.section === def.slug)
      .map((e) => toEntry(e, def.slug)),
  }));
}
