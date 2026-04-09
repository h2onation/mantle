import type { ManualComponent } from "@/lib/types";
import { LAYERS } from "@/lib/manual/layers";

export interface Thread {
  id: string;
  name: string;
  body: string;
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  threads: Thread[];
  isNew?: boolean;
}

// Adapter from the canonical LAYERS definition (src/lib/manual/layers.ts) to
// the shape this UI expects. The "about" field maps to LayerDefinition.description.
// LAYERS is the source of truth — never hardcode layer names here.
const LAYER_DEFINITIONS: Omit<Layer, "threads">[] = LAYERS.map((l) => ({
  id: l.id,
  name: l.name,
  about: l.description,
}));

export function buildLayers(components: ManualComponent[]): Layer[] {
  return LAYER_DEFINITIONS.map((def) => {
    const threads: Thread[] = components
      .filter((c) => c.layer === def.id)
      .map((c) => ({
        id: c.id || `entry-${def.id}-${c.name ?? c.content.slice(0, 20)}`,
        name: c.name || "Untitled",
        body: c.content,
      }));

    return {
      ...def,
      threads,
    };
  });
}
