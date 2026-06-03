"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Extraction map — "one call, two jobs."
//
// A background Sonnet call ("extraction") reads each turn and writes a single
// JSON case file (conversations.extraction_state). The next turn's prompt
// reads it. The case file does exactly two jobs: it BRIEFS Jove (soft prose
// that steers how Jove sounds) and it GATES checkpoints (hard deterministic
// checks that decide whether Jove may propose a Manual entry). A small set of
// raw notes — above all the user's exact words — feed both jobs.
//
// This page is organized around that frame: a front door, a lifecycle
// walkthrough, and a field-by-field map tagged by which job each note serves.
//
// FIELDS data is hand-curated — when extraction.ts changes the JSON shape,
// this file needs to follow.
// ---------------------------------------------------------------------------

type LoadBearing = "load-bearing" | "auxiliary";

// What job each note does in the "two jobs" frame.
//   gate     — hard. A deterministic input to the checkpoint gate.
//   brief    — soft. Steers the prose Jove reads next turn.
//   material — raw notes both jobs draw from (the user's words, layer state).
//   signal   — streamed to the client UI only (not read by Jove or the gate).
type JobId = "gate" | "brief" | "material" | "signal";

interface Field {
  path: string;
  type: string;
  job: JobId;
  loadBearing: LoadBearing;
  summary: string;
  represents: string;
  storage: string;
  readers: { where: string; what: string }[];
  gates: string;
  notes?: string;
}

interface Step {
  id: number;
  title: string;
  caption: string;
}

// ---------------------------------------------------------------------------
// Job metadata — labels, plain-language blurbs, and a tone for color coding.
// ---------------------------------------------------------------------------

const JOB_META: Record<
  JobId,
  { label: string; tag: string; tone: "hard" | "soft" | "both" | "ui"; blurb: string }
> = {
  gate: {
    label: "Gates checkpoints",
    tag: "decides",
    tone: "hard",
    blurb:
      "Deterministic checks that decide whether Jove may propose a Manual entry. They can silently veto Jove — this is the lock on what Jove can do.",
  },
  brief: {
    label: "Briefs Jove",
    tag: "steers",
    tone: "soft",
    blurb:
      "A cheat sheet woven into Jove's next prompt — what's underneath, which words matter, what to push on. It shapes how Jove sounds; it can't force anything.",
  },
  material: {
    label: "Raw material",
    tag: "both",
    tone: "both",
    blurb:
      "The notes both jobs read from — above all the user's exact words. The language bank is the heart of the system.",
  },
  signal: {
    label: "Client signal",
    tag: "ui",
    tone: "ui",
    blurb:
      "Streamed to the app to drive the in-conversation modal — not read by Jove or the gate.",
  },
};

const JOB_ORDER: JobId[] = ["gate", "brief", "material", "signal"];

function toneStyle(tone: "hard" | "soft" | "both" | "ui"): {
  bg: string;
  fg: string;
  border: string;
} {
  switch (tone) {
    case "hard":
      return {
        bg: "var(--session-warning-soft)",
        fg: "var(--session-warning)",
        border: "var(--session-warning)",
      };
    case "soft":
      return {
        bg: "var(--session-persona-tint)",
        fg: "var(--session-persona)",
        border: "var(--session-persona-border)",
      };
    case "both":
      return {
        bg: "var(--session-walnut-tint)",
        fg: "var(--session-walnut-meta-strong)",
        border: "var(--session-walnut-border)",
      };
    case "ui":
      return {
        bg: "var(--session-walnut-tint)",
        fg: "var(--session-ink-ghost)",
        border: "var(--session-walnut-border-soft)",
      };
  }
}

// ---------------------------------------------------------------------------
// Walkthrough steps — the lifecycle, end to end.
// ---------------------------------------------------------------------------

const STEPS: Step[] = [
  {
    id: 1,
    title: "The call",
    caption:
      "After every message, a second AI quietly reads the conversation — in the background, while Jove is already replying. Think of a court reporter in the corner: they transcribe and analyze, then slide a memo across the table that describes the exchange that just happened. So Jove always acts on last turn's notes, never this turn's. That one-beat lag is on purpose — Jove never stalls waiting for analysis, and the conversation is continuous enough that being a beat behind costs almost nothing.",
  },
  {
    id: 2,
    title: "The case file",
    caption:
      "The call writes one JSON blob — the case file — to conversations.extraction_state. Twenty notes in all, color-coded here by the job each one does. Most either brief Jove or gate checkpoints; a few are raw material both draw from. Click any note to see what it means, who reads it, and whether anything breaks if you remove it.",
  },
  {
    id: 3,
    title: "Job 1 · Briefs Jove",
    caption:
      "The soft job. These notes become a plain-language cheat sheet woven into Jove's next prompt — what's underneath the surface topic, which of the user's exact words carry weight, how deep things have gone, what to push on vs leave alone. It shapes how Jove sounds. It is advisory: it can suggest, but it can't force or stop anything.",
  },
  {
    id: 4,
    title: "Job 2 · Gates checkpoints",
    caption:
      "The hard job. These are deterministic checks — plain code, not Jove's judgment — that decide whether Jove may propose a Manual entry yet. Even if Jove writes the line that proposes one, a failed gate silently strips it. A checkpoint fires only when the material is genuinely ripe: the pattern's been engaged, depth has descended, there are concrete scenes across more than one situation, a mechanism, and no crisis.",
  },
  {
    id: 5,
    title: "The raw material",
    caption:
      "The notes both jobs read from. The language bank — the user's exact charged phrases — is the center of gravity: it keeps Jove quoting the user instead of paraphrasing them into a stranger, and (since the gate stopped trusting a self-reported flag) it is the real evidence the gate checks. Per-layer state tracks where each of the five Manual layers stands. One note, the pattern snippet, is a client-only signal that feeds the halfway-there modal.",
  },
  {
    id: 6,
    title: "By the numbers",
    caption:
      "The whole case file at a glance: how many notes do real work vs. just add framing, and where each one lands downstream. Use this to spot notes nothing reads — the prune candidates that bloat the extraction prompt without changing behavior.",
  },
];

// Which jobs the diagram spotlights at each step (others dim). null = no spotlight.
function spotlightForStep(stepId: number): Set<JobId> | null {
  switch (stepId) {
    case 3:
      return new Set<JobId>(["brief"]);
    case 4:
      return new Set<JobId>(["gate"]);
    case 5:
      return new Set<JobId>(["material", "signal"]);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// FIELDS — every note the extraction Sonnet call writes. Hand-curated to
// track extraction.ts; the readers are real call sites you can grep.
// ---------------------------------------------------------------------------

const FIELDS: Field[] = [
  // ── Gates checkpoints (hard) ───────────────────────────────────────────
  {
    path: "checkpoint_gate.concrete_examples",
    type: "number",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "How many real scenes the user has walked through.",
    represents:
      "Count of specific moments the user has walked Jove through. Moments within one incident still count separately here — the pattern-recurrence question is handled by distinct_contexts.",
    storage: "conversations.extraction_state.checkpoint_gate.concrete_examples",
    readers: [
      { where: "persona-pipeline.ts:576 (validateMaterialQuality)", what: "Requires ≥1 first checkpoint, ≥2 subsequent" },
      { where: "extraction.ts:540 (formatExtractionForPersona)", what: "gateReady computation + brief copy" },
      { where: "call-persona.ts:789 (SSE payload)", what: "Surfaced to client as concreteExamples" },
      { where: "MobileSession.tsx:867", what: "Current Modal 2 firing condition" },
    ],
    gates: "Checkpoint material-quality gate — the count threshold of real scenes.",
  },
  {
    path: "checkpoint_gate.distinct_contexts",
    type: "number (optional, recent)",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "How many *different* situations — not moments inside one.",
    represents:
      "Count of DIFFERENT situations / events / time-periods the user has narrated. Four moments in one phone call = 1 distinct context, not 4. Promoted from prose to gate logic recently.",
    storage: "conversations.extraction_state.checkpoint_gate.distinct_contexts",
    readers: [
      { where: "persona-pipeline.ts:591 (validateMaterialQuality)", what: "Requires ≥1 first checkpoint, ≥2 subsequent (soft fallback when missing)" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'evidence from N more contexts' brief copy" },
      { where: "call-persona.ts:617, persona-bridge.ts:203", what: "Plumbed into composeManualEntry — gates headline-softener validator" },
    ],
    gates: "The two-instance rule — a pattern claim needs ≥2 contexts for a non-first checkpoint.",
    notes: "Soft-fallback when undefined so legacy extraction states pass through.",
  },
  {
    path: "checkpoint_gate.has_mechanism",
    type: "boolean",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "Did the conversation reach WHY, not just WHAT.",
    represents:
      "Whether the conversation has reached WHY (not just WHAT). Specifically: a connection between an observed behavior and an underlying driver — a need, sensory load, system state, or bind.",
    storage: "conversations.extraction_state.checkpoint_gate.has_mechanism",
    readers: [
      { where: "persona-pipeline.ts:635 (validateMaterialQuality)", what: "Required subsequent; OR-with-driver_link for first" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'no mechanism' missing-piece copy" },
    ],
    gates: "Checkpoint quality gate — the depth-of-understanding check.",
  },
  {
    path: "checkpoint_gate.has_behavior_driver_link",
    type: "boolean",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "Is an observable behavior tied to what's fueling it.",
    represents:
      "Whether a clear line has been drawn between an observable behavior and what's fueling it.",
    storage: "conversations.extraction_state.checkpoint_gate.has_behavior_driver_link",
    readers: [
      { where: "persona-pipeline.ts:636 (validateMaterialQuality)", what: "Required subsequent; OR-with-mechanism for first" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'not connected to driver' missing copy" },
    ],
    gates: "Checkpoint quality gate — the behavior↔driver linkage.",
  },
  {
    path: "checkpoint_gate.strongest_layer",
    type: "number | null (1-5)",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "Which of the 5 layers has the most to work with right now.",
    represents:
      "Which of the 5 layers has the most material, examples, and depth right now. Set only when the gate is met.",
    storage: "conversations.extraction_state.checkpoint_gate.strongest_layer",
    readers: [
      { where: "extraction.ts:541, 567 (formatExtractionForPersona)", what: "Names the target layer in Jove's brief; surfaces existing entries on that layer" },
    ],
    gates: "Tells the composer which layer to deepen on when the checkpoint fires, and which layer the charged-phrase check runs against.",
  },
  {
    path: "depth",
    type: "enum (5 values)",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "How far down it's gone: surface → behavior → feeling → mechanism → origin.",
    represents:
      "Vertical position of the conversation — where it has descended to. surface → behavior → feeling → mechanism → origin.",
    storage: "conversations.extraction_state.depth",
    readers: [
      { where: "persona-pipeline.ts:567 (validateMaterialQuality)", what: "HARD GATE — checkpoint blocked until depth ≥ 'feeling' (first checkpoint) / 'mechanism' (subsequent)" },
      { where: "extraction.ts:609 (formatExtractionForPersona)", what: "One-line framing in the brief" },
      { where: "call-persona.ts:362", what: "Dev-only debug log" },
    ],
    gates: "Checkpoint depth gate — blocks the checkpoint until the conversation reaches 'feeling' (first) / 'mechanism' (subsequent).",
  },
  {
    path: "pattern_engaged",
    type: "boolean (sticky)",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "Jove named a pattern AND the user ran with it. Sticky once true.",
    represents:
      "Whether Jove has named a pattern in conversation AND the user has engaged with it (elaborated, added an example, sat with it). Sticky once true unless the user explicitly rejects the pattern.",
    storage: "conversations.extraction_state.pattern_engaged",
    readers: [
      { where: "persona-pipeline.ts:534 (validateMaterialQuality)", what: "HARD GATE — checkpoint blocked unless engaged (overridable at turn ≥12)" },
      { where: "extraction.ts:616 (formatExtractionForPersona)", what: "Drives the 'phase hint' paragraph at the end of the brief" },
    ],
    gates: "Premature-checkpoint suppression. Without engagement, the conversation hasn't reached the 'we both see something' beat.",
    notes: "Best candidate for the Modal 2 ('halfway') firing anchor — corresponds to a real felt conversational moment.",
  },
  {
    path: "clinical_flag { active, level, note }",
    type: "object",
    job: "gate",
    loadBearing: "load-bearing",
    summary: "Safety override. crisis = 988 protocol fires. caution = stay behavioral.",
    represents:
      "Safety signal. level ∈ {none, caution, crisis}. crisis = suicidal/harm intent (988 protocol fires). caution = diagnostic ask or distress exceeding manual scope.",
    storage: "conversations.extraction_state.clinical_flag",
    readers: [
      { where: "persona-pipeline.ts:527 (validateMaterialQuality)", what: "Crisis hard-blocks the checkpoint" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "Surfaces 'Safety note:' / 'Care note:' in Jove's brief ahead of any reflection" },
    ],
    gates: "Crisis override on every downstream surface — checkpoint, modals, prompt context.",
  },

  // ── Briefs Jove (soft) ─────────────────────────────────────────────────
  {
    path: "sage_brief",
    type: "string (3-5 sentences)",
    job: "brief",
    loadBearing: "load-bearing",
    summary: "The cheat sheet itself — what's underneath, what to push on.",
    represents:
      "Short paragraph orienting Jove for the next turn — what's underneath the surface topic, which exact words are load-bearing, what's most charged, what to push on vs leave alone.",
    storage: "conversations.extraction_state.sage_brief",
    readers: [
      { where: "extraction.ts:500 (formatExtractionForPersona)", what: "Rendered verbatim at the top of Jove's brief block" },
      { where: "call-persona.ts:364", what: "Dev-only debug log (first 150 chars)" },
    ],
    gates: "The centerpiece of the brief. Empty = Jove flies blind.",
    notes: "Named sage_brief for historical reasons (the persona was once 'Sage'); it is the brief.",
  },
  {
    path: "current_thread",
    type: "string",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "One sentence: what the conversation is actually about right now.",
    represents:
      "One sentence describing what the conversation is actually about right now.",
    storage: "conversations.extraction_state.current_thread",
    readers: [
      { where: "extraction.ts:611 (formatExtractionForPersona)", what: "Single line in Jove's brief" },
    ],
    gates: "None. Framing only.",
    notes: "Overlaps with sage_brief. Removing it marginally shortens the prompt.",
  },
  {
    path: "mode",
    type: "'situation_led' | 'direct_exploration' | 'synthesis'",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "The stance the extractor recommends Jove take.",
    represents:
      "Extractor's recommendation for Jove's stance. situation_led is default; direct_exploration when ≥2 layers have entries; synthesis when all 5 do.",
    storage: "conversations.extraction_state.mode",
    readers: [
      { where: "extraction.ts:609 (formatExtractionForPersona)", what: "'Current approach: X' framing line in the brief" },
      { where: "call-persona.ts:363", what: "Dev-only debug log" },
    ],
    gates: "None. Framing only.",
    notes:
      "Derivable from manualComponents.length. Distinct from conversations.mode (unrelated).",
  },
  {
    path: "observation_miss_count",
    type: "integer 0-3 (capped)",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "How many of Jove's guesses in a row the user pushed back on.",
    represents:
      "How many consecutive Jove observations the user has pushed back on. Increments on rejection/redirect/withdraw; resets on confirm/elaborate. Capped at 3.",
    storage: "conversations.extraction_state.observation_miss_count",
    readers: [
      { where: "extraction.ts:493 (formatExtractionForPersona)", what: "Drives 'full reset' / 'pure grounding' instructions in brief when ≥2" },
    ],
    gates: "Soft control — at 3, the brief tells Jove to drop observations and just ground.",
    notes:
      "Could be made deterministic (count post-rejection system messages + short-answer streaks).",
  },
  {
    path: "user_named_cost",
    type: "boolean",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "Has the user said, in their words, what the pattern costs them.",
    represents:
      "Whether the user has articulated, in their own words, what the pattern costs them.",
    storage: "conversations.extraction_state.user_named_cost",
    readers: [
      { where: "extraction.ts:625 (formatExtractionForPersona)", what: "Tail of brief: 'user named the cost' hint" },
    ],
    gates: "None — an informational nudge in the brief's closing lines.",
  },
  {
    path: "user_named_stance",
    type: "boolean",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "Has the user said what they want now that they see the pattern.",
    represents:
      "Whether the user has expressed what they want now that they can see the pattern (a request, decision, or honest incomplete).",
    storage: "conversations.extraction_state.user_named_stance",
    readers: [
      { where: "extraction.ts:625 (formatExtractionForPersona)", what: "Tail of brief: pairs with user_named_cost" },
    ],
    gates: "None — an informational nudge in the brief's closing lines.",
  },
  {
    path: "checkpoint_gate.has_charged_language",
    type: "boolean",
    job: "brief",
    loadBearing: "auxiliary",
    summary: "Self-report that a high-charge phrase exists. No longer the real check.",
    represents:
      "Whether the language bank holds ≥1 high-charge phrase (sensory, somatic, masking, shutdown, system, or bind) that can anchor a checkpoint. Once gated checkpoints; now informational.",
    storage: "conversations.extraction_state.checkpoint_gate.has_charged_language",
    readers: [
      { where: "persona-pipeline.ts:613–627 (validateMaterialQuality — Lock 1)", what: "No longer a gate on this field. Lock 1 replaced the boolean with a deterministic language_bank read (≥1 high/medium phrase on the candidate layer); has_charged_language is informational now — still produced, not gated on." },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady hint + 'no phrase carries weight' missing copy" },
    ],
    gates: "No longer a gate. Lock 1 moved the real vocabulary check to a deterministic language_bank read; this field just informs the brief now.",
    notes: "Sits inside checkpoint_gate structurally, but the gate ignores it. Demoted by ADR-043.",
  },

  // ── Raw material (feeds both) ──────────────────────────────────────────
  {
    path: "language_bank[]",
    type: "array of { phrase, context, charge, layers }",
    job: "material",
    loadBearing: "load-bearing",
    summary: "The user's exact charged phrases — the heart of the system.",
    represents:
      "User's exact phrases that carry weight (sensory, somatic, masking, shutdown, system, bind language). Cumulative across the session, capped at 15 entries, oldest low-charge dropped first. Feeds BOTH jobs: it's quoted in the brief and it's the real evidence the gate checks.",
    storage: "conversations.extraction_state.language_bank",
    readers: [
      { where: "persona-pipeline.ts:613–627 (validateMaterialQuality — Lock 1)", what: "GATE — the deterministic charged-language check reads the bank directly (≥1 high/medium phrase on the candidate layer)" },
      { where: "confirm-checkpoint.ts (composeManualEntry)", what: "Top 10 high/medium-charge phrases passed into the composer prompt verbatim" },
      { where: "extraction.ts:517 (formatExtractionForPersona)", what: "Top 15 charged entries listed in the brief as 'phrases the user has used'" },
      { where: "call-persona.ts:609, persona-bridge.ts:200", what: "Pass-through into composeManualEntry from web + SMS paths" },
    ],
    gates: "Keeps the user's voice in their Manual AND anchors the checkpoint gate. Without it, the composer drifts into clinical-adjacent prose and the gate loses its evidence.",
  },
  {
    path: "layers[1..5].signal",
    type: "'none' | 'emerging' | 'explored' | 'checkpoint_ready'",
    job: "material",
    loadBearing: "load-bearing",
    summary: "Where each of the 5 layers stands (only ever advances).",
    represents:
      "Where each layer is in its development. Monotonic — only advances. When a layer already has a confirmed entry, its signal starts at 'explored' minimum.",
    storage: "conversations.extraction_state.layers[N].signal",
    readers: [
      { where: "persona-pipeline.ts:686 (deriveCheckpointApproaching)", what: "A layer ≥ 'explored' loads CHECKPOINTS instructions only when charged material backs that layer and no crisis is active; otherwise it falls through to the full ripeness gate" },
      { where: "call-persona.ts:763 (SSE payload)", what: "Computes hasLayerEmergingOrBeyond (any signal !== 'none') for client" },
      { where: "extraction.ts:506 (formatExtractionForPersona)", what: "Per-layer status line in the brief" },
      { where: "MobileSession.tsx:866", what: "hasLayerEmergingOrBeyond gates Modal 2 firing" },
    ],
    gates: "'Is this turn a checkpoint moment?' upstream of the gate. Also gates the halfway-there modal.",
  },
  {
    path: "layers[1..5].material",
    type: "string[]",
    job: "material",
    loadBearing: "load-bearing",
    summary: "Jove-side observations attached to each layer (cumulative).",
    represents:
      "Specific observations attached to each layer. Cumulative — accumulates across the session.",
    storage: "conversations.extraction_state.layers[N].material",
    readers: [
      { where: "extraction.ts:506-508 (formatExtractionForPersona)", what: "Last 3 entries shown in the brief as 'recent observations'" },
    ],
    gates: "Indirect — feeds the brief so depth carries across turns.",
  },
  {
    path: "layers[1..5].examples",
    type: "string[]",
    job: "material",
    loadBearing: "auxiliary",
    summary: "User-narrated moments tagged to a layer. Nothing downstream reads it.",
    represents:
      "Concrete moments the user narrated, tagged to layer. Distinct from material (which is Jove-side observations).",
    storage: "conversations.extraction_state.layers[N].examples",
    readers: [
      { where: "(extractor's own cumulative reasoning)", what: "Read by the extractor next turn to avoid double-counting" },
    ],
    gates: "None directly. The count feeds concrete_examples, which is what actually surfaces.",
    notes: "Prune candidate — extractor-internal bookkeeping, no downstream reader.",
  },

  // ── Client signal (UI only) ────────────────────────────────────────────
  {
    path: "emerging_pattern_snippet",
    type: "string (<15 words) | null",
    job: "signal",
    loadBearing: "load-bearing",
    summary: "Short phrase naming the forming pattern. Drives the halfway-there modal.",
    represents:
      "Short phrase describing the forming pattern in behavioral/experiential terms. Regenerated each turn — never latched. Null when no clear pattern has emerged.",
    storage: "conversations.extraction_state.emerging_pattern_snippet",
    readers: [
      { where: "call-persona.ts:786 (SSE payload)", what: "Surfaced to client as emergingPatternSnippet" },
      { where: "MobileSession.tsx:868, 873 + PatternFormingModal:158", what: "Modal 2 firing + the snippet text rendered inside the modal" },
    ],
    gates: "Modal 2 ('halfway there') firing + the displayed text. Read by the client only, not by Jove or the gate.",
  },
];

const SELECTED_RING = "0 0 0 2px var(--session-walnut-meta)";

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

type Selection = { kind: "field"; path: string };

function selectionKey(s: Selection | null): string | null {
  if (!s) return null;
  return `field:${s.path}`;
}

function fieldsForJob(job: JobId): Field[] {
  return FIELDS.filter((f) => f.job === job);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExtractionMapPage() {
  const isAdmin = useIsAdmin();
  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const step = STEPS[stepIndex];
  const spotlight = useMemo(() => spotlightForStep(step.id), [step.id]);

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
  };

  const jumpToStep = (i: number) => {
    setStepIndex(i);
    setSelection(null);
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
        <AdminNavRail activeId="extraction-map" />

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

          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 32,
              padding: "28px 32px",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowY: "auto", paddingRight: 12 }}>
              <FrontDoor onJump={jumpToStep} />
              <div style={{ height: 18 }} />
              <Diagram
                stepId={step.id}
                spotlight={spotlight}
                selection={selection}
                onSelect={handleSelect}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--session-linen)",
                  paddingBottom: 16,
                  marginBottom: 16,
                  borderBottom: "1px solid var(--session-ink-hairline)",
                  zIndex: 1,
                }}
              >
                <Stepper stepIndex={stepIndex} setStepIndex={jumpToStep} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {selection ? (
                  <FieldDetail
                    field={FIELDS.find((f) => f.path === selection.path)!}
                    onClose={() => setSelection(null)}
                  />
                ) : (
                  <StepCaption step={step} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
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
        What Jove tracks between turns
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "14.5px",
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 880,
        }}
      >
        After every message, a second AI (the &ldquo;extraction&rdquo; call)
        quietly updates a case file on the conversation — {FIELDS.length} running
        notes Jove reads on the <em>next</em> turn to know what&rsquo;s
        underneath, which of the user&rsquo;s exact words matter, and whether
        there&rsquo;s finally enough to propose a Manual entry (a
        &ldquo;checkpoint&rdquo;). This page maps every note: what it&rsquo;s
        for, who reads it, and whether anything breaks if you remove it. Use it
        to see what the extractor tracks, and to spot notes nothing reads.
      </p>
      <a
        href="/admin/prompt-architecture"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.3px",
          color: "var(--session-walnut-meta-strong)",
          textDecoration: "none",
        }}
      >
        ↳ This is the deep dive behind the &ldquo;Extraction Brief&rdquo; block
        in Jove&rsquo;s prompt — see it in context →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Front door — "one call, two jobs," always visible, collapsible.
// ---------------------------------------------------------------------------

function FrontDoor({ onJump }: { onJump: (i: number) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface-soft)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 16px",
        }}
        aria-expanded={open}
      >
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 16,
            fontStyle: "italic",
            color: "var(--session-ink)",
          }}
        >
          One call, two jobs
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          {open ? "hide ▲" : "what is this? ▼"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <p
            style={{
              margin: "0 0 14px",
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
            }}
          >
            One background call keeps the case file. Everything in it serves one
            of two jobs — and a handful of raw notes feed both.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FrontDoorJob job="brief" onJump={() => onJump(2)} />
            <FrontDoorJob job="gate" onJump={() => onJump(3)} />

            <div
              style={{
                padding: "11px 13px",
                borderRadius: 8,
                border: "1px dashed var(--session-walnut-border)",
                background: "var(--session-walnut-tint)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--session-ink)",
                }}
              >
                <strong style={{ fontWeight: 600 }}>And the raw material both jobs read.</strong>{" "}
                The user&rsquo;s exact words — the language bank — feed both the
                brief and the gate. It&rsquo;s the heart of the system.
              </div>
              <JumpButton label="Show it below ↓" onClick={() => onJump(4)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FrontDoorJob({ job, onJump }: { job: JobId; onJump: () => void }) {
  const meta = JOB_META[job];
  const tone = toneStyle(meta.tone);
  const fields = fieldsForJob(job);
  return (
    <div
      style={{
        padding: "11px 13px",
        borderRadius: 8,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--session-ink)",
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: tone.fg,
            border: `1px solid ${tone.border}`,
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {job === "brief" ? "soft" : "hard"}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
          marginBottom: 7,
        }}
      >
        {meta.blurb}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--session-ink-ghost)",
          letterSpacing: "0.3px",
          lineHeight: 1.5,
        }}
      >
        {fields.map((f) => f.path.replace(/\[.*?\]|\{.*?\}/g, "").trim()).join(" · ")}
      </div>
      <JumpButton label="Show it below ↓" onClick={onJump} />
    </div>
  );
}

function JumpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        marginTop: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "0.5px",
        color: "var(--session-walnut-meta-strong)",
        borderBottom: "1px solid var(--session-walnut-border)",
        paddingBottom: 1,
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({
  stepIndex,
  setStepIndex,
}: {
  stepIndex: number;
  setStepIndex: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
        disabled={stepIndex === 0}
        aria-label="Previous step"
        style={arrowBtnStyle(stepIndex === 0)}
      >
        ←
      </button>
      <div
        style={{
          display: "flex",
          gap: 4,
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        {STEPS.map((s, i) => {
          const active = i === stepIndex;
          const visited = i <= stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(i)}
              aria-label={`Step ${s.id}: ${s.title}`}
              title={s.title}
              style={{
                all: "unset",
                cursor: "pointer",
                width: 24,
                height: 24,
                borderRadius: 999,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
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
        onClick={() => setStepIndex(Math.min(STEPS.length - 1, stepIndex + 1))}
        disabled={stepIndex === STEPS.length - 1}
        aria-label="Next step"
        style={arrowBtnStyle(stepIndex === STEPS.length - 1)}
      >
        →
      </button>
    </div>
  );
}

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    all: "unset",
    cursor: disabled ? "default" : "pointer",
    width: 24,
    height: 24,
    borderRadius: 5,
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
// Right column — step caption or field detail
// ---------------------------------------------------------------------------

function StepCaption({ step }: { step: Step }) {
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
        Step {step.id} of {STEPS.length}
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
        {step.title}
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
        {step.caption}
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
        Click any note on the left to see what it means, who reads it, and what it gates.
      </p>
    </>
  );
}

function FieldDetail({
  field,
  onClose,
}: {
  field: Field;
  onClose: () => void;
}) {
  const meta = JOB_META[field.job];
  const tone = toneStyle(meta.tone);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "1.2px",
              fontWeight: 500,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 3,
              background: tone.bg,
              color: tone.fg,
              border: `1px solid ${tone.border}`,
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color:
                field.loadBearing === "load-bearing"
                  ? "var(--session-walnut-meta-strong)"
                  : "var(--session-ink-ghost)",
            }}
          >
            {field.loadBearing === "load-bearing" ? "load-bearing" : "auxiliary"}
          </span>
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
          ← Back to step
        </button>
      </div>

      {/* Plain-language meaning leads. */}
      <p
        style={{
          margin: "4px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 16,
          lineHeight: 1.5,
          color: "var(--session-ink)",
        }}
      >
        {field.represents}
      </p>

      {/* The code identity, demoted to small print. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--session-ink-soft)",
            wordBreak: "break-word",
          }}
        >
          {field.path}
        </code>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--session-ink-ghost)",
          }}
        >
          {field.type}
        </span>
      </div>

      <DetailSection title="What it gates">
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--session-ink)",
          }}
        >
          {field.gates}
        </p>
      </DetailSection>

      {field.notes && (
        <DetailSection title="Notes">
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--session-ink-soft)",
              fontStyle: "italic",
            }}
          >
            {field.notes}
          </p>
        </DetailSection>
      )}

      {/* Engineering detail */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
            <div>
              <DetailLabel>Stored at</DetailLabel>
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--session-ink)",
                  background: "var(--session-walnut-surface-soft)",
                  padding: "4px 8px",
                  borderRadius: 4,
                  display: "inline-block",
                  wordBreak: "break-word",
                }}
              >
                {field.storage}
              </code>
            </div>

            <div>
              <DetailLabel>{`Readers (${field.readers.length})`}</DetailLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {field.readers.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-spectral, var(--font-serif))",
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--session-ink-ghost)",
                    }}
                  >
                    None. No downstream code reads this — a pure prune candidate.
                  </p>
                ) : (
                  field.readers.map((r) => (
                    <div
                      key={r.where}
                      style={{
                        padding: "6px 10px",
                        background: "var(--session-walnut-tint)",
                        border: "1px solid var(--session-walnut-border-soft)",
                        borderRadius: 5,
                      }}
                    >
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: "var(--session-ink)",
                          fontWeight: 500,
                          display: "block",
                          marginBottom: 3,
                        }}
                      >
                        {r.where}
                      </code>
                      <div
                        style={{
                          fontFamily: "var(--font-spectral, var(--font-serif))",
                          fontSize: 12.5,
                          lineHeight: 1.45,
                          color: "var(--session-ink-soft)",
                        }}
                      >
                        {r.what}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
      </div>
    </>
  );
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "var(--session-ink-ghost)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 12,
        borderTop: "1px solid var(--session-walnut-border-soft)",
      }}
    >
      <DetailLabel>{title}</DetailLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagram — lifecycle strip (step 1), job groups (steps 2-5), numbers (step 6)
// ---------------------------------------------------------------------------

function Diagram({
  stepId,
  spotlight,
  selection,
  onSelect,
}: {
  stepId: number;
  spotlight: Set<JobId> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (stepId === 1) {
    return <LifecycleStrip />;
  }
  if (stepId === 6) {
    return <WorkedExampleFooter />;
  }
  return (
    <JobGroups spotlight={spotlight} selection={selection} onSelect={onSelect} />
  );
}

// ---------------------------------------------------------------------------
// Lifecycle strip — visualizes the one-beat-behind flow.
// ---------------------------------------------------------------------------

function LifecycleStrip() {
  const node = (
    title: string,
    sub: string,
    tone?: "hard" | "soft",
  ): React.ReactNode => {
    const t = tone ? toneStyle(tone) : null;
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "12px 14px",
          borderRadius: 8,
          border: `1px solid ${t ? t.border : "var(--session-walnut-border)"}`,
          background: t ? t.bg : "var(--session-walnut-surface-soft)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--session-ink)",
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--session-ink-soft)",
          }}
        >
          {sub}
        </div>
      </div>
    );
  };

  const arrow = (label?: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 2px",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "var(--session-ink-ghost)", fontSize: 16 }}>→</span>
      {label && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8.5,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <SectionHeader>This turn — happening at once</SectionHeader>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {node("User message", "What the person just sent.")}
          {arrow()}
          {node("Jove replies", "Generated immediately — does not wait for analysis.")}
          {arrow()}
          {node("Extraction call", "A second AI reads the conversation, in the background.")}
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--session-ink-soft)",
          textAlign: "center",
          padding: "2px 0",
        }}
      >
        ↓ the call writes its notes to the case file ↓
      </div>

      <div>
        <SectionHeader>Next turn — the notes are read</SectionHeader>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {node("The case file", "Last turn's notes — one JSON blob.")}
          {arrow("feeds")}
          {node("Briefs Jove", "Soft guidance Jove reads.", "soft")}
        </div>
        <div style={{ height: 6 }} />
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          <div style={{ flex: 1 }} />
          {arrow("feeds")}
          {node("Gates checkpoints", "Hard checks that decide a Manual entry.", "hard")}
        </div>
      </div>

      <div
        style={{
          padding: "11px 13px",
          borderRadius: 8,
          border: "1px dashed var(--session-walnut-border)",
          background: "var(--session-walnut-tint)",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
        }}
      >
        <strong style={{ color: "var(--session-ink)", fontWeight: 600 }}>
          The one-beat lag:
        </strong>{" "}
        because the call isn&rsquo;t waited on, the notes Jove uses this turn are
        the ones written <em>last</em> turn. On purpose — Jove never stalls, and
        a continuous conversation barely notices the delay.
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "var(--session-walnut-meta)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job groups — one panel per job; dims when the step doesn't spotlight it.
// ---------------------------------------------------------------------------

function JobGroups({
  spotlight,
  selection,
  onSelect,
}: {
  spotlight: Set<JobId> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {JOB_ORDER.map((job) => {
        const fields = fieldsForJob(job);
        const meta = JOB_META[job];
        const tone = toneStyle(meta.tone);
        const lit = !spotlight || spotlight.has(job);
        const loadBearing = fields.filter((f) => f.loadBearing === "load-bearing").length;
        return (
          <div
            key={job}
            style={{
              opacity: lit ? 1 : 0.28,
              transition: "opacity 220ms ease",
              padding: 12,
              borderRadius: 8,
              background: lit ? tone.bg : "transparent",
              border: `1px solid ${lit ? tone.border : "var(--session-walnut-border-soft)"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--session-ink)",
                  }}
                >
                  {meta.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    color: tone.fg,
                  }}
                >
                  {meta.tag}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--session-ink-ghost)",
                  }}
                >
                  {fields.length}
                </span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  color: "var(--session-ink-ghost)",
                  letterSpacing: "0.5px",
                }}
              >
                {loadBearing} load-bearing
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 6,
              }}
            >
              {fields.map((f) => (
                <FieldCard
                  key={f.path}
                  field={f}
                  selected={selection?.kind === "field" && selection.path === f.path}
                  onClick={() => onSelect({ kind: "field", path: f.path })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field card — plain-language summary leads; code path is small print.
// ---------------------------------------------------------------------------

function FieldCard({
  field,
  selected,
  onClick,
}: {
  field: Field;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        padding: "9px 11px",
        background: "var(--session-walnut-surface-soft)",
        border: `1px solid ${
          field.loadBearing === "load-bearing"
            ? "var(--session-walnut-border)"
            : "var(--session-walnut-border-soft)"
        }`,
        borderRadius: 6,
        boxShadow: selected ? SELECTED_RING : "none",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          color: "var(--session-ink)",
          lineHeight: 1.4,
          marginBottom: 4,
        }}
      >
        {field.summary}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--session-ink-ghost)",
            wordBreak: "break-word",
          }}
        >
          {field.path}
        </code>
        {field.loadBearing === "auxiliary" && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8.5,
              letterSpacing: "0.5px",
              color: "var(--session-ink-ghost)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
            title="Auxiliary — nothing breaks if you remove it"
          >
            aux
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// By the numbers — prune lens + destinations matrix.
// ---------------------------------------------------------------------------

function WorkedExampleFooter() {
  const total = FIELDS.length;
  const loadBearing = FIELDS.filter((f) => f.loadBearing === "load-bearing").length;
  const auxiliary = FIELDS.filter((f) => f.loadBearing === "auxiliary").length;
  const totalReaders = FIELDS.reduce((s, f) => s + f.readers.length, 0);
  const pruneCandidates = FIELDS.filter(
    (f) => f.notes?.toLowerCase().includes("prune candidate") || f.readers.length === 0,
  ).length;

  const jobCounts = JOB_ORDER.map((job) => ({
    job,
    count: fieldsForJob(job).length,
  }));

  // Destinations matrix — count fields per downstream surface.
  const destinations: { label: string; count: number; oneLine: string }[] = [
    {
      label: "Jove's brief",
      count: FIELDS.filter((f) =>
        f.readers.some((r) => r.where.includes("formatExtractionForPersona")),
      ).length,
      oneLine: "Rendered into the per-turn brief block that Jove reads first.",
    },
    {
      label: "Checkpoint gate",
      count: FIELDS.filter((f) =>
        f.readers.some((r) => r.where.includes("validateMaterialQuality")),
      ).length,
      oneLine: "Inputs to the deterministic checks before a Manual entry is composed.",
    },
    {
      label: "Composer",
      count: FIELDS.filter((f) =>
        f.readers.some(
          (r) => r.where.includes("composeManualEntry") || r.where.includes("confirm-checkpoint"),
        ),
      ).length,
      oneLine: "Passed into the Manual entry composer prompt verbatim.",
    },
    {
      label: "Modals",
      count: FIELDS.filter((f) =>
        f.readers.some(
          (r) => r.where.includes("MobileSession") || r.where.includes("Modal"),
        ),
      ).length,
      oneLine: "Drives the in-conversation modal (halfway-there).",
    },
    {
      label: "SSE payload",
      count: FIELDS.filter((f) =>
        f.readers.some((r) => r.where.includes("SSE payload")),
      ).length,
      oneLine: "Streamed to the client for chat-input hints and UI state.",
    },
  ];

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-tint)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        The case file by the numbers
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <HeroStat value={total} label="Notes" />
        <HeroStat value={loadBearing} label="Load-bearing" />
        <HeroStat value={auxiliary} label="Auxiliary" />
        <HeroStat value={totalReaders} label="Reader sites" />
        <HeroStat value={pruneCandidates} label="Prune candidates" />
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Notes by job
      </div>
      <div
        style={{
          display: "flex",
          height: 12,
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid var(--session-walnut-border-soft)",
          marginBottom: 8,
        }}
      >
        {jobCounts.map((c) => (
          <div
            key={c.job}
            style={{
              flexGrow: c.count,
              background: toneStyle(JOB_META[c.job].tone).bg,
              minWidth: 0,
            }}
            title={`${JOB_META[c.job].label}: ${c.count}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        {jobCounts.map((c) => (
          <div
            key={c.job}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--session-ink-soft)",
              letterSpacing: "0.5px",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: toneStyle(JOB_META[c.job].tone).bg,
                border: `1px solid ${toneStyle(JOB_META[c.job].tone).border}`,
                display: "inline-block",
              }}
            />
            {JOB_META[c.job].label}
            <span style={{ color: "var(--session-ink-ghost)" }}>{c.count}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Where the notes land
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {destinations.map((d) => (
          <div
            key={d.label}
            style={{
              padding: "10px 12px",
              background: "var(--session-walnut-surface-soft)",
              border: "1px solid var(--session-walnut-border-soft)",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--session-ink)",
                }}
              >
                {d.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: 18,
                  fontStyle: "italic",
                  color: "var(--session-ink)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.count}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--session-ink-soft)",
                lineHeight: 1.4,
              }}
            >
              {d.oneLine}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--session-ink-ghost)",
          lineHeight: 1.5,
        }}
      >
        Counts derive from the readers list on each note — wire a note into a new
        consumer, update its readers in this file, and the totals here recompute
        on their own.
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 36,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1,
          color: "var(--session-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "1px",
          color: "var(--session-ink-ghost)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
