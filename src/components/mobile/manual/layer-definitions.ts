import type { ManualComponent } from "@/lib/types";
import { LAYERS } from "@/lib/manual/layers";

export interface ManualEntry {
  id: string;
  name: string;
  content: string;
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  entries: ManualEntry[];
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

export function buildLayers(components: ManualComponent[]): Layer[] {
  return LAYER_DEFINITIONS.map((def) => {
    const entries: ManualEntry[] = components
      .filter((c) => c.layer === def.id)
      .map((c) => ({
        id: c.id || `entry-${def.id}-${c.name ?? c.content.slice(0, 20)}`,
        name: c.name || "Untitled",
        content: c.content,
      }));

    return {
      ...def,
      entries,
    };
  });
}
