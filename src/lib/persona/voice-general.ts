// ---------------------------------------------------------------------------
// Jove voice — general mode (persona delta).
//
// Trait-delta module. The base voice lives in voice-scaffold.ts. The general
// persona has NO trait-specific additions — the base voice carries it
// completely. Every exported array below is empty by design.
//
// Why this module still exists: composeTier2() in system-prompt.ts treats
// every PersonaMode the same way and reads these exports. Keeping the empty
// shapes preserves the uniform interface — no special-casing needed.
// ---------------------------------------------------------------------------

export const VOICE_INTRO_PARAGRAPHS: readonly string[] = [
  "The user has not named a neurotype. They are reflective, curious, and looking for language to describe patterns they can feel but haven't named. Default to neutral framing — no somatic-first defaults, no neurotype-specific vocabulary.",
] as const;

export const VOICE_RULES: readonly string[] = [] as const;

export const EXAMPLE_REGISTER: readonly {
  label: string;
  line: string;
}[] = [] as const;

export const LANDING_EXAMPLES: readonly {
  label: string;
  line: string;
}[] = [] as const;

export const DEEPENING_ADDITIONS = "";

export const WEAK_STRONG_EXAMPLES: readonly {
  weak: string;
  strong: string;
}[] = [] as const;
