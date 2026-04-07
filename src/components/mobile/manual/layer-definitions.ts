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
  emptyHelper: string;
  threads: Thread[];
  isNew?: boolean;
}

// UI-only copy: section-specific helper text shown when a layer has no entries.
// Lives here (not in src/lib/manual/layers.ts) so backend consumers of LAYERS
// don't drag UI copy into prompts and extraction code.
const EMPTY_HELPER: Record<number, string> = {
  1: "Start by telling Sage about a situation.",
  2: "This fills in as you talk about how the world hits you.",
  3: "Sage will surface what you need as you describe your life.",
  4: "Talk about a relationship and this starts to build.",
  5: "Your strengths show up when you describe what you're good at.",
};

// Adapter from the canonical LAYERS definition (src/lib/manual/layers.ts) to
// the shape this UI expects. The "about" field maps to LayerDefinition.description.
// LAYERS is the source of truth — never hardcode layer names here.
const LAYER_DEFINITIONS: Omit<Layer, "threads">[] = LAYERS.map((l) => ({
  id: l.id,
  name: l.name,
  about: l.description,
  emptyHelper: EMPTY_HELPER[l.id] ?? "",
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
