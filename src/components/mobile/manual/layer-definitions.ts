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

export interface Thread {
  id: string;
  name: string;
  body: string;
  // Source kind preserved so the future component/pattern removal PR can lean on it.
  // UI renders both kinds identically.
  kind: "component" | "pattern";
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  emptyHelper: string;
  component: LayerComponent | null;
  patterns: Pattern[];
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
const LAYER_DEFINITIONS: Omit<Layer, "component" | "patterns" | "threads">[] = LAYERS.map(
  (l) => ({
    id: l.id,
    name: l.name,
    about: l.description,
    emptyHelper: EMPTY_HELPER[l.id] ?? "",
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

    // Threads = components first, then patterns. Both rendered identically by the UI.
    // component/patterns are still kept above so the PDF generator and any other
    // consumer that distinguishes the two keeps working until the future PR removes
    // the distinction at the data layer.
    const threads: Thread[] = [];
    if (comp) {
      threads.push({
        id: comp.id || `component-${def.id}`,
        name: comp.name || "Untitled",
        body: comp.content,
        kind: "component",
      });
    }
    for (const p of patterns) {
      threads.push({
        id: p.id,
        name: p.name,
        body: p.description,
        kind: "pattern",
      });
    }

    return {
      ...def,
      component: comp ? { narrative: comp.content } : null,
      patterns,
      threads,
    };
  });
}
