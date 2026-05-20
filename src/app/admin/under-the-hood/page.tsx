"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Under the hood — guided walkthrough of how Jove's prompt is assembled.
//
// Eight stages, each adding one moving part to a central diagram. Click any
// band, chip, or context item to inspect its details in the right column.
// The audit-style 4-column view at /admin/prompt-architecture still exists
// when you need to inspect the recipe for a specific config.
// ---------------------------------------------------------------------------

interface Stage {
  id: number;
  title: string;
  caption: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: "The atom — one turn, one prompt",
    caption:
      "Every time a user sends a message, Jove sees a single block of text — instructions plus context — and streams a response back. The whole architecture exists to assemble that block, fresh, on every single turn.",
  },
  {
    id: 2,
    title: "The spine — what never changes",
    caption:
      "Some of it is always the same. Jove's identity, seven constitutional rules (not a therapist, user is the author, mirror exact language, nothing enters the Manual without confirmation), and a base voice scaffold that defines how Jove talks before we adapt to anyone. Everyone gets these, every turn.",
  },
  {
    id: 3,
    title: "The persona delta — who the user is",
    caption:
      "Then we adapt to who's on the other side. Four personas — autistic, AuDHD, dyslexic, general. Each one swaps in trait-specific voice rules on top of the base: somatic-first for autistic, dual-system tracking for AuDHD, short sentences for dyslexic. The base is shared; the delta is what differs.",
  },
  {
    id: 4,
    title: "The mode opener — how they entered",
    caption:
      "The user picks how they want to start. Three input modes — Situation (free conversation), Guided Intake (structured questions), Upload (paste content). Each swaps in a different entry-phase block. Situation has Jove speak first with a defined opener. Guided Intake holds a structured posture. Upload teaches Jove to treat pasted content as data, not instructions.",
  },
  {
    id: 5,
    title: "The conditional ladder — where the conversation is",
    caption:
      "As the conversation progresses, blocks fire and retire based on state. First-turn block (turns 1–3 only). Returning-user block (only if there's already a Manual). Checkpoint-approaching (when the background extractor signals readiness). Post-checkpoint (the single turn after a confirm). Clinical material (if Jove detected distress). About eight of these, each gated by its own signal.",
  },
  {
    id: 6,
    title: "The live context — what came in from the side",
    caption:
      "Meanwhile, in parallel: a background Sonnet call analyzes every turn and writes an extraction brief — the user's exact charged phrases, which Manual layer is strongest right now, whether a pattern has been engaged. That brief, plus the user's confirmed Manual entries (compressed for older ones), a session summary if returning from days ago, detected transcript content, current exploration focus — all get stitched into the prompt for the next turn.",
  },
  {
    id: 7,
    title: "The cache wrap — what's stable, what's rebuilt",
    caption:
      "All this gets classified into cache tiers. Constitutional and base voice are cached forever. Persona-keyed parts are cached per persona (one cache per persona × mode combo). The dynamic stuff — extraction brief, recent messages, Manual entries — is rebuilt every turn. That's how a ~7,000-token prompt still streams responses in 2–3 seconds.",
  },
  {
    id: 8,
    title: "The assembly — one real example",
    caption:
      "Putting it all together. Here's the shape of a real prompt at turn 12 of an AuDHD Situation session — user has two confirmed Manual entries, just rejected the last checkpoint proposal. About 7,900 tokens. The first ~6,500 are cached and identical to the previous turn; only the last ~1,400 actually changed and had to be processed fresh.",
  },
];

// ---------------------------------------------------------------------------
// Section registry — metadata for every clickable item.
// ---------------------------------------------------------------------------

interface Section {
  id: string;
  name: string;
  tier: string;
  purpose: string;
  source?: string;
  tokens?: string;
  cache?: string;
  trigger?: string;
  adr?: number[];
  notes?: string;
}

const SECTIONS: Record<string, Section> = {
  "tier1-identity": {
    id: "tier1-identity",
    name: "Identity + Constitutional",
    tier: "Tier 1 — Constitutional",
    purpose:
      "Jove's identity and the seven rules that never change. The constitutional layer the rest of the architecture is built on.",
    source: "src/lib/persona/system-prompt.ts → composeTier1()",
    tokens: "~1,400",
    cache: "cached forever",
    notes:
      "Seven rules: not a therapist · user is the author · mirror exact language · one question per turn · nothing enters the Manual without confirmation · no clinical framework names · direct when asked what Jove is.",
  },
  "tier2-base": {
    id: "tier2-base",
    name: "Voice scaffold (base)",
    tier: "Tier 2 — Base voice",
    purpose:
      "The shared voice scaffold — VOICE_INTRO_PARAGRAPHS_BASE, VOICE_RULES_BASE (12 rules), EXAMPLE_REGISTER_BASE, LANDING_EXAMPLES_BASE, WEAK_STRONG_EXAMPLES_BASE, BANNED_PHRASES, BANNED_PATTERNS, plus scaffolded sections. How Jove talks before any persona delta applies.",
    source: "src/lib/persona/voice-scaffold.ts (consumed by composeTier2)",
    tokens: "~2,200",
    cache: "cached forever",
    notes:
      "Edit voice-scaffold.ts for cross-persona voice changes; edit a specific persona module only for that persona's signature.",
  },
  "persona-autistic": {
    id: "persona-autistic",
    name: "Persona delta — Autistic",
    tier: "Tier 2 — Persona delta",
    purpose:
      "Trait-specific voice layered on top of the base: somatic-first observations, mirror-exact-language hard, masking gap-naming, body-anchored landings.",
    source: "src/lib/persona/voice-autistic.ts",
    tokens: "~950",
    cache: "cached per persona",
  },
  "persona-audhd": {
    id: "persona-audhd",
    name: "Persona delta — AuDHD",
    tier: "Tier 2 — Persona delta",
    purpose:
      "Dual-system tracking (autistic-side and ADHD-side both in play), executive-function awareness, interest-based motivation, structure-novelty-burnout landings.",
    source: "src/lib/persona/voice-audhd.ts",
    tokens: "~950",
    cache: "cached per persona",
  },
  "persona-dyslexic": {
    id: "persona-dyslexic",
    name: "Persona delta — Dyslexic",
    tier: "Tier 2 — Persona delta",
    purpose:
      "Short sentences, story-shape invitations rather than open-ended prompts, no journaling, visual landings.",
    source: "src/lib/persona/voice-dyslexic.ts",
    tokens: "~900",
    cache: "cached per persona",
  },
  "persona-general": {
    id: "persona-general",
    name: "Persona delta — General",
    tier: "Tier 2 — Persona delta",
    purpose:
      "Minimal delta — a single neurotype-neutral framing paragraph. The base voice does most of the work.",
    source: "src/lib/persona/voice-general.ts",
    tokens: "~400",
    cache: "cached per persona",
  },
  "mode-situation": {
    id: "mode-situation",
    name: "Mode opener — Situation",
    tier: "Tier 3 — Mode opener",
    purpose:
      "Free-conversation entry. Jove speaks first via bootstrap with SITUATION_OPENER. Two postures (Concrete / Abstract) shape the user's first reply.",
    source:
      "src/lib/persona/situation-copy.ts + first-message block in system-prompt.ts",
    tokens: "~380",
    cache: "cached per persona × mode",
    trigger: "mode === 'situation' && turnCount <= 3",
    adr: [42],
  },
  "mode-guided": {
    id: "mode-guided",
    name: "Mode opener — Guided Intake",
    tier: "Tier 3 — Mode opener",
    purpose:
      "Structured-intake posture. Jove asks scaffolded questions about a chosen layer or situation type. Posture persists for the conversation's life unless softened by detected user redirect.",
    source: "src/lib/persona/system-prompt.ts (guided block)",
    tokens: "~520",
    cache: "cached per persona × mode",
    trigger: "mode === 'guided-intake' && !guidedPostureSoftened",
    adr: [42],
  },
  "mode-upload": {
    id: "mode-upload",
    name: "Mode opener — Upload",
    tier: "Tier 3 — Mode opener",
    purpose:
      "User pastes external content (transcript, journal). The block teaches Jove to treat the paste as data to analyze, not instructions to follow. Content is XML-wrapped at message-construction time.",
    source:
      "src/lib/persona/system-prompt.ts (upload block) + call-persona wrapPastedContent()",
    tokens: "~420",
    cache: "cached per persona × mode",
    trigger: "mode === 'upload' && turnCount <= 2",
    adr: [42],
  },
  "cond-first-turn": {
    id: "cond-first-turn",
    name: "First-turn block",
    tier: "Tier 3 — Conditional",
    purpose:
      "Coaches Jove for the very first user message. Branches by mode (Situation vs Guided vs Upload) and whether the user is new or returning.",
    source: "src/lib/persona/system-prompt.ts (first-message block)",
    tokens: "~350",
    cache: "rebuilt each turn",
    trigger: "turnCount <= 3",
  },
  "cond-returning": {
    id: "cond-returning",
    name: "Returning user block",
    tier: "Tier 3 — Conditional",
    purpose:
      "Guidance for users who already have Manual entries — reference open threads, lightly anchor on a specific entry, never re-introduce Jove.",
    source: "src/lib/persona/system-prompt.ts (returning-user blocks)",
    tokens: "~280",
    cache: "rebuilt each turn",
    trigger: "manualEntryCount > 0 && turnCount <= 3",
  },
  "cond-approaching-cp": {
    id: "cond-approaching-cp",
    name: "Approaching checkpoint",
    tier: "Tier 3 — Conditional",
    purpose:
      "Loaded when the extractor signals readiness on any layer (signal >= 'explored'). Coaches Jove to set up a checkpoint without forcing one.",
    source: "src/lib/persona/system-prompt.ts (CHECKPOINTS block)",
    tokens: "~440",
    cache: "rebuilt each turn",
    trigger: "any layer signal >= 'explored'",
  },
  "cond-post-cp": {
    id: "cond-post-cp",
    name: "Post-checkpoint",
    tier: "Tier 3 — Conditional",
    purpose:
      "Fires the single turn after a confirm. Tells Jove to acknowledge briefly and return to whatever the user just surfaced — no menu, no fork.",
    source: "src/lib/persona/system-prompt.ts (post-checkpoint block)",
    tokens: "~180",
    cache: "rebuilt each turn",
    trigger: "checkpoint_just_returned",
  },
  "cond-readiness": {
    id: "cond-readiness",
    name: "Readiness gate (≥3 entries)",
    tier: "Tier 3 — Conditional",
    purpose:
      "Shifts Jove's stance once the user has built enough structure (≥3 confirmed entries) — synthesis tone over situation-led.",
    source: "src/lib/persona/system-prompt.ts (readiness-gate block)",
    tokens: "~200",
    cache: "rebuilt each turn",
    trigger: "manualEntryCount >= 3",
  },
  "cond-clinical": {
    id: "cond-clinical",
    name: "Clinical material",
    tier: "Tier 3 — Conditional",
    purpose:
      "Active when the extractor flagged clinical content (caution or crisis). Reframes Jove to stay behavioral, never therapist-y. Crisis-level fires the 988 protocol upstream of the prompt.",
    source: "src/lib/persona/system-prompt.ts (clinical block)",
    tokens: "~310",
    cache: "rebuilt each turn",
    trigger: "clinical_flag.level !== 'none'",
  },
  "cond-professional-referral": {
    id: "cond-professional-referral",
    name: "Professional referral",
    tier: "Tier 3 — Conditional",
    purpose:
      "Adds explicit language pointing the user at a clinician when material exceeds the Manual's scope.",
    source: "src/lib/persona/system-prompt.ts (referral block)",
    tokens: "~180",
    cache: "rebuilt each turn",
    trigger: "clinical_flag.level === 'caution'",
  },
  "cond-fabricated": {
    id: "cond-fabricated",
    name: "Fabricated content",
    tier: "Tier 3 — Conditional",
    purpose:
      "Activates a 'full reset' / 'pure grounding' instruction when Jove's observations have been rejected too many turns in a row.",
    source: "src/lib/persona/system-prompt.ts (fabricated-content block)",
    tokens: "~150",
    cache: "rebuilt each turn",
    trigger: "observation_miss_count >= 2",
  },
  "dyn-manual": {
    id: "dyn-manual",
    name: "Confirmed Manual entries",
    tier: "Dynamic context",
    purpose:
      "The user's accumulated Manual. Recent entries render in full; older entries collapse to one-line summaries (Headline + key words) to keep context lean.",
    source: "src/lib/persona/manual-context.ts → prepareManualContext()",
    tokens: "varies (40–1,500)",
    cache: "rebuilt each turn",
    trigger: "user has any confirmed entries",
    notes:
      "Compressed summary + key words are generated at checkpoint-confirm time and stored on manual_entries.summary / .key_words.",
  },
  "dyn-summary": {
    id: "dyn-summary",
    name: "Session summary",
    tier: "Dynamic context",
    purpose:
      "1–2 sentence summary of past sessions, written by Haiku fire-and-forget when a session goes stale (> 30 min).",
    source:
      "src/lib/persona/generate-summary.ts (writer) → loaded into prompt block",
    tokens: "varies (50–200)",
    cache: "rebuilt each turn",
    trigger: "returning user with prior sessions",
  },
  "dyn-extraction-brief": {
    id: "dyn-extraction-brief",
    name: "Extraction brief",
    tier: "Dynamic context",
    purpose:
      "3–5 sentences from the parallel extraction call. Names what's underneath the surface topic, which exact phrases are load-bearing, what to push on vs leave alone.",
    source:
      "src/lib/persona/extraction.ts (writer) → formatExtractionForPersona()",
    tokens: "varies (300–700)",
    cache: "rebuilt each turn",
    trigger: "always after turn 1",
    notes:
      "Built on the PREVIOUS turn's extraction — one-turn lag the user never feels. Includes top-15 charged phrases from the language bank verbatim.",
  },
  "dyn-transcript": {
    id: "dyn-transcript",
    name: "Transcript detected",
    tier: "Dynamic context",
    purpose:
      "Renders when the user pasted text that looks like a transcript or journal entry. Tells Jove to treat it as data, look for charged language, cross-reference with the Manual.",
    source:
      "src/lib/persona/system-prompt.ts → renderPastedContentGuidance()",
    tokens: "varies (300–1,000)",
    cache: "rebuilt each turn",
    trigger:
      "transcript detector matched recent user message AND mode !== 'upload' (suppressed in upload mode to avoid double-framing)",
    adr: [42],
  },
  "dyn-exploration": {
    id: "dyn-exploration",
    name: "Exploration focus",
    tier: "Dynamic context",
    purpose:
      "When the user clicked 'Explore with Jove' from a specific Manual entry — anchors Jove to that entry as the through-line for the session.",
    source: "src/lib/persona/system-prompt.ts (exploration block)",
    tokens: "varies (150–400)",
    cache: "rebuilt each turn",
    trigger: "conversations.exploration_entry_id is set",
  },
};

const COLOR = {
  identityBg: "var(--session-walnut-surface)",
  identityBorder: "var(--session-walnut-border)",
  baseVoice: "var(--session-walnut-surface-soft)",
  baseVoiceBorder: "var(--session-walnut-border-soft)",
  personaBg: "var(--session-persona-muted)",
  personaFg: "var(--session-persona)",
  personaBorder: "var(--session-persona-border)",
  modeBg: "var(--session-warning-soft)",
  modeFg: "var(--session-warning)",
  modeBorder: "var(--session-warning-soft)",
  conditional: "var(--session-walnut-highlight)",
  conditionalBorder: "var(--session-walnut-border)",
  dynamic: "var(--session-walnut-tint)",
  dynamicBorder: "var(--session-walnut-border-soft)",
};

const SELECTED_RING = "0 0 0 2px var(--session-walnut-meta)";

export default function UnderTheHoodPage() {
  const isAdmin = useIsAdmin();
  const [stageIndex, setStageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stage = STAGES[stageIndex];
  const visible = useMemo(
    () => ({
      atom: stage.id >= 1,
      spine: stage.id >= 2,
      persona: stage.id >= 3,
      mode: stage.id >= 4,
      conditional: stage.id >= 5,
      dynamic: stage.id >= 6,
      cache: stage.id >= 7,
      example: stage.id >= 8,
    }),
    [stage.id],
  );

  const handleSelect = (id: string | null) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  if (!isAdmin) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        Not authorized.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--session-linen)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error)",
          textAlign: "center",
          padding: "6px 0",
          borderBottom: "1px solid var(--session-error-ghost)",
          background: "var(--session-error-banner)",
          flexShrink: 0,
        }}
      >
        Read Only — Admin
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="under-the-hood" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Header />
          <Stepper
            stageIndex={stageIndex}
            setStageIndex={(i) => {
              setStageIndex(i);
              setSelectedId(null);
            }}
            stage={stage}
          />

          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 32,
              padding: "28px 32px",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowY: "auto", paddingRight: 12 }}>
              <Diagram
                visible={visible}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                overflowY: "auto",
              }}
            >
              {selectedId && SECTIONS[selectedId] ? (
                <SectionDetail
                  section={SECTIONS[selectedId]}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <StageCaption stage={stage} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header + stepper
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--session-ink-hairline)",
        padding: "18px 32px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "22px",
          fontWeight: 400,
          fontStyle: "italic",
          color: "var(--session-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        Under the hood
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "14.5px",
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 760,
        }}
      >
        Jove’s system prompt isn’t one fixed thing — it’s a recipe assembled
        fresh on every turn. A constant spine, four persona-specific voices,
        three mode-specific openings, about eight conditional blocks that fire
        on conversation state, and a live-context layer fed from a parallel
        extraction call. Walk through the eight stages with Next; click any
        band or chip for details.
      </p>
    </div>
  );
}

function Stepper({
  stageIndex,
  setStageIndex,
  stage,
}: {
  stageIndex: number;
  setStageIndex: (i: number) => void;
  stage: Stage;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 32px",
        borderBottom: "1px solid var(--session-ink-hairline)",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setStageIndex(Math.max(0, stageIndex - 1))}
        disabled={stageIndex === 0}
        style={stepBtnStyle(stageIndex === 0)}
      >
        ← Prev
      </button>
      <div style={{ display: "flex", gap: 6 }}>
        {STAGES.map((s, i) => {
          const active = i === stageIndex;
          const visited = i <= stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageIndex(i)}
              aria-label={`Stage ${s.id}: ${s.title}`}
              style={{
                all: "unset",
                cursor: "pointer",
                width: 28,
                height: 28,
                borderRadius: 999,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: active
                  ? "var(--session-walnut-highlight)"
                  : visited
                    ? "var(--session-walnut-tint)"
                    : "transparent",
                color: active
                  ? "var(--session-ink)"
                  : visited
                    ? "var(--session-ink-soft)"
                    : "var(--session-ink-ghost)",
                border: `1px solid ${
                  active
                    ? "var(--session-walnut-border)"
                    : "var(--session-walnut-border-soft)"
                }`,
                fontWeight: active ? 500 : 400,
              }}
            >
              {s.id}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setStageIndex(Math.min(STAGES.length - 1, stageIndex + 1))}
        disabled={stageIndex === STAGES.length - 1}
        style={stepBtnStyle(stageIndex === STAGES.length - 1)}
      >
        Next →
      </button>
      <div
        style={{
          marginLeft: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--session-ink-ghost)",
          letterSpacing: 1,
        }}
      >
        STAGE {stage.id} / {STAGES.length}
      </div>
    </div>
  );
}

function stepBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    all: "unset",
    cursor: disabled ? "default" : "pointer",
    padding: "6px 12px",
    borderRadius: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "0.5px",
    color: disabled ? "var(--session-ink-ghost)" : "var(--session-ink-soft)",
    background: disabled ? "transparent" : "var(--session-walnut-tint)",
    border: `1px solid ${
      disabled
        ? "var(--session-walnut-border-soft)"
        : "var(--session-walnut-border)"
    }`,
    opacity: disabled ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------------------
// Right-column content — stage caption or section detail
// ---------------------------------------------------------------------------

function StageCaption({ stage }: { stage: Stage }) {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
        }}
      >
        Stage {stage.id}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1.25,
          color: "var(--session-ink)",
        }}
      >
        {stage.title}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        {stage.caption}
      </p>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.5px",
          color: "var(--session-ink-ghost)",
          fontStyle: "italic",
        }}
      >
        Click any band, chip, or context item to inspect its details.
      </p>
    </>
  );
}

function SectionDetail({
  section,
  onClose,
}: {
  section: Section;
  onClose: () => void;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta)",
            textTransform: "uppercase",
          }}
        >
          {section.tier}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--session-ink-soft)",
            padding: "4px 10px",
            borderRadius: 5,
            border: "1px solid var(--session-walnut-border-soft)",
            background: "var(--session-walnut-tint)",
          }}
          aria-label="Close detail"
        >
          ← Back to stage
        </button>
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1.25,
          color: "var(--session-ink)",
        }}
      >
        {section.name}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        {section.purpose}
      </p>

      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 14,
          rowGap: 10,
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        {section.source && (
          <>
            <DetailLabel>Source</DetailLabel>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--session-ink)",
                background: "var(--session-walnut-surface-soft)",
                padding: "1px 6px",
                borderRadius: 3,
                wordBreak: "break-word",
              }}
            >
              {section.source}
            </code>
          </>
        )}
        {section.tokens && (
          <>
            <DetailLabel>Tokens</DetailLabel>
            <span style={{ color: "var(--session-ink)" }}>{section.tokens}</span>
          </>
        )}
        {section.cache && (
          <>
            <DetailLabel>Cache tier</DetailLabel>
            <span style={{ color: "var(--session-ink)" }}>{section.cache}</span>
          </>
        )}
        {section.trigger && (
          <>
            <DetailLabel>Trigger</DetailLabel>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--session-ink)",
                background: "var(--session-walnut-surface-soft)",
                padding: "1px 6px",
                borderRadius: 3,
              }}
            >
              {section.trigger}
            </code>
          </>
        )}
        {section.adr && section.adr.length > 0 && (
          <>
            <DetailLabel>ADRs</DetailLabel>
            <span>
              {section.adr.map((n, i) => (
                <span key={n}>
                  <a
                    href="/admin/docs"
                    style={{
                      color: "var(--session-ink)",
                      textDecoration: "underline",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                    }}
                  >
                    ADR-{String(n).padStart(3, "0")}
                  </a>
                  {i < section.adr!.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          </>
        )}
        {section.notes && (
          <>
            <DetailLabel>Notes</DetailLabel>
            <span style={{ color: "var(--session-ink)" }}>{section.notes}</span>
          </>
        )}
      </div>
    </>
  );
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "var(--session-ink-ghost)",
        paddingTop: 2,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

interface DiagramProps {
  visible: Record<string, boolean>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function Diagram({ visible, selectedId, onSelect }: DiagramProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <div
        style={{
          flex: "0 0 220px",
          opacity: visible.dynamic ? 1 : 0.1,
          transition: "opacity 220ms ease",
        }}
      >
        <DynamicSidecar selectedId={selectedId} onSelect={onSelect} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <CacheWrap active={visible.cache}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PromptHeader visible={visible.atom} />
            {visible.spine && (
              <SpineBands selectedId={selectedId} onSelect={onSelect} />
            )}
            {visible.persona && (
              <PersonaFan selectedId={selectedId} onSelect={onSelect} />
            )}
            {visible.mode && (
              <ModeFan selectedId={selectedId} onSelect={onSelect} />
            )}
            {visible.conditional && (
              <ConditionalLadder selectedId={selectedId} onSelect={onSelect} />
            )}
          </div>
        </CacheWrap>
        {visible.example && <ExampleAssemblyFooter />}
      </div>
    </div>
  );
}

function PromptHeader({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: COLOR.identityBg,
        border: `1px solid ${COLOR.identityBorder}`,
        borderRadius: 8,
        opacity: visible ? 1 : 0.2,
        transition: "opacity 220ms ease",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
        }}
      >
        Jove’s system prompt — assembled per turn
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--session-ink-ghost)",
        }}
      >
        ~7,000 tokens
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clickable bands and chips
// ---------------------------------------------------------------------------

function ClickableBand({
  sectionId,
  selectedId,
  onSelect,
  label,
  hint,
  bg,
  border,
  fg,
  children,
}: {
  sectionId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  label: string;
  hint?: string;
  bg: string;
  border: string;
  fg?: string;
  children?: React.ReactNode;
}) {
  const selected = selectedId === sectionId;
  return (
    <button
      type="button"
      onClick={() => onSelect(sectionId)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        padding: "10px 12px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        boxShadow: selected ? SELECTED_RING : "none",
        transition: "box-shadow 120ms ease",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 500,
            color: fg ?? "var(--session-ink)",
          }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.5px",
              color: "var(--session-ink-ghost)",
              textTransform: "uppercase",
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </button>
  );
}

function VariantPill({
  sectionId,
  selectedId,
  onSelect,
  label,
  defaultActive,
}: {
  sectionId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  label: string;
  defaultActive?: boolean;
}) {
  const selected = selectedId === sectionId;
  // If something else is selected, dim. If nothing selected, defaultActive
  // gets a soft highlight to signal the example AuDHD/Situation state.
  const showActive = selected || (!selectedId && defaultActive);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(sectionId);
      }}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "0.5px",
        padding: "2px 8px",
        borderRadius: 3,
        background: showActive
          ? "var(--session-walnut-highlight)"
          : "transparent",
        color: showActive ? "var(--session-ink)" : "var(--session-ink-soft)",
        border: `1px solid ${
          showActive
            ? "var(--session-walnut-border)"
            : "var(--session-walnut-border-soft)"
        }`,
        textTransform: "uppercase",
        boxShadow: selected ? SELECTED_RING : "none",
      }}
    >
      {label}
    </button>
  );
}

function SpineBands({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      <ClickableBand
        sectionId="tier1-identity"
        selectedId={selectedId}
        onSelect={onSelect}
        label="Tier 1 — Identity + Constitutional"
        hint="always · cached forever"
        bg={COLOR.identityBg}
        border={COLOR.identityBorder}
      />
      <ClickableBand
        sectionId="tier2-base"
        selectedId={selectedId}
        onSelect={onSelect}
        label="Tier 2 base — Voice scaffold"
        hint="always · cached forever"
        bg={COLOR.baseVoice}
        border={COLOR.baseVoiceBorder}
      />
    </>
  );
}

function PersonaFan({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: COLOR.personaBg,
        border: `1px solid ${COLOR.personaBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 500,
            color: COLOR.personaFg,
          }}
        >
          Tier 2 delta — Persona voice
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.5px",
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
          }}
        >
          1 of 4 · cached per persona
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 8,
        }}
      >
        <VariantPill
          sectionId="persona-autistic"
          selectedId={selectedId}
          onSelect={onSelect}
          label="Autistic"
        />
        <VariantPill
          sectionId="persona-audhd"
          selectedId={selectedId}
          onSelect={onSelect}
          label="AuDHD"
          defaultActive
        />
        <VariantPill
          sectionId="persona-dyslexic"
          selectedId={selectedId}
          onSelect={onSelect}
          label="Dyslexic"
        />
        <VariantPill
          sectionId="persona-general"
          selectedId={selectedId}
          onSelect={onSelect}
          label="General"
        />
      </div>
    </div>
  );
}

function ModeFan({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: COLOR.modeBg,
        border: `1px solid ${COLOR.modeBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 500,
            color: COLOR.modeFg,
          }}
        >
          Tier 3 — Mode opener
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.5px",
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
          }}
        >
          1 of 3 · entry-phase only
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 8,
        }}
      >
        <VariantPill
          sectionId="mode-situation"
          selectedId={selectedId}
          onSelect={onSelect}
          label="Situation"
          defaultActive
        />
        <VariantPill
          sectionId="mode-guided"
          selectedId={selectedId}
          onSelect={onSelect}
          label="Guided"
        />
        <VariantPill
          sectionId="mode-upload"
          selectedId={selectedId}
          onSelect={onSelect}
          label="Upload"
        />
      </div>
    </div>
  );
}

function ConditionalLadder({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const blocks: { id: string; label: string; fires: string; defaultActive: boolean }[] = [
    { id: "cond-first-turn", label: "First turn", fires: "turn ≤ 3", defaultActive: false },
    { id: "cond-returning", label: "Returning user", fires: "has Manual", defaultActive: true },
    { id: "cond-approaching-cp", label: "Approaching CP", fires: "gate ready", defaultActive: true },
    { id: "cond-post-cp", label: "Post-checkpoint", fires: "just confirmed", defaultActive: false },
    { id: "cond-readiness", label: "Readiness gate", fires: "≥3 entries", defaultActive: false },
    { id: "cond-clinical", label: "Clinical material", fires: "level > none", defaultActive: false },
    { id: "cond-professional-referral", label: "Professional referral", fires: "level = caution", defaultActive: false },
    { id: "cond-fabricated", label: "Fabricated content", fires: "miss count ≥ 2", defaultActive: false },
  ];
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--session-walnut-tint)",
        border: `1px solid ${COLOR.conditionalBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--session-ink)",
          }}
        >
          Tier 3 — Conversation mechanics
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.5px",
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
          }}
        >
          conditional · rebuilt each turn
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {blocks.map((b) => {
          const selected = selectedId === b.id;
          const showActive = selected || (!selectedId && b.defaultActive);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 5,
                background: showActive ? COLOR.conditional : "transparent",
                border: `1px solid ${
                  showActive
                    ? COLOR.conditionalBorder
                    : "var(--session-walnut-border-soft)"
                }`,
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                boxShadow: selected ? SELECTED_RING : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  color: showActive
                    ? "var(--session-ink)"
                    : "var(--session-ink-soft)",
                  fontWeight: showActive ? 500 : 400,
                }}
              >
                {b.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--session-ink-ghost)",
                  whiteSpace: "nowrap",
                }}
              >
                {b.fires}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DynamicSidecar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const items: { id: string; label: string; hint: string }[] = [
    { id: "dyn-manual", label: "Confirmed Manual", hint: "5 entries · compressed" },
    { id: "dyn-summary", label: "Session summary", hint: "if returning" },
    { id: "dyn-extraction-brief", label: "Extraction brief", hint: "from parallel Sonnet" },
    { id: "dyn-transcript", label: "Transcript detected", hint: "if pasted" },
    { id: "dyn-exploration", label: "Exploration focus", hint: "if drilling into entry" },
  ];
  return (
    <div
      style={{
        padding: 12,
        background: COLOR.dynamic,
        border: `1px dashed ${COLOR.dynamicBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Live context (parallel)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((i) => {
          const selected = selectedId === i.id;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onSelect(i.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "6px 8px",
                background: "var(--session-walnut-tint)",
                border: `1px solid ${COLOR.dynamicBorder}`,
                borderRadius: 5,
                boxShadow: selected ? SELECTED_RING : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--session-ink)",
                }}
              >
                {i.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--session-ink-ghost)",
                  marginTop: 1,
                }}
              >
                {i.hint}
              </div>
            </button>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 11.5,
          lineHeight: 1.4,
          fontStyle: "italic",
          color: "var(--session-ink-ghost)",
        }}
      >
        Extraction runs concurrently each turn. The brief from turn N feeds
        the prompt at turn N+1 — a one-turn lag the user never feels.
      </div>
    </div>
  );
}

function CacheWrap({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: active ? 16 : 0,
        borderRadius: active ? 12 : 0,
        border: active
          ? `2px solid ${COLOR.identityBorder}`
          : "2px solid transparent",
        background: active ? "var(--session-walnut-tint)" : "transparent",
        transition: "padding 220ms ease, background 220ms ease",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 14,
            background: "var(--session-linen)",
            padding: "0 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
          }}
        >
          Cache hierarchy
        </div>
      )}
      {children}
    </div>
  );
}

function ExampleAssemblyFooter() {
  const segments: { label: string; tokens: number; tier: "static" | "persona" | "dynamic" }[] = [
    { label: "Tier 1 — Identity + Constitutional", tokens: 1400, tier: "static" },
    { label: "Tier 2 base — Voice scaffold", tokens: 2200, tier: "static" },
    { label: "Tier 2 delta — AuDHD persona", tokens: 950, tier: "persona" },
    { label: "Tier 3 — Situation mode opener", tokens: 380, tier: "persona" },
    { label: "Tier 3 — Conditional ladder (2 active)", tokens: 720, tier: "dynamic" },
    { label: "Live context — Manual + extraction + summary", tokens: 1850, tier: "dynamic" },
    { label: "Recent messages (sliding window)", tokens: 400, tier: "dynamic" },
  ];
  const total = segments.reduce((s, x) => s + x.tokens, 0);
  const cached = segments
    .filter((s) => s.tier !== "dynamic")
    .reduce((s, x) => s + x.tokens, 0);
  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        border: `1px solid ${COLOR.identityBorder}`,
        borderRadius: 10,
        background: "var(--session-walnut-tint)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
          }}
        >
          Example assembly — AuDHD · Situation · turn 12 · 2 entries
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--session-ink-soft)",
          }}
        >
          {total.toLocaleString()} tokens · {((cached / total) * 100).toFixed(0)}% cached
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 10,
              alignItems: "center",
              padding: "5px 8px",
              borderRadius: 4,
              background:
                s.tier === "static"
                  ? "var(--session-walnut-surface-soft)"
                  : s.tier === "persona"
                    ? "var(--session-persona-muted)"
                    : "var(--session-walnut-highlight)",
              border: `1px solid ${
                s.tier === "static"
                  ? COLOR.baseVoiceBorder
                  : s.tier === "persona"
                    ? COLOR.personaBorder
                    : COLOR.conditionalBorder
              }`,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                color: "var(--session-ink)",
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--session-ink-soft)",
              }}
            >
              {s.tokens.toLocaleString()} tok
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.5px",
                color: "var(--session-ink-ghost)",
                textTransform: "uppercase",
              }}
            >
              {s.tier === "dynamic" ? "rebuilt" : "cached"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
