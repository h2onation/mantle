// ---------------------------------------------------------------------------
// Single source of truth for the 5-section behavioral manual.
//
// Layer names, descriptions, dimensions, and example phrases live here.
// Every consumer (extraction, system-prompt, classifier, confirm-checkpoint,
// mobile manual UI) imports from this file. Renaming a layer or shifting its
// scope is a one-line change here, not a 12-file migration.
//
// If you find yourself hardcoding a layer name in another file, stop and
// import it instead. The Feb 2026 layer rename and the Apr 2026 ND pivot
// both required touching this codebase in 5+ places because layer names
// were duplicated. That problem now lives here.
// ---------------------------------------------------------------------------

export interface LayerDefinition {
  /** 1-5. Stable across renames. The DB stores this. */
  id: number;
  /** URL/programmatic identifier. Stable across renames. */
  slug: string;
  /** User-facing display name. */
  name: string;
  /** Short description for UI tiles and prompt context. */
  description: string;
  /** Dimensions the extraction layer tracks for this section. */
  dimensions: string[];
  /** One illustrative phrase per section, used in extraction prompt examples. */
  example: string;
}

export const LAYERS: readonly LayerDefinition[] = [
  {
    id: 1,
    slug: "patterns",
    name: "Some of My Patterns",
    description:
      "What behavior means when you can't explain it in the moment. Silence, freezing, shutdown, masking — the signals other people misread.",
    dimensions: [
      "masking signals",
      "shutdown triggers",
      "freeze responses",
      "what silence means",
      "what others misread",
    ],
    example: "When plans change I go still. It looks like resistance. It's recalculation.",
  },
  {
    id: 2,
    slug: "processing",
    name: "How I Process Things",
    description:
      "Sensory experience, how change lands, how information gets taken in, what overload looks and feels like.",
    dimensions: [
      "sensory sensitivities",
      "processing speed",
      "change response",
      "overload indicators",
      "information intake style",
    ],
    example:
      "Fluorescent lights and background noise are load on my system. By the time I seem irritable I've been absorbing input for hours.",
  },
  {
    id: 3,
    slug: "what-helps",
    name: "What Helps",
    description:
      "What you need to function. Alone time, routine, environment, recovery, structure. Why these are non-negotiable, not preferences.",
    dimensions: [
      "non-negotiable needs",
      "environment requirements",
      "recovery patterns",
      "routine dependency",
      "structure",
    ],
    example: "I need roughly an hour alone after social time. This is maintenance, not withdrawal.",
  },
  {
    id: 4,
    slug: "with-people",
    name: "How I Show Up with People",
    description:
      "How you connect, handle conflict, show care. What withdrawal and closeness actually look like from your side.",
    dimensions: [
      "connection style",
      "conflict processing",
      "care expression",
      "withdrawal/closeness mechanics",
      "social energy",
    ],
    example:
      "When voices get raised I go offline. It's not stonewalling. My system shuts down input.",
  },
  {
    id: 5,
    slug: "where-strong",
    name: "Where I'm Strong",
    description:
      "What you bring when conditions are right. Strengths in context, not in isolation. The state others rarely see and what activates it.",
    dimensions: [
      "hyperfocus",
      "pattern recognition",
      "systemizing",
      "loyalty",
      "honesty",
      "context-dependent capabilities",
    ],
    example:
      "When something captures my attention I can stay with it for hours in a state most people can't access.",
  },
] as const;

/** Lookup table for `Layer N (Name)` rendering. Imported by every consumer. */
export const LAYER_NAMES: Record<number, string> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.name])
);

/** Total layer count. Avoid hardcoding `5` in loops. */
export const LAYER_COUNT = LAYERS.length;

/** Get a layer by id, or undefined if id is out of range. */
export function getLayer(id: number): LayerDefinition | undefined {
  return LAYERS.find((l) => l.id === id);
}
