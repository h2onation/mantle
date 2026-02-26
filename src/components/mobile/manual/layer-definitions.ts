import type { ManualComponent } from "@/lib/types";

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

const LAYER_DEFINITIONS: Omit<Layer, "component" | "patterns">[] = [
  {
    id: 1,
    name: "What Drives You",
    about: "Your core needs and values \u2014 the things you organize your life around, often without realizing it. When these are met, you feel grounded. When they\u2019re threatened, your patterns activate.",
  },
  {
    id: 2,
    name: "Your Self Perception",
    about: "How you see yourself \u2014 the beliefs you hold about who you are, what you deserve, and what you\u2019re capable of. These beliefs act as filters on everything you experience.",
  },
  {
    id: 3,
    name: "Your Reaction System",
    about: "How you process pressure, conflict, and emotional intensity. The internal operating system that activates when things get difficult \u2014 your default responses before conscious choice kicks in.",
  },
  {
    id: 4,
    name: "How You Operate",
    about: "Your functional patterns \u2014 how you think, decide, manage energy, and handle complexity. The day-to-day machinery of how you move through the world.",
  },
  {
    id: 5,
    name: "Your Relationship to Others",
    about: "How you connect, communicate, build trust, and repair. The relational layer \u2014 how others actually experience you, and the patterns that play out between people.",
  },
];

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
