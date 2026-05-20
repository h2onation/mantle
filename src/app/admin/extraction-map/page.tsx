"use client";

import { Fragment, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Extraction consumer map — staged walkthrough of the 21 fields the
// background Sonnet extraction call writes every turn. Modeled on
// /admin/prompt-architecture and /admin/schema-map: stepper-driven layers,
// sticky right-column detail, click-through inspection, reading guide.
//
// FIELDS data is hand-curated — when extraction.ts changes the JSON shape,
// this file needs to follow.
// ---------------------------------------------------------------------------

type LoadBearing = "load-bearing" | "auxiliary";
type CategoryId = "gate" | "phase" | "composer" | "layers" | "auxiliary";

interface Field {
  path: string;
  type: string;
  category: CategoryId;
  loadBearing: LoadBearing;
  summary: string;
  represents: string;
  storage: string;
  readers: { where: string; what: string }[];
  gates: string;
  notes?: string;
}

interface Stage {
  id: number;
  title: string;
  caption: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: "Layer 0 — the extraction call",
    caption:
      "Every turn, a background Sonnet call analyzes the conversation and writes a single JSON blob to conversations.extraction_state. 21 fields total. The next turn's prompt reads it; the current turn's response doesn't depend on it (one-turn lag). Click any field for its source, readers, and gating role.",
  },
  {
    id: 2,
    title: "Layer 1 — the brief",
    caption:
      "sage_brief is the headline output. A 3-5 sentence cheat sheet that names what's underneath the surface topic, which exact words are load-bearing, what to push on vs leave alone. Rendered verbatim at the top of Jove's brief block every turn. Empty = Jove flies blind.",
  },
  {
    id: 3,
    title: "Layer 2 — the checkpoint gate",
    caption:
      "Six fields that decide whether a checkpoint can fire. First checkpoint needs ≥1 concrete example; subsequent ones need ≥2 distinct contexts plus a charged-language anchor and a behavior-driver link. distinct_contexts enforces the two-instance rule.",
  },
  {
    id: 4,
    title: "Layer 3 — phase + safety",
    caption:
      "Two signals that override everything downstream. pattern_engaged blocks premature checkpoints (no Manual entry until Jove named a pattern AND the user engaged with it). clinical_flag carries the safety override — crisis fires the 988 protocol; caution keeps Jove behavioral.",
  },
  {
    id: 5,
    title: "Layer 4 — composer + voice",
    caption:
      "Three fields that shape what Jove says and how the Manual entry composer writes. language_bank holds the user's exact charged phrases (top 15 cumulative). sage_brief is rendered verbatim. emerging_pattern_snippet is a regenerated <15-word phrase describing the forming pattern; drives Modal 2.",
  },
  {
    id: 6,
    title: "Layer 5 — per-layer state",
    caption:
      "Each of the 5 Manual layers tracks its own state. signal (none / emerging / explored / checkpoint_ready) advances monotonically. material accumulates Jove-side observations. examples track user-narrated moments.",
  },
  {
    id: 7,
    title: "Auxiliary signals",
    caption:
      "Seven fields that don't gate anything but shape Jove's framing — depth of conversation, extractor's stance recommendation, the current thread, observation-miss count, what the user has named (cost, stance), and a UI placeholder hint. Prune candidates if the extraction prompt gets cramped.",
  },
  {
    id: 8,
    title: "By the numbers",
    caption:
      "21 fields total, fanning out to 5 downstream surfaces — checkpoint gate, Jove's brief, composer, modals, chat input. 14 are load-bearing (at least one reader); 7 are auxiliary (could be pruned without changing behavior).",
  },
];

const CATEGORY_LABEL: Record<CategoryId, string> = {
  gate: "Checkpoint gate",
  phase: "Phase + safety",
  composer: "Composer + voice",
  layers: "Per-layer state",
  auxiliary: "Auxiliary",
};

// ---------------------------------------------------------------------------
// FIELDS — every field the extraction Sonnet call writes. Preserved verbatim
// from the previous page; if extraction.ts changes the JSON shape, update here.
// ---------------------------------------------------------------------------

const FIELDS: Field[] = [
  // ── Gate ───────────────────────────────────────────────────────────────
  {
    path: "checkpoint_gate.concrete_examples",
    type: "number",
    category: "gate",
    loadBearing: "load-bearing",
    summary:
      "Count of scenes the user has walked through (moments within one incident count separately).",
    represents:
      "Count of specific moments the user has walked Jove through. Moments within one incident still count separately here — the pattern-recurrence question is handled by distinct_contexts.",
    storage: "conversations.extraction_state.checkpoint_gate.concrete_examples",
    readers: [
      { where: "persona-pipeline.ts:447 (validateMaterialQuality)", what: "Requires ≥1 first checkpoint, ≥2 subsequent" },
      { where: "extraction.ts:540 (formatExtractionForPersona)", what: "gateReady computation + brief copy" },
      { where: "call-persona.ts:789 (SSE payload)", what: "Surfaced to client as concreteExamples" },
      { where: "MobileSession.tsx:867", what: "Current Modal 2 firing condition" },
    ],
    gates: "Checkpoint material-quality gate (count threshold).",
  },
  {
    path: "checkpoint_gate.distinct_contexts",
    type: "number (optional, recent)",
    category: "gate",
    loadBearing: "load-bearing",
    summary:
      "Count of *different* situations narrated (not moments inside one situation).",
    represents:
      "Count of DIFFERENT situations / events / time-periods the user has narrated. Four moments in one phone call = 1 distinct context, not 4. Promoted from prose to gate logic recently.",
    storage: "conversations.extraction_state.checkpoint_gate.distinct_contexts",
    readers: [
      { where: "persona-pipeline.ts:454 (validateMaterialQuality)", what: "Requires ≥1 first checkpoint, ≥2 subsequent (soft fallback when missing)" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'evidence from N more contexts' brief copy" },
      { where: "call-persona.ts:617, persona-bridge.ts:203", what: "Plumbed into composeManualEntry — gates headline-softener validator" },
    ],
    gates: "Two-instance rule (pattern claim needs ≥2 contexts for non-first checkpoint).",
    notes: "Soft-fallback when undefined so legacy extraction states pass through.",
  },
  {
    path: "checkpoint_gate.has_mechanism",
    type: "boolean",
    category: "gate",
    loadBearing: "load-bearing",
    summary: "Whether the conversation reached WHY (not just WHAT).",
    represents:
      "Whether the conversation has reached WHY (not just WHAT). Specifically: a connection between an observed behavior and an underlying driver — a need, sensory load, system state, or bind.",
    storage: "conversations.extraction_state.checkpoint_gate.has_mechanism",
    readers: [
      { where: "persona-pipeline.ts:461 (validateMaterialQuality)", what: "Required subsequent; OR-with-driver_link for first" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'no mechanism' missing-piece copy" },
    ],
    gates: "Checkpoint quality gate (depth check).",
  },
  {
    path: "checkpoint_gate.has_charged_language",
    type: "boolean",
    category: "gate",
    loadBearing: "load-bearing",
    summary: "Whether the language bank holds ≥1 high-charge phrase from the user.",
    represents:
      "Whether the language bank holds ≥1 high-charge phrase (sensory, somatic, masking, shutdown, system, or bind) that can anchor a checkpoint.",
    storage: "conversations.extraction_state.checkpoint_gate.has_charged_language",
    readers: [
      { where: "persona-pipeline.ts:464 (validateMaterialQuality)", what: "Always required" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'no phrase carries weight' missing copy" },
    ],
    gates: "Checkpoint quality gate (vocabulary check).",
  },
  {
    path: "checkpoint_gate.has_behavior_driver_link",
    type: "boolean",
    category: "gate",
    loadBearing: "load-bearing",
    summary: "Whether observable behavior is tied to what's fueling it.",
    represents:
      "Whether a clear line has been drawn between an observable behavior and what's fueling it.",
    storage: "conversations.extraction_state.checkpoint_gate.has_behavior_driver_link",
    readers: [
      { where: "persona-pipeline.ts:462 (validateMaterialQuality)", what: "Required subsequent; OR-with-mechanism for first" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "gateReady + 'not connected to driver' missing copy" },
    ],
    gates: "Checkpoint quality gate (behavior↔driver linkage).",
  },
  {
    path: "checkpoint_gate.strongest_layer",
    type: "number | null (1-5)",
    category: "gate",
    loadBearing: "load-bearing",
    summary: "Which of the 5 layers has the most material right now.",
    represents:
      "Which of the 5 layers has the most material, examples, and depth right now. Set only when the gate is met.",
    storage: "conversations.extraction_state.checkpoint_gate.strongest_layer",
    readers: [
      { where: "extraction.ts:541, 567 (formatExtractionForPersona)", what: "Names the target layer in Jove's brief; surfaces existing entries on that layer" },
    ],
    gates: "Tells composer which layer to deepen on when the checkpoint fires (indirect, via the brief).",
  },

  // ── Phase ──────────────────────────────────────────────────────────────
  {
    path: "pattern_engaged",
    type: "boolean (sticky)",
    category: "phase",
    loadBearing: "load-bearing",
    summary:
      "Jove named a pattern AND user engaged with it (not deflected). Sticky once true.",
    represents:
      "Whether Jove has named a pattern in conversation AND the user has engaged with it (elaborated, added an example, sat with it). Sticky once true unless the user explicitly rejects the pattern.",
    storage: "conversations.extraction_state.pattern_engaged",
    readers: [
      { where: "persona-pipeline.ts:432 (validateMaterialQuality)", what: "HARD GATE — checkpoint blocked unless engaged (overridable at turn ≥12)" },
      { where: "extraction.ts:616 (formatExtractionForPersona)", what: "Drives the 'phase hint' paragraph at the end of the brief" },
    ],
    gates: "Premature-checkpoint suppression. Without engagement, the conversation hasn't reached the 'we both see something' beat.",
    notes: "Best candidate for the Modal 2 ('halfway') firing anchor — corresponds to a real felt conversational moment.",
  },
  {
    path: "clinical_flag { active, level, note }",
    type: "object",
    category: "phase",
    loadBearing: "load-bearing",
    summary: "Safety signal. crisis = 988 protocol fires. caution = stay behavioral.",
    represents:
      "Safety signal. level ∈ {none, caution, crisis}. crisis = suicidal/harm intent (988 protocol fires). caution = diagnostic ask or distress exceeding manual scope.",
    storage: "conversations.extraction_state.clinical_flag",
    readers: [
      { where: "persona-pipeline.ts:424 (validateMaterialQuality)", what: "Crisis hard-blocks the checkpoint" },
      { where: "extraction.ts:530 (formatExtractionForPersona)", what: "Surfaces 'Safety note:' / 'Care note:' in Jove's brief ahead of any reflection" },
    ],
    gates: "Crisis override on every downstream surface — checkpoint, modals, prompt context.",
  },

  // ── Composer & brief ────────────────────────────────────────────────────
  {
    path: "language_bank[]",
    type: "array of { phrase, context, charge, layers }",
    category: "composer",
    loadBearing: "load-bearing",
    summary: "User's exact charged phrases (cumulative, capped at 15).",
    represents:
      "User's exact phrases that carry weight (sensory, somatic, masking, shutdown, system, bind language). Cumulative across the session, capped at 15 entries, oldest low-charge dropped first.",
    storage: "conversations.extraction_state.language_bank",
    readers: [
      { where: "confirm-checkpoint.ts (composeManualEntry)", what: "Top 10 high/medium-charge phrases passed into composer prompt verbatim" },
      { where: "extraction.ts:517 (formatExtractionForPersona)", what: "Top 15 charged entries listed in Jove's brief as 'phrases the user has used'" },
      { where: "call-persona.ts:609, persona-bridge.ts:200", what: "Pass-through into composeManualEntry from web + SMS paths" },
    ],
    gates: "Keeps the user's voice in their Manual. Without it, composer drifts into clinical-adjacent prose.",
  },
  {
    path: "sage_brief",
    type: "string (3-5 sentences)",
    category: "composer",
    loadBearing: "load-bearing",
    summary: "Jove's per-turn cheat-sheet — what's underneath, what to push on.",
    represents:
      "Short paragraph orienting Jove for the next turn — what's underneath the surface topic, which exact words are load-bearing, what's most charged, what to push on vs leave alone.",
    storage: "conversations.extraction_state.sage_brief",
    readers: [
      { where: "extraction.ts:500 (formatExtractionForPersona)", what: "Rendered verbatim at the top of Jove's brief block" },
      { where: "call-persona.ts:364", what: "Dev-only debug log (first 150 chars)" },
    ],
    gates: "Centerpiece of Jove's brief. Empty = Jove flies blind.",
  },
  {
    path: "emerging_pattern_snippet",
    type: "string (<15 words) | null",
    category: "composer",
    loadBearing: "load-bearing",
    summary: "Short phrase describing the forming pattern. Drives Modal 2.",
    represents:
      "Short phrase describing the forming pattern in behavioral/experiential terms. Regenerated each turn — never latched. Null when no clear pattern has emerged.",
    storage: "conversations.extraction_state.emerging_pattern_snippet",
    readers: [
      { where: "call-persona.ts:786 (SSE payload)", what: "Surfaced to client as emergingPatternSnippet" },
      { where: "MobileSession.tsx:868, 873 + PatternFormingModal:158", what: "Modal 2 firing + the snippet text rendered inside the modal" },
    ],
    gates: "Modal 2 ('halfway there') firing + displayed text.",
  },

  // ── Per-layer state ──────────────────────────────────────────────────────
  {
    path: "layers[1..5].signal",
    type: "'none' | 'emerging' | 'explored' | 'checkpoint_ready'",
    category: "layers",
    loadBearing: "load-bearing",
    summary: "Where each of the 5 layers is in its development (monotonic).",
    represents:
      "Where each layer is in its development. Monotonic — only advances. When a layer already has a confirmed entry, its signal starts at 'explored' minimum.",
    storage: "conversations.extraction_state.layers[N].signal",
    readers: [
      { where: "persona-pipeline.ts:500 (deriveCheckpointApproaching)", what: "Any layer ≥ 'explored' loads CHECKPOINTS instructions into Jove's prompt" },
      { where: "call-persona.ts:763 (SSE payload)", what: "Computes hasLayerEmergingOrBeyond (any signal !== 'none') for client" },
      { where: "extraction.ts:506 (formatExtractionForPersona)", what: "Per-layer status line in the brief" },
      { where: "MobileSession.tsx:866", what: "hasLayerEmergingOrBeyond gates Modal 2 firing" },
    ],
    gates: "'Is this turn a checkpoint moment?' upstream of validateMaterialQuality. Also gates Modal 2.",
  },
  {
    path: "layers[1..5].material",
    type: "string[]",
    category: "layers",
    loadBearing: "load-bearing",
    summary: "Specific observations attached to each layer (cumulative).",
    represents:
      "Specific observations attached to each layer. Cumulative — accumulates across the session.",
    storage: "conversations.extraction_state.layers[N].material",
    readers: [
      { where: "extraction.ts:506-508 (formatExtractionForPersona)", what: "Last 3 entries shown in the brief as 'recent observations'" },
    ],
    gates: "Indirect — feeds Jove's prompt context so depth carries across turns.",
  },
  {
    path: "layers[1..5].examples",
    type: "string[]",
    category: "layers",
    loadBearing: "auxiliary",
    summary: "Concrete moments tagged to layer. No direct downstream consumer.",
    represents:
      "Concrete moments the user narrated, tagged to layer. Distinct from material (which is Jove-side observations).",
    storage: "conversations.extraction_state.layers[N].examples",
    readers: [
      { where: "(extractor's own cumulative reasoning)", what: "Read by extractor next turn to avoid double-counting" },
    ],
    gates: "None directly. Count feeds concrete_examples, which is what surfaces.",
    notes: "Prune candidate — extractor-internal bookkeeping, no downstream reader.",
  },

  // ── Auxiliary signals ────────────────────────────────────────────────────
  {
    path: "depth",
    type: "enum (5 values)",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "Vertical position: surface → behavior → feeling → mechanism → origin.",
    represents:
      "Vertical position of the conversation — where it has descended to. surface → behavior → feeling → mechanism → origin.",
    storage: "conversations.extraction_state.depth",
    readers: [
      { where: "extraction.ts:609 (formatExtractionForPersona)", what: "One-line framing in the brief" },
      { where: "call-persona.ts:362", what: "Dev-only debug log" },
    ],
    gates: "None. Could be approximated from has_mechanism + has_behavior_driver_link.",
    notes: "Low cost to keep, low value to remove.",
  },
  {
    path: "mode",
    type: "'situation_led' | 'direct_exploration' | 'synthesis'",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "Extractor's stance recommendation. Derivable from entry count.",
    represents:
      "Extractor's recommendation for Jove's stance. situation_led is default; direct_exploration when ≥2 layers have entries; synthesis when all 5 do.",
    storage: "conversations.extraction_state.mode",
    readers: [
      { where: "extraction.ts:609 (formatExtractionForPersona)", what: "'Current approach: X' framing line in the brief" },
      { where: "call-persona.ts:363", what: "Dev-only debug log" },
    ],
    gates: "None.",
    notes:
      "Derivable from manualComponents.length. Distinct from conversations.mode (unrelated).",
  },
  {
    path: "current_thread",
    type: "string",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "One sentence: what the conversation is currently about.",
    represents:
      "One sentence describing what the conversation is actually about right now.",
    storage: "conversations.extraction_state.current_thread",
    readers: [
      { where: "extraction.ts:611 (formatExtractionForPersona)", what: "Single line in Jove's brief" },
    ],
    gates: "None.",
    notes: "Overlaps with sage_brief. Removing marginally shortens the prompt.",
  },
  {
    path: "observation_miss_count",
    type: "integer 0-3 (capped)",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "Consecutive observations the user pushed back on. Drives reset instructions.",
    represents:
      "How many consecutive Jove observations the user has pushed back on. Increments on rejection/redirect/withdraw; resets on confirm/elaborate. Capped at 3.",
    storage: "conversations.extraction_state.observation_miss_count",
    readers: [
      { where: "extraction.ts:493 (formatExtractionForPersona)", what: "Drives 'full reset' / 'pure grounding' instructions in brief when ≥2" },
    ],
    gates: "Soft control — at 3, Jove is told to drop observations.",
    notes:
      "Could be deterministic (count post-rejection system messages + short-answer streaks).",
  },
  {
    path: "user_named_cost",
    type: "boolean",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "Whether the user has named what the pattern costs them.",
    represents:
      "Whether the user has articulated, in their own words, what the pattern costs them.",
    storage: "conversations.extraction_state.user_named_cost",
    readers: [
      { where: "extraction.ts:625 (formatExtractionForPersona)", what: "Tail of brief: 'user named the cost' hint" },
    ],
    gates: "Informational hint only.",
  },
  {
    path: "user_named_stance",
    type: "boolean",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "Whether the user has expressed what they want now.",
    represents:
      "Whether the user has expressed what they want now that they can see the pattern (a request, decision, or honest incomplete).",
    storage: "conversations.extraction_state.user_named_stance",
    readers: [
      { where: "extraction.ts:625 (formatExtractionForPersona)", what: "Tail of brief: pairs with user_named_cost" },
    ],
    gates: "Informational hint only.",
  },
  {
    path: "next_prompt",
    type: "string (3-6 words, '…')",
    category: "auxiliary",
    loadBearing: "auxiliary",
    summary: "UI placeholder hint for the chat input field.",
    represents:
      "UI placeholder hint for the chat input field — what the user could say next, matched to current depth.",
    storage: "conversations.extraction_state.next_prompt",
    readers: [
      { where: "call-persona.ts:784 (SSE payload)", what: "Surfaced to client as nextPrompt" },
      { where: "MobileSession (chat input placeholder)", what: "Shown as ghost text in the input field" },
    ],
    gates: "Pure UI hint. Doesn't affect Jove's reasoning.",
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExtractionMapPage() {
  const isAdmin = useIsAdmin();
  const [stageIndex, setStageIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const stage = STAGES[stageIndex];

  // Which categories the current stage highlights. null = overview/worked-example
  // → no dimming (everything visible).
  const highlightedCategories: Set<CategoryId> | null = useMemo(() => {
    switch (stage.id) {
      case 2:
        return new Set<CategoryId>(["composer"]); // sage_brief is shown alone
      case 3:
        return new Set<CategoryId>(["gate"]);
      case 4:
        return new Set<CategoryId>(["phase"]);
      case 5:
        return new Set<CategoryId>(["composer"]);
      case 6:
        return new Set<CategoryId>(["layers"]);
      case 7:
        return new Set<CategoryId>(["auxiliary"]);
      default:
        return null;
    }
  }, [stage.id]);

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
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
              <Diagram
                stageId={stage.id}
                highlightedCategories={highlightedCategories}
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
                <Stepper
                  stageIndex={stageIndex}
                  setStageIndex={(i) => {
                    setStageIndex(i);
                    setSelection(null);
                  }}
                />
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
                  <StageCaption stage={stage} />
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
// Header + Stepper
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
        Jove&rsquo;s extraction of user messages
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "14.5px",
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 820,
        }}
      >
        What Jove&rsquo;s background extraction call produces every turn — {FIELDS.length} fields written into one JSON blob — and which parts of the system read each one. Step through the layers, then click any field to see its source, every place it&rsquo;s read, and what it gates.
      </p>
    </div>
  );
}

function Stepper({
  stageIndex,
  setStageIndex,
}: {
  stageIndex: number;
  setStageIndex: (i: number) => void;
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
        onClick={() => setStageIndex(Math.max(0, stageIndex - 1))}
        disabled={stageIndex === 0}
        aria-label="Previous stage"
        style={arrowBtnStyle(stageIndex === 0)}
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
        {STAGES.map((s, i) => {
          const active = i === stageIndex;
          const visited = i <= stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageIndex(i)}
              aria-label={`Stage ${s.id}: ${s.title}`}
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
        onClick={() => setStageIndex(Math.min(STAGES.length - 1, stageIndex + 1))}
        disabled={stageIndex === STAGES.length - 1}
        aria-label="Next stage"
        style={arrowBtnStyle(stageIndex === STAGES.length - 1)}
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
// Right column — stage caption or field detail
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
        Click any field card to inspect its storage, readers, and gating role.
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
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta)",
            textTransform: "uppercase",
          }}
        >
          {CATEGORY_LABEL[field.category]}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "1.2px",
              fontWeight: 500,
              padding: "2px 6px",
              borderRadius: 3,
              background:
                field.loadBearing === "load-bearing"
                  ? "var(--session-persona-muted)"
                  : "var(--session-walnut-tint)",
              color:
                field.loadBearing === "load-bearing"
                  ? "var(--session-persona)"
                  : "var(--session-ink-ghost)",
              border: `1px solid ${
                field.loadBearing === "load-bearing"
                  ? "var(--session-persona-border)"
                  : "var(--session-walnut-border-soft)"
              }`,
            }}
          >
            {field.loadBearing === "load-bearing" ? "LOAD-BEARING" : "AUXILIARY"}
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
          ← Back to stage
        </button>
      </div>

      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          color: "var(--session-ink)",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {field.path}
      </code>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--session-ink-soft)",
        }}
      >
        {field.type}
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.6,
          color: "var(--session-ink)",
        }}
      >
        {field.represents}
      </p>

      <DetailSection title="Stored at">
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
      </DetailSection>

      <DetailSection title={`Readers (${field.readers.length})`}>
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
            None. No downstream code reads this — pure prune candidate.
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
      </DetailSection>

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
    </>
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
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reading guide — vocabulary primer
// ---------------------------------------------------------------------------

const READING_GUIDE: { term: string; def: string }[] = [
  { term: "extraction_state", def: "JSONB column on conversations. Where the extractor writes; where the next turn's prompt reads." },
  { term: "JSONB", def: "A flexible JSON column. Schema lives inside the value, not the table." },
  { term: "sage_brief", def: "Jove's per-turn cheat sheet — 3-5 sentences. Empty = Jove flies blind." },
  { term: "checkpoint", def: "Moment when Jove proposes a Manual entry. The gate decides if it can fire." },
  { term: "pattern_engaged", def: "Sticky flag — Jove named a pattern AND the user engaged with it. Hard gate on checkpoints." },
  { term: "load-bearing", def: "Has at least one downstream reader (vs auxiliary, which exists but no consumer reads it)." },
];

function ReadingGuide() {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
        border: "1px dashed var(--session-walnut-border-soft)",
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
        Reading guide
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 14,
          rowGap: 4,
        }}
      >
        {READING_GUIDE.map((g) => (
          <Fragment key={g.term}>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--session-ink)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {g.term}
            </code>
            <span
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 12.5,
                color: "var(--session-ink-soft)",
                lineHeight: 1.4,
              }}
            >
              {g.def}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

function Diagram({
  stageId,
  highlightedCategories,
  selection,
  onSelect,
}: {
  stageId: number;
  highlightedCategories: Set<CategoryId> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (stageId === 8) {
    return (
      <>
        <ReadingGuide />
        <WorkedExampleFooter />
      </>
    );
  }

  // Stage 2 is the brief deep-dive — show sage_brief as a hero card on its own
  // with the rest dimmed.
  if (stageId === 2) {
    const sageBrief = FIELDS.find((f) => f.path === "sage_brief")!;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <ReadingGuide />
        <HeroFieldCard
          field={sageBrief}
          selected={
            selection?.kind === "field" && selection.path === sageBrief.path
          }
          onClick={() => onSelect({ kind: "field", path: sageBrief.path })}
        />
        <CategoryGroups
          highlightedCategories={null}
          dimmed
          selection={selection}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ReadingGuide />
      <CategoryGroups
        highlightedCategories={highlightedCategories}
        dimmed={false}
        selection={selection}
        onSelect={onSelect}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryGroups — five groups stacked vertically. Each group is a panel
// of field cards; opacity drops when category isn't in the highlighted set.
// ---------------------------------------------------------------------------

function CategoryGroups({
  highlightedCategories,
  dimmed,
  selection,
  onSelect,
}: {
  highlightedCategories: Set<CategoryId> | null;
  dimmed: boolean;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const groups: { category: CategoryId; fields: Field[] }[] = [
    { category: "gate", fields: FIELDS.filter((f) => f.category === "gate") },
    { category: "phase", fields: FIELDS.filter((f) => f.category === "phase") },
    { category: "composer", fields: FIELDS.filter((f) => f.category === "composer") },
    { category: "layers", fields: FIELDS.filter((f) => f.category === "layers") },
    { category: "auxiliary", fields: FIELDS.filter((f) => f.category === "auxiliary") },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g) => {
        const isHighlighted =
          !dimmed && (!highlightedCategories || highlightedCategories.has(g.category));
        return (
          <div
            key={g.category}
            style={{
              opacity: isHighlighted ? 1 : 0.3,
              transition: "opacity 220ms ease",
              padding: 12,
              borderRadius: 8,
              background: isHighlighted
                ? "var(--session-walnut-tint)"
                : "transparent",
              border: `1px solid ${
                isHighlighted
                  ? "var(--session-walnut-border-soft)"
                  : "var(--session-walnut-border-soft)"
              }`,
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
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "1.5px",
                  color: "var(--session-walnut-meta)",
                  textTransform: "uppercase",
                }}
              >
                {CATEGORY_LABEL[g.category]}
                <span
                  style={{
                    marginLeft: 6,
                    color: "var(--session-ink-ghost)",
                    fontWeight: 400,
                  }}
                >
                  {g.fields.length}
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
                {g.fields.filter((f) => f.loadBearing === "load-bearing").length} load-bearing
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 6,
              }}
            >
              {g.fields.map((f) => (
                <FieldCard
                  key={f.path}
                  field={f}
                  selected={
                    selection?.kind === "field" && selection.path === f.path
                  }
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
// Field card — small clickable cell
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
        padding: "8px 10px",
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
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 3,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--session-ink)",
            wordBreak: "break-word",
          }}
        >
          {field.path}
        </code>
        {field.loadBearing === "auxiliary" && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.5px",
              color: "var(--session-ink-ghost)",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            aux
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12,
          fontStyle: "italic",
          color: "var(--session-ink-soft)",
          lineHeight: 1.35,
        }}
      >
        {field.summary}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 hero card — sage_brief gets its own moment
// ---------------------------------------------------------------------------

function HeroFieldCard({
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
        padding: 18,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-walnut-border)",
        borderRadius: 10,
        boxShadow: selected ? SELECTED_RING : "none",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        The brief · {field.type}
      </div>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 24,
          fontWeight: 500,
          color: "var(--session-ink)",
          display: "block",
          marginBottom: 10,
        }}
      >
        {field.path}
      </code>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        {field.represents}
      </p>
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--session-ink-ghost)",
          letterSpacing: "0.5px",
        }}
      >
        {field.readers.length} readers · {field.gates}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Worked example footer
// ---------------------------------------------------------------------------

function WorkedExampleFooter() {
  const total = FIELDS.length;
  const loadBearing = FIELDS.filter((f) => f.loadBearing === "load-bearing").length;
  const auxiliary = FIELDS.filter((f) => f.loadBearing === "auxiliary").length;
  const totalReaders = FIELDS.reduce((s, f) => s + f.readers.length, 0);
  const pruneCandidates = FIELDS.filter(
    (f) => f.notes?.toLowerCase().includes("prune candidate") || f.readers.length === 0,
  ).length;
  const categoryCounts: { category: CategoryId; count: number }[] = (
    ["gate", "phase", "composer", "layers", "auxiliary"] as CategoryId[]
  ).map((c) => ({
    category: c,
    count: FIELDS.filter((f) => f.category === c).length,
  }));

  const categoryColors: Record<CategoryId, string> = {
    gate: "var(--session-walnut-surface)",
    phase: "var(--session-warning-soft)",
    composer: "var(--session-walnut-surface-soft)",
    layers: "var(--session-persona-muted)",
    auxiliary: "var(--session-walnut-tint)",
  };

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
      oneLine: "Inputs to the validateMaterialQuality check before composing.",
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
      oneLine: "Drives the in-conversation modals (Modal 2 / halfway-there).",
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
        marginTop: 18,
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
        Extraction by the numbers
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <HeroStat value={total} label="Fields" />
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
        Fields by category
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
        {categoryCounts.map((c) => (
          <div
            key={c.category}
            style={{
              flexGrow: c.count,
              background: categoryColors[c.category],
              minWidth: 0,
            }}
            title={`${CATEGORY_LABEL[c.category]}: ${c.count}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        {categoryCounts.map((c) => (
          <div
            key={c.category}
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
                background: categoryColors[c.category],
                border: "1px solid var(--session-walnut-border-soft)",
                display: "inline-block",
              }}
            />
            {CATEGORY_LABEL[c.category]}
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
        Where the fields land
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
        Counts derived from the readers array on each field — when a field is
        wired into a new consumer, update its readers in this file and the
        destination totals recompute automatically.
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
