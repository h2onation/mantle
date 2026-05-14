import type { ManualEntry } from "@/lib/types";
import { LAYERS } from "@/lib/manual/layers";

export interface Entry {
  id: string;
  name: string;
  body: string;
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  entries: Entry[];
  isNew?: boolean;
}

// Adapter from the canonical LAYERS definition (src/lib/manual/layers.ts) to
// the shape this UI expects. The "about" field maps to LayerDefinition.description.
// LAYERS is the source of truth — never hardcode layer names here.
const LAYER_DEFINITIONS: Omit<Layer, "entries">[] = LAYERS.map((l) => ({
  id: l.id,
  name: l.name,
  about: l.description,
}));

export function buildLayers(entries: ManualEntry[]): Layer[] {
  return LAYER_DEFINITIONS.map((def) => {
    const layerEntries: Entry[] = entries
      .filter((e) => e.layer === def.id)
      .map((e) => ({
        id: e.id || `entry-${def.id}-${e.name ?? e.content.slice(0, 20)}`,
        name: e.name || "Untitled",
        body: e.content,
      }));

    return {
      ...def,
      entries: layerEntries,
    };
  });
}
