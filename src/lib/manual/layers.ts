// ---------------------------------------------------------------------------
// Single source of truth for the 5-section behavioral Manual.
//
// Section names, descriptions, dimensions, and example phrases live here.
// Every consumer (extraction, system-prompt, classifier, confirm-checkpoint,
// mobile manual UI) imports from this file.
//
// NAMING NOTE (deliberate, documented divergence — structure migration):
//   In CODE the identifier is `layer` / `LAYERS` (kept to avoid a churny,
//   risk-for-no-user-benefit rename). In the PRODUCT the noun is "section".
//   The DB `manual_entries.section` slug is the stable structural key going
//   forward; the integer `manual_entries.layer` is FROZEN legacy provenance
//   (existing rows only — new rows are born with section + a NULL layer).
//   So "layer" in this file == "section" in the product. Translate, don't
//   rename.
// ---------------------------------------------------------------------------

export interface LayerDefinition {
  /** 1-5. Display order. */
  id: number;
  /** Stable structural key. Stored in manual_entries.section. */
  slug: string;
  /** User-facing display name. */
  name: string;
  /** Short description for UI tiles and prompt context. */
  description: string;
  /** One-line gloss for compact UI (e.g. the Home section index). Second
   *  person, punchier than `description`. */
  tagline: string;
  /** Dimensions the extraction layer tracks for this section. */
  dimensions: string[];
  /** One illustrative phrase per section, used in extraction prompt examples. */
  example: string;
}

export const LAYERS: readonly LayerDefinition[] = [
  {
    id: 1,
    slug: "relationships",
    name: "Relationships",
    description:
      "How you connect, withdraw, and show care — and the gap between what you mean and what people see.",
    tagline: "How you connect — and how you're read.",
    dimensions: [
      "connection style",
      "withdrawal and closeness",
      "conflict processing",
      "how others read you",
      "care expression",
    ],
    example: "When voices get raised I go offline. It's not stonewalling — my system shuts down input.",
  },
  {
    id: 2,
    slug: "work-money",
    name: "Work and career",
    description:
      "How you operate, mask, and hold up at work — under pressure, on a timeline, with stakes — and the kind of work that fits how you're built.",
    tagline: "How you hold up at work — and what fits.",
    dimensions: [
      "operating under pressure",
      "masking at work",
      "what you can absorb",
      "the line you won't cross",
      "fit and direction",
    ],
    example:
      "On a tight deadline I go quiet and inward, and by the time I surface there's already damage to repair.",
  },
  {
    id: 3,
    slug: "routines-structure",
    name: "Routines and structure",
    description:
      "The systems that hold your day up — what you depend on, how change lands, and what their collapse costs.",
    tagline: "The systems that hold your day up.",
    dimensions: [
      "daily systems",
      "structure dependency",
      "how change lands",
      "transitions",
      "what collapse costs",
    ],
    example:
      "When plans change I go still while the new variables get integrated. Interrupt me in the first thirty seconds and I lose another five.",
  },
  {
    id: 4,
    slug: "sensory-burnout",
    name: "Sensory and burnout",
    description:
      "What your body takes in and what it costs. Sensory load, overload, shutdown, and what recovery actually requires.",
    tagline: "What your body takes in, and what it costs.",
    dimensions: [
      "sensory load",
      "overload indicators",
      "shutdown",
      "what recovery requires",
      "the stack before the last thing",
    ],
    example:
      "Fluorescent lights and background noise are load on my system. By the time I seem irritable I've been absorbing input for hours.",
  },
  {
    id: 5,
    slug: "interests-flow",
    name: "Interests and flow",
    description:
      "Where you go deep and do your best work. The domains that pull you in and the state most people can't access.",
    tagline: "Where you go deep and do your best work.",
    dimensions: [
      "deep focus",
      "flow states",
      "hyperfocus",
      "best work",
      "absorption",
    ],
    example:
      "When something captures my attention I can stay with it for hours in a state most people can't access.",
  },
] as const;

/** Closed tag set. `strength` anywhere; the relationship sub-tags only inside
 *  the relationships section (enforced by a DB CHECK; mirrored here for the UI). */
export const TAGS = ["strength", "romantic", "family", "friends"] as const;
export type Tag = (typeof TAGS)[number];
export const RELATIONSHIP_TAGS: readonly Tag[] = ["romantic", "family", "friends"];

/** Sentinel group key for entries with no section yet — the "held" group.
 *  Used by the Manual UI to gather NULL-section entries (deliberately parked
 *  self-to-self patterns + any straggler) without mis-filing them into a
 *  life-area. See docs/reference/structure-migration-plan.md §3.4 / Rule C. */
export const HELD_SECTION = "__held__" as const;

// ── HELD GROUP COPY — STUB. Jeff finalizes the voice (decision D2). ──────────
// This is the visible group for parked (NULL-section) entries — the proto-face
// of the deferred "inner-world" section. It must read as a REAL kind of pattern
// (self-to-self: how you relate to yourself), NOT "Unsorted" / an error state
// (the audience carries completion-anxiety). DO NOT SHIP these strings as-is.
export const HELD_GROUP_LABEL = "How you relate to yourself"; // COPY STUB (D2)
export const HELD_GROUP_ABOUT =
  "Patterns about your relationship with yourself — held here while we see whether this becomes its own section."; // COPY STUB (D2)

const SECTION_BY_SLUG: Record<string, LayerDefinition> = Object.fromEntries(
  LAYERS.map((l) => [l.slug, l])
);

/** The grouping key for an entry: its section slug, or HELD_SECTION when the
 *  entry has no section (parked). PURE — returns a display value, never
 *  mutates the entry and is never persisted (the no-write-back guard). */
export function sectionForEntry(entry: { section?: string | null }): string {
  return entry.section ?? HELD_SECTION;
}

/** Display name for a section slug. Falls back to a readable form of an
 *  unknown slug rather than throwing. */
export function sectionName(slug: string | null | undefined): string {
  if (!slug) return "Held";
  return SECTION_BY_SLUG[slug]?.name ?? slug;
}

/** Lookup table for `Layer N (Name)` rendering. Imported by every consumer.
 *  Keyed by display-order id (1-5). */
export const LAYER_NAMES: Record<number, string> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.name])
);

/** Roman-numeral-as-word ordinal per section. */
export const LAYER_ORDINAL: Record<number, string> = {
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
};

/**
 * Canonical eyebrow string for any checkpoint-shaped surface. Takes a section
 * SLUG (the new structural key). Falls back to "Suggested Entry" when the
 * section is missing/unknown (e.g. a parked self-pattern checkpoint).
 */
export function formatLayerEyebrow(section: string | null | undefined): string {
  if (!section || !SECTION_BY_SLUG[section]) return "Suggested Entry";
  return SECTION_BY_SLUG[section].name;
}

/**
 * Canonical "Manual entry inside a prompt" rendering. Used wherever the full
 * content of an entry needs to be inlined into an LLM prompt.
 * Shape: `Section (Name) [— "headline"]:\ncontent\n`
 */
export function renderManualEntryFull(entry: {
  section?: string | null;
  name: string | null;
  content: string;
}): string {
  const label = entry.section ? sectionName(entry.section) : "Held (no section yet)";
  const headline = entry.name ? ` — "${entry.name}"` : "";
  return `Section: ${label}${headline}:\n${entry.content}\n`;
}

/**
 * Per-section empty-state copy for the Manual page. Two beats render inside the
 * Plate when a section has no confirmed entries:
 *   • STATUS — one italic sentence naming the absence AND what the section is for.
 *   • INVITE — one italic line in Jove's voice. Opens a door.
 * Keyed by display-order id (1-5).
 */
export const LAYER_EMPTY_STATUS: Record<number, string> = {
  1: "Nothing about how you connect with people yet.",
  2: "Nothing about how you operate at work yet.",
  3: "Nothing about the systems that hold your day up yet.",
  4: "Nothing about what your body takes in yet.",
  5: "Nothing about where you go deep yet.",
};

export const LAYER_EMPTY_INVITE: Record<number, string> = {
  1: "Pick someone you're close to. What does showing up there look like?",
  2: "Tell me about a moment at work the pressure changed how you operate.",
  3: "Start anywhere — even one small thing that holds your day together.",
  4: "Tell me about a recent moment your system was working harder than it looked.",
  5: "What activates the version of you most people don't get to see?",
};
