import type { ManualComponent } from "@/lib/types";
import { LAYERS } from "@/lib/manual/layers";

export interface Pattern {
  id: string;
  name: string;
  description: string;
}

export interface LayerComponent {
  narrative: string;
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  component: LayerComponent | null;
  patterns: Pattern[];
  isNew?: boolean;
}

// Adapter from the canonical LAYERS definition (src/lib/manual/layers.ts) to
// the shape this UI expects. The "about" field maps to LayerDefinition.description.
// LAYERS is the source of truth — never hardcode layer names here.
const LAYER_DEFINITIONS: Omit<Layer, "component" | "patterns">[] = LAYERS.map(
  (l) => ({
    id: l.id,
    name: l.name,
    about: l.description,
  })
);

export function buildLayers(components: ManualComponent[]): Layer[] {
  return LAYER_DEFINITIONS.map((def) => {
    const layerComponents = components.filter((c) => c.layer === def.id);
    const comp = layerComponents.find((c) => c.type === "component");
    const patterns = layerComponents
      .filter((c) => c.type === "pattern")
      .map((c) => ({
        id: c.id || `pattern-${def.id}-${c.name}`,
        name: c.name || "Unnamed pattern",
        description: c.content,
      }));

    return {
      ...def,
      component: comp ? { narrative: comp.content } : null,
      patterns,
    };
  });
}
