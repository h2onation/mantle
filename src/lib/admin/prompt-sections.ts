import {
  composeTier2,
  buildSystemPrompt,
  type PersonaMode,
  type OneOnOnePromptOptions,
} from "@/lib/persona/system-prompt";
import { LIVE_VOICE_VARIANT, type ConversationMode } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier = "intro" | "1" | "2" | "3" | "dynamic";
export type ConditionType = "always" | "persona" | "state" | "conv-mode" | "dynamic";

export interface SectionCondition {
  type: ConditionType;
  label: string;
}

export interface SectionSource {
  file: string;
  symbol: string;
}

export interface SectionAlternative {
  label: string;
  tokens: number;
  trigger: string;
}

export interface PromptSection {
  id: string;
  label: string;
  tier: Tier;
  text: string;
  tokens: number;
  condition: SectionCondition;
  source: SectionSource;
  alternatives: SectionAlternative[];
}

export interface PhaseData {
  id: string;
  label: string;
  description: string;
  sections: PromptSection[];
  totalTokens: number;
  deltaTokens: number | null;
  deltaBlocks: number | null;
  changes: string[];
}

type ConvMode = ConversationMode;

// ---------------------------------------------------------------------------
// Section header definitions — ordered by expected appearance in the prompt.
// Each entry's regex matches a line that starts a new section.
// ---------------------------------------------------------------------------

interface SectionDef {
  id: string;
  label: string;
  tier: Tier;
  pattern: RegExp;
  source: SectionSource;
  conditionFn: (modes: PersonaMode[], convMode: ConvMode) => SectionCondition;
  alternativesFn: (
    modes: PersonaMode[],
    convMode: ConvMode,
    altTokenCache: Map<string, number>,
  ) => SectionAlternative[];
}

const PERSONA_DISPLAY: Record<PersonaMode, string> = {
  autistic: "Autistic",
  adhd: "ADHD",
  dyslexic: "Dyslexic",
  general: "General",
};

const personaLabel = (modes: PersonaMode[]) =>
  modes.map((m) => PERSONA_DISPLAY[m] ?? m).join(" + ");

const PERSONA_ALL: PersonaMode[] = ["autistic", "adhd", "dyslexic", "general"];
const CONV_MODES: ConvMode[] = ["situation", "guided-intake", "upload"];
const CONV_MODE_LABELS: Record<ConvMode, string> = {
  situation: "Situation",
  "guided-intake": "Guided Intake",
  upload: "Upload",
};

function personaAlternatives(
  currentModes: PersonaMode[],
  altTokenCache: Map<string, number>,
): SectionAlternative[] {
  return PERSONA_ALL.filter((m) => !currentModes.includes(m)).map((m) => {
    const key = `tier2-${m}`;
    if (!altTokenCache.has(key)) {
      altTokenCache.set(key, estimateTokens(composeTier2([m])));
    }
    return {
      label: `Voice: ${m[0].toUpperCase() + m.slice(1)}`,
      tokens: altTokenCache.get(key)!,
      trigger: `Persona: ${m}`,
    };
  });
}

function convModeAlternatives(currentMode: ConvMode): SectionAlternative[] {
  return CONV_MODES.filter((m) => m !== currentMode).map((m) => ({
    label: CONV_MODE_LABELS[m],
    tokens: 0,
    trigger: `Conv mode: ${CONV_MODE_LABELS[m]}`,
  }));
}

const SECTION_DEFS: SectionDef[] = [
  // ── Rebuilt voice (Phase 3a — the LIVE voice; docs/voice-rebuild-proposal.md §8).
  // The "Live Voice ·" label prefix suppresses the legacy Tier-N display
  // prefix in displayLabel(). Legacy defs below still match when the viewer
  // renders the legacy variant (rollback or comparison).
  {
    id: "rebuilt-character",
    label: "Live Voice · Character",
    tier: "1",
    pattern: /^CHARACTER$/m,
    source: { file: "voice-scaffold.ts", symbol: "REBUILT_CHARACTER" },
    conditionFn: () => ({ type: "always", label: "Always (rebuilt voice)" }),
    alternativesFn: () => [],
  },
  {
    id: "rebuilt-limits",
    label: "Live Voice · Limits",
    tier: "1",
    pattern: /^LIMITS — these never bend$/m,
    source: { file: "voice-scaffold.ts", symbol: "REBUILT_LIMITS" },
    conditionFn: () => ({ type: "always", label: "Always (rebuilt voice)" }),
    alternativesFn: () => [],
  },
  {
    id: "rebuilt-mechanics",
    label: "Live Voice · Mechanics",
    tier: "2",
    pattern: /^MECHANICS — how Manual entries get made$/m,
    source: { file: "voice-scaffold.ts", symbol: "REBUILT_MECHANICS" },
    conditionFn: () => ({ type: "always", label: "Always (rebuilt voice)" }),
    alternativesFn: () => [],
  },
  {
    id: "intro",
    label: "Introduction",
    tier: "intro",
    pattern: /^You are \w+\./,
    source: { file: "system-prompt.ts", symbol: "buildSystemPrompt → intro" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "tier1",
    label: "Tier 1 · Constitutional Rules",
    tier: "1",
    pattern: /^TIER 1: CONSTITUTIONAL RULES/,
    source: { file: "system-prompt.ts", symbol: "TIER_1" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "tier2-voice",
    label: "Tier 2 · Voice",
    tier: "2",
    pattern: /^TIER 2: VOICE AND BEHAVIOR/,
    source: { file: "voice-scaffold.ts + voice-*.ts", symbol: "VOICE_INTRO_PARAGRAPHS_BASE + VOICE_INTRO_PARAGRAPHS" },
    conditionFn: (modes) => ({ type: "persona", label: `Persona: ${personaLabel(modes)}` }),
    alternativesFn: (modes, _, cache) => personaAlternatives(modes, cache),
  },
  {
    id: "voice-rules",
    label: "Voice Rules",
    tier: "2",
    pattern: /^VOICE RULES$/m,
    source: { file: "voice-scaffold.ts + voice-*.ts", symbol: "VOICE_RULES_BASE + VOICE_RULES" },
    conditionFn: (modes) => ({ type: "persona", label: `Persona: ${personaLabel(modes)}` }),
    alternativesFn: (modes, _, cache) => personaAlternatives(modes, cache),
  },
  {
    id: "banned-phrases",
    label: "Banned Phrases",
    tier: "2",
    pattern: /^BANNED PHRASES$/m,
    source: { file: "voice-scaffold.ts", symbol: "BANNED_PHRASES, BANNED_PATTERNS" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "example-register",
    label: "Example Register",
    tier: "2",
    pattern: /^EXAMPLE REGISTER$/m,
    source: { file: "voice-scaffold.ts + voice-*.ts", symbol: "EXAMPLE_REGISTER_BASE + EXAMPLE_REGISTER" },
    conditionFn: (modes) => ({ type: "persona", label: `Persona: ${personaLabel(modes)}` }),
    alternativesFn: (modes, _, cache) => personaAlternatives(modes, cache),
  },
  {
    id: "landing",
    label: "Landing",
    tier: "2",
    pattern: /^LANDING$/m,
    source: { file: "voice-scaffold.ts + voice-*.ts", symbol: "LANDING_INTRO, LANDING_EXAMPLES_BASE + LANDING_EXAMPLES" },
    conditionFn: (modes) => ({ type: "persona", label: `Persona: ${personaLabel(modes)}` }),
    alternativesFn: (modes, _, cache) => personaAlternatives(modes, cache),
  },
  {
    id: "deepening",
    label: "Deepening",
    tier: "2",
    pattern: /^DEEPENING$/m,
    source: { file: "voice-scaffold.ts", symbol: "DEEPENING_INTRO, WEAK_STRONG_EXAMPLES_BASE" },
    conditionFn: (modes) => ({ type: "persona", label: `Persona: ${personaLabel(modes)}` }),
    alternativesFn: (modes, _, cache) => personaAlternatives(modes, cache),
  },
  {
    id: "pacing",
    label: "Pacing",
    tier: "2",
    pattern: /^PACING$/m,
    source: { file: "voice-scaffold.ts", symbol: "PACING_RULE" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "when-wrong",
    label: "Repair Protocol",
    tier: "2",
    pattern: /^WHEN JOVE IS WRONG$/m,
    source: { file: "voice-scaffold.ts", symbol: "WHEN_JOVE_IS_WRONG" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "advisory",
    label: "Advisory",
    tier: "2",
    pattern: /^WHEN THE USER ASKS/m,
    source: { file: "voice-scaffold.ts", symbol: "WHEN_USER_ASKS_WHAT_SHOULD_I_DO" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "tier3",
    label: "Tier 3 · Conversation Mechanics",
    tier: "3",
    pattern: /^TIER 3: CONVERSATION MECHANICS$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "first-message",
    label: "First Message",
    tier: "3",
    // Match both today's actual emit `FIRST MESSAGE (new user, situation mode)`
    // and any future mode variants. The prior pattern required the line to end
    // with `(new user)`, which never matched the situation-mode header — so
    // the block silently dropped from the page.
    pattern: /^FIRST MESSAGE \(new user/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → FIRST MESSAGE" },
    conditionFn: () => ({ type: "state", label: "State: new user, situation mode, turns 1–3" }),
    alternativesFn: () => [],
  },
  {
    id: "guided-intake",
    label: "Guided Intake",
    tier: "3",
    pattern: /^GUIDED INTAKE$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → GUIDED INTAKE" },
    conditionFn: () => ({ type: "conv-mode", label: "Conv mode: Guided Intake" }),
    alternativesFn: (_, convMode) => convModeAlternatives(convMode),
  },
  {
    id: "upload-mode",
    label: "Upload Mode",
    tier: "3",
    pattern: /^UPLOAD MODE$/m,
    source: { file: "system-prompt.ts + upload-copy.ts", symbol: "buildTier3 → UPLOAD MODE" },
    conditionFn: () => ({ type: "conv-mode", label: "Conv mode: Upload, turns 1–2" }),
    alternativesFn: (_, convMode) => convModeAlternatives(convMode),
  },
  {
    id: "returning-user",
    label: "Returning User",
    tier: "3",
    pattern: /^RETURNING USER$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → RETURNING USER" },
    conditionFn: () => ({ type: "state", label: "State: returning user" }),
    alternativesFn: () => [],
  },
  {
    id: "returning-user-first-turn-situation",
    label: "Returning User · Situation Opener",
    tier: "3",
    // Header: "RETURNING USER — SITUATION OPENER AND EARLY TURNS (situation mode)"
    // (em dash U+2014). Fires when isReturningUser && mode === "situation" && turnCount <= 3.
    pattern: /^RETURNING USER — SITUATION OPENER/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → RETURNING USER (situation early turns)" },
    conditionFn: () => ({ type: "state", label: "State: returning user, situation, early turns" }),
    alternativesFn: () => [],
  },
  {
    id: "post-rejection",
    label: "Post-Rejection",
    tier: "3",
    pattern: /^POST-REJECTION/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → POST-REJECTION" },
    conditionFn: () => ({ type: "state", label: "State: after a checkpoint rejection" }),
    alternativesFn: () => [],
  },
  {
    id: "post-confirm-first-message-2",
    label: "Post-Confirm · First Lifetime Entry",
    tier: "3",
    // Header: "POST-CONFIRM — FIRST LIFETIME ENTRY" (em dash U+2014).
    // Fires when postConfirmMode === "first-message-2" — only on the very
    // first lifetime checkpoint confirmation (Track A Phase 7-High).
    pattern: /^POST-CONFIRM — FIRST LIFETIME ENTRY/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → POST-CONFIRM (first lifetime)" },
    conditionFn: () => ({ type: "state", label: "State: first lifetime confirm" }),
    alternativesFn: () => [],
  },
  {
    id: "post-confirm-subsequent-single",
    label: "Post-Confirm · Subsequent Entry",
    tier: "3",
    // Header: "POST-CONFIRM — SUBSEQUENT ENTRY" (em dash U+2014).
    // Fires when postConfirmMode === "subsequent-single" — every confirm
    // after the first lifetime one (Track A Phase 7-High).
    pattern: /^POST-CONFIRM — SUBSEQUENT ENTRY/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → POST-CONFIRM (subsequent)" },
    conditionFn: () => ({ type: "state", label: "State: subsequent confirm" }),
    alternativesFn: () => [],
  },
  {
    id: "adapting",
    label: "Adapting",
    tier: "3",
    pattern: /^ADAPTING$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → ADAPTING" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "short-answers",
    label: "Short Answers",
    tier: "3",
    pattern: /^SHORT ANSWERS$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → SHORT ANSWERS" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "readiness-gate",
    label: "Readiness Gate",
    tier: "3",
    pattern: /^READINESS GATE/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → READINESS GATE" },
    conditionFn: () => ({ type: "state", label: "State: 3+ entries" }),
    alternativesFn: () => [],
  },
  {
    id: "clinical-material",
    label: "Clinical Material",
    tier: "3",
    pattern: /^CLINICAL MATERIAL IN CONVERSATION$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → CLINICAL MATERIAL" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "professional-referral",
    label: "Professional Referral",
    tier: "3",
    pattern: /^PROFESSIONAL REFERRAL$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → PROFESSIONAL REFERRAL" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "fabricated-content",
    label: "Fabricated Content",
    tier: "3",
    pattern: /^FABRICATED CONTENT$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → FABRICATED CONTENT" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "app-platform-questions",
    label: "App & Platform Questions",
    tier: "3",
    // Added in the retry-storm fix (2026-05-25) and never given a parser entry.
    // Without this, the parser treats everything from FABRICATED CONTENT to
    // CHECKPOINT LANGUAGE as one block, mis-attributing prompt text and
    // under-counting by one card.
    pattern: /^APP AND PLATFORM QUESTIONS$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → APP AND PLATFORM QUESTIONS" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "checkpoint-language",
    label: "Checkpoint Language",
    tier: "3",
    pattern: /^CHECKPOINT LANGUAGE/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → CHECKPOINT LANGUAGE" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  {
    id: "first-session",
    label: "First Session",
    tier: "3",
    pattern: /^FIRST SESSION$/m,
    source: { file: "system-prompt.ts", symbol: "buildTier3 → FIRST SESSION" },
    conditionFn: () => ({ type: "always", label: "Always" }),
    alternativesFn: () => [],
  },
  // Dynamic context blocks
  {
    id: "confirmed-manual",
    label: "Recent confirmed Manual entries",
    tier: "dynamic",
    pattern: /^(?:CONFIRMED MANUAL|NO CONFIRMED ENTRIES)/m,
    source: { file: "manual-context.ts", symbol: "prepareManualContext" },
    conditionFn: () => ({ type: "dynamic", label: "Dynamic: appended at runtime" }),
    alternativesFn: () => [],
  },
  {
    id: "earlier-entries",
    label: "Earlier confirmed Manual entries (compressed)",
    tier: "dynamic",
    // Header: "EARLIER ENTRIES (compressed — full content lives in the Manual):"
    // (em dash U+2014). Rendered by prepareManualContextBlocks.older when
    // entries from older conversations exist alongside recent ones — those
    // older entries collapse to one line each (headline + summary + key words)
    // so the prompt stays cheap.
    pattern: /^EARLIER ENTRIES \(compressed/m,
    source: { file: "manual-context.ts", symbol: "prepareManualContextBlocks.older / compressManualEntry" },
    conditionFn: () => ({ type: "dynamic", label: "Dynamic: older entries beyond recent backfill" }),
    alternativesFn: () => [],
  },
  {
    id: "session-context",
    label: "Last session recap",
    tier: "dynamic",
    pattern: /^SESSION CONTEXT$/m,
    source: { file: "system-prompt.ts", symbol: "buildSystemPrompt → session context" },
    conditionFn: () => ({ type: "state", label: "State: returning user" }),
    alternativesFn: () => [],
  },
  {
    id: "transcript-detected",
    label: "Transcript Detected",
    tier: "dynamic",
    // Header emitted by renderTranscriptContextBlock (system-prompt.ts): "TRANSCRIPT DETECTED".
    // Fires when the user pastes a transcript (detectTranscript) and mode !== "upload".
    // No mock phase exercises it today — see DynamicSidecar footnote on the page.
    pattern: /^TRANSCRIPT DETECTED$/m,
    source: { file: "system-prompt.ts", symbol: "renderTranscriptContextBlock" },
    conditionFn: () => ({ type: "dynamic", label: "Dynamic: user pasted a transcript" }),
    alternativesFn: () => [],
  },
  {
    id: "exploration-focus",
    label: "Exploration Focus",
    tier: "dynamic",
    // Header emitted by renderExplorationContextBlock (system-prompt.ts): "EXPLORATION FOCUS".
    // Fires when the user taps "Explore with Jove" on a Manual entry or empty layer.
    // No mock phase exercises it today — see DynamicSidecar footnote on the page.
    pattern: /^EXPLORATION FOCUS$/m,
    source: { file: "system-prompt.ts", symbol: "renderExplorationContextBlock" },
    conditionFn: () => ({ type: "dynamic", label: "Dynamic: user tapped Explore with Jove" }),
    alternativesFn: () => [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Parser — split a rendered prompt into labeled sections
// ---------------------------------------------------------------------------

export function parsePromptSections(
  promptText: string,
  modes: PersonaMode[],
  convMode: ConvMode,
  altTokenCache: Map<string, number>,
): PromptSection[] {
  const lines = promptText.split("\n");
  const matches: { def: SectionDef; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const def of SECTION_DEFS) {
      if (def.pattern.test(line)) {
        // "VOICE" appearing inside "VOICE RULES" — skip if next word is RULES
        if (def.id === "tier2-voice" && /^VOICE RULES/.test(line)) continue;
        matches.push({ def, lineIndex: i });
        break;
      }
    }
  }

  const sections: PromptSection[] = [];

  for (let m = 0; m < matches.length; m++) {
    const { def, lineIndex } = matches[m];
    const nextLineIndex = m + 1 < matches.length ? matches[m + 1].lineIndex : lines.length;
    const text = lines.slice(lineIndex, nextLineIndex).join("\n").trimEnd();

    // Label is the static section name. The active persona is already carried
    // by section.condition.label ("Persona: ADHD") — appending it to the title
    // duplicated that and read as a qualifier on the section name itself.
    sections.push({
      id: def.id,
      label: def.label,
      tier: def.tier,
      text,
      tokens: estimateTokens(text),
      condition: def.conditionFn(modes, convMode),
      source: def.source,
      alternatives: def.alternativesFn(modes, convMode, altTokenCache),
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Phase builder — construct the four lifecycle phases
// ---------------------------------------------------------------------------

interface MockManualEntry {
  id: string;
  layer: number;
  name: string;
  content: string;
  summary: string | null;
  key_words: string[] | null;
  conversation_id: string;
  created_at: string;
}

const MOCK_ENTRIES: MockManualEntry[] = [
  {
    id: "mock-1",
    layer: 1,
    name: "Voice Goes When Pressure Lands",
    content:
      "When someone needs an answer and the room is watching, a second version takes over. The real one goes quiet. The voice flattens. The hands get heavy. The answer was there a minute ago but now it is gone.",
    summary: "Under pressure, voice flattens and real self retreats while a performing version takes over.",
    key_words: ["pressure", "voice", "performing", "shutdown"],
    conversation_id: "mock-conv-old",
    created_at: "2026-04-01T10:00:00Z",
  },
  {
    id: "mock-2",
    layer: 2,
    name: "The Absorber Pattern",
    content:
      "In close relationships, the first move is always to absorb. Someone else's stress becomes your project. The body tenses before the mind registers why. By the time the conversation ends, their weight is yours and yours hasn't been named.",
    summary: "Absorbs others' stress automatically; body registers before mind catches up.",
    key_words: ["absorbing", "stress", "body", "relationships"],
    conversation_id: "mock-conv-old",
    created_at: "2026-04-02T10:00:00Z",
  },
  {
    id: "mock-3",
    layer: 3,
    name: "Rehearsal Loop Before Hard Conversations",
    content:
      "Before any conversation where the stakes feel high, there is a rehearsal loop. Hours of running every version. By the time the actual conversation happens, every word has been pre-tested. The cost is exhaustion before it starts.",
    summary: "Rehearses high-stakes conversations for hours; arrives exhausted before they begin.",
    key_words: ["rehearsal", "conversations", "exhaustion", "stakes"],
    conversation_id: "mock-conv-recent",
    created_at: "2026-05-10T10:00:00Z",
  },
  {
    id: "mock-4",
    layer: 4,
    name: "Yes Comes Out Before the Cost Is Counted",
    content:
      "Someone asks for something and the yes is already out. The accounting of what it costs — the time, the energy, the thing it displaces — happens later, alone, usually at night. By then the commitment is made and backing out would cost more than just absorbing it.",
    summary: "Agrees before weighing the cost; the real accounting happens alone, too late to undo.",
    key_words: ["yes", "overcommitting", "cost", "obligation"],
    conversation_id: "mock-conv-old",
    created_at: "2026-03-28T10:00:00Z",
  },
  {
    id: "mock-5",
    layer: 5,
    name: "Recovery Needs a Closed Door",
    content:
      "After a day of being on, the only thing that resets the system is a closed door and no one needing anything. Not music, not a friend, not a routine. Silence and the absence of demand. Without it, the next day starts already depleted.",
    summary: "Resets only behind a closed door with zero demands; without it the next day starts depleted.",
    key_words: ["recovery", "solitude", "depletion", "reset"],
    conversation_id: "mock-conv-older",
    created_at: "2026-03-20T10:00:00Z",
  },
  {
    id: "mock-6",
    layer: 4,
    name: "Conflict Gets Rehearsed Into Silence",
    content:
      "When something needs to be said to someone who matters, it gets rehearsed so many times that every version feels wrong. The rehearsal doesn't sharpen the message. It talks the message out of existence. By the end, saying nothing feels safer than any of the drafts.",
    summary: "Over-rehearses hard conversations until every version feels wrong and silence wins.",
    key_words: ["conflict", "rehearsal", "avoidance", "silence"],
    conversation_id: "mock-conv-older",
    created_at: "2026-03-12T10:00:00Z",
  },
];

interface PhaseConfig {
  id: string;
  label: string;
  description: string;
  options: Partial<OneOnOnePromptOptions>;
}

function buildPhaseConfigs(): PhaseConfig[] {
  return [
    {
      id: "phase-1",
      label: "Phase 1 — Brand New Account",
      description: "First turn, first session. No manual entries. User just signed up.",
      options: {
        manualComponents: [],
        currentConversationId: "conv-1",
        isReturningUser: false,
        sessionSummary: null,
        isFirstCheckpoint: false,
        turnCount: 1,
      },
    },
    {
      id: "phase-2",
      label: "Phase 2 — Approaching First Checkpoint",
      description: "Still first session. Conversation is deep enough for a checkpoint.",
      options: {
        manualComponents: [],
        currentConversationId: "conv-1",
        isReturningUser: false,
        sessionSummary: null,
        isFirstCheckpoint: true,
        turnCount: 8,
      },
    },
    {
      id: "phase-3",
      label: "Phase 3 — Returning User",
      description: "Days later. User comes back with confirmed entries in the manual.",
      options: {
        manualComponents: MOCK_ENTRIES,
        currentConversationId: "mock-conv-recent",
        isReturningUser: true,
        sessionSummary:
          "Explored the pressure-to-perform pattern at work. Named the voice-goes-flat moment. Confirmed one entry on Layer 1.",
        isFirstCheckpoint: false,
        sessionCount: 3,
        turnCount: 1,
      },
    },
    {
      id: "phase-4",
      label: "Phase 4 — Returning, Approaching Checkpoint",
      description: "Same returning user, conversation has deepened to checkpoint territory.",
      options: {
        manualComponents: MOCK_ENTRIES,
        currentConversationId: "mock-conv-recent",
        isReturningUser: true,
        sessionSummary:
          "Explored the pressure-to-perform pattern at work. Named the voice-goes-flat moment. Confirmed one entry on Layer 1.",
        isFirstCheckpoint: false,
        sessionCount: 3,
        turnCount: 10,
      },
    },
  ];
}

export function buildAllPhases(
  personaModes: PersonaMode[],
  convMode: ConvMode,
): PhaseData[] {
  const configs = buildPhaseConfigs();
  const altTokenCache = new Map<string, number>();
  const phases: PhaseData[] = [];
  let prevSectionIds: Set<string> | null = null;
  let prevTotalTokens = 0;

  for (const config of configs) {
    const prompt = buildSystemPrompt({
      kind: "oneOnOne",
      ...config.options,
      mode: convMode,
      personaModes,
      // The viewer shows the LIVE prompt — same switch as the conversation
      // paths, so the admin page tracks the rebuilt voice automatically.
      voiceVariant: LIVE_VOICE_VARIANT,
    } as OneOnOnePromptOptions);

    const sections = parsePromptSections(prompt, personaModes, convMode, altTokenCache);
    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
    const currentIds = new Set(sections.map((s) => s.id));

    const changes: string[] = [];
    let deltaTokens: number | null = null;
    let deltaBlocks: number | null = null;

    if (prevSectionIds) {
      deltaTokens = totalTokens - prevTotalTokens;
      deltaBlocks = currentIds.size - prevSectionIds.size;
      const currentArr = sections.map((s) => s.id);
      const prevArr = Array.from(prevSectionIds);
      for (const id of currentArr) {
        if (!prevSectionIds.has(id)) {
          const sec = sections.find((s) => s.id === id);
          changes.push(`+ ${sec?.label ?? id}`);
        }
      }
      for (const id of prevArr) {
        if (!currentIds.has(id)) {
          const def = SECTION_DEFS.find((d) => d.id === id);
          changes.push(`− ${def?.label ?? id}`);
        }
      }
    }

    phases.push({
      id: config.id,
      label: config.label,
      description: config.description,
      sections,
      totalTokens,
      deltaTokens,
      deltaBlocks,
      changes,
    });

    prevSectionIds = currentIds;
    prevTotalTokens = totalTokens;
  }

  return phases;
}
