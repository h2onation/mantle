"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Extraction consumer map.
//
// Static documentation page. The extraction Sonnet call (src/lib/persona/
// extraction.ts) produces a single JSON blob every turn. This page traces
// each field to its downstream consumers, with progressive disclosure so the
// page is scannable on first glance and drillable on demand.
//
// Edit the FIELDS array below if the underlying code shifts (new readers,
// removed readers, field renames). Line numbers are best-effort hints.
// ---------------------------------------------------------------------------

type LoadBearing = "load-bearing" | "auxiliary";
type CategoryId = "gate" | "phase" | "composer" | "layers" | "auxiliary";

interface Field {
  path: string;
  type: string;
  category: CategoryId;
  loadBearing: LoadBearing;
  summary: string;        // one-line, shown collapsed
  represents: string;     // longer paragraph, shown expanded
  storage: string;
  readers: { where: string; what: string }[];
  gates: string;
  notes?: string;
}

interface Category {
  id: CategoryId;
  title: string;
  oneLine: string;        // one-line description used as filter-chip subtitle
}

const CATEGORIES: Category[] = [
  { id: "gate",      title: "Gate",      oneLine: "Five fields that decide whether a checkpoint can fire." },
  { id: "phase",     title: "Phase",     oneLine: "Where the conversation is + safety override." },
  { id: "composer",  title: "Composer",  oneLine: "Inputs to the manual-entry composer and Jove's brief." },
  { id: "layers",    title: "Layers",    oneLine: "Per-layer state across the five-layer model." },
  { id: "auxiliary", title: "Auxiliary", oneLine: "Telemetry, brief framing copy, UI hints. Prune candidates." },
];

const FIELDS: Field[] = [
  // ── Gate ───────────────────────────────────────────────────────────────
  {
    path: "checkpoint_gate.concrete_examples",
    type: "number",
    category: "gate",
    loadBearing: "load-bearing",
    summary: "Count of scenes the user has walked through (moments within one incident count separately).",
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
    summary: "Count of *different* situations narrated (not moments inside one situation).",
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
    summary: "Jove named a pattern AND user engaged with it (not deflected). Sticky once true.",
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
    notes: "Derivable from manualComponents.length. Distinct from conversations.mode (unrelated).",
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
    notes: "Could be deterministic (count post-rejection system messages + short-answer streaks).",
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FilterKey = "all" | "load-bearing" | CategoryId;

export default function ExtractionMapPage() {
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    if (filter === "all") return FIELDS;
    if (filter === "load-bearing")
      return FIELDS.filter((f) => f.loadBearing === "load-bearing");
    return FIELDS.filter((f) => f.category === filter);
  }, [filter]);

  const counts = useMemo(() => {
    const byCat = new Map<CategoryId, number>();
    for (const f of FIELDS) byCat.set(f.category, (byCat.get(f.category) ?? 0) + 1);
    return {
      total: FIELDS.length,
      loadBearing: FIELDS.filter((f) => f.loadBearing === "load-bearing").length,
      auxiliary: FIELDS.filter((f) => f.loadBearing === "auxiliary").length,
      byCat,
    };
  }, []);

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
          {/* Header strip */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "18px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
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
              Extraction consumer map
            </div>
            <div
              style={{
                width: 1,
                height: 22,
                background: "var(--session-ink-hairline)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
              }}
            >
              {counts.total} fields · {counts.loadBearing} load-bearing · {counts.auxiliary} auxiliary
            </span>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 32px 80px",
            }}
          >
            <FlowDiagram />

            <FilterChips
              filter={filter}
              setFilter={setFilter}
              counts={counts}
            />

            <FieldList
              fields={filteredFields}
              expandedPath={expandedPath}
              setExpandedPath={setExpandedPath}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top: flow diagram (text-based, no SVG)
// ---------------------------------------------------------------------------

function FlowDiagram() {
  const destinations: { label: string; sub: string }[] = [
    { label: "Checkpoint gate",       sub: "Can a checkpoint fire?" },
    { label: "Jove's brief",          sub: "3-5 sentence per-turn orientation" },
    { label: "Composer",              sub: "How the Manual entry reads" },
    { label: "Modals",                sub: "Halfway-there + others" },
    { label: "Chat input",            sub: "Placeholder text" },
  ];
  return (
    <div
      style={{
        marginBottom: 28,
        padding: "20px 22px",
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 10,
      }}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "15px",
          lineHeight: 1.55,
          color: "var(--session-ink)",
        }}
      >
        Every turn, a background Sonnet call reads the conversation and writes
        one JSON blob to{" "}
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--session-ink)",
            background: "var(--session-walnut-surface-soft)",
            padding: "1px 6px",
            borderRadius: 3,
          }}
        >
          conversations.extraction_state
        </code>
        . That blob feeds five downstream surfaces:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        {destinations.map((d) => (
          <div
            key={d.label}
            style={{
              padding: "10px 12px",
              background: "var(--session-linen)",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
                marginBottom: 4,
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "13.5px",
                lineHeight: 1.4,
                color: "var(--session-ink-soft)",
              }}
            >
              {d.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function FilterChips({
  filter,
  setFilter,
  counts,
}: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  counts: { total: number; loadBearing: number; byCat: Map<CategoryId, number> };
}) {
  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all",          label: "All",          count: counts.total },
    { key: "load-bearing", label: "Load-bearing", count: counts.loadBearing },
    ...CATEGORIES.map((c) => ({
      key: c.id as FilterKey,
      label: c.title,
      count: counts.byCat.get(c.id) ?? 0,
    })),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 18,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "1.5px",
          color: "var(--session-ink-ghost)",
          marginRight: 4,
        }}
      >
        FILTER
      </span>
      {chips.map((c) => {
        const active = filter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "5px 11px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              letterSpacing: "0.1px",
              color: active ? "var(--session-ink)" : "var(--session-ink-soft)",
              background: active
                ? "var(--session-walnut-highlight)"
                : "var(--session-walnut-tint)",
              border: active
                ? "1px solid var(--session-walnut-border)"
                : "1px solid var(--session-ink-hairline)",
              fontWeight: active ? 500 : 400,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{c.label}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--session-ink-ghost)",
                fontWeight: 400,
              }}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field list — compact rows, expandable
// ---------------------------------------------------------------------------

function FieldList({
  fields,
  expandedPath,
  setExpandedPath,
}: {
  fields: Field[];
  expandedPath: string | null;
  setExpandedPath: (p: string | null) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
        overflow: "hidden",
      }}
    >
      {fields.map((f, i) => (
        <FieldRow
          key={f.path}
          field={f}
          expanded={expandedPath === f.path}
          onToggle={() =>
            setExpandedPath(expandedPath === f.path ? null : f.path)
          }
          isLast={i === fields.length - 1}
        />
      ))}
      {fields.length === 0 && (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.5px",
          }}
        >
          No fields match this filter.
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  expanded,
  onToggle,
  isLast,
}: {
  field: Field;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const lb = field.loadBearing === "load-bearing";
  const dotColor = lb ? "var(--session-walnut, #6e3a1e)" : "var(--session-ink-ghost)";

  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--session-ink-hairline)",
        background: expanded ? "var(--session-walnut-surface-soft)" : "transparent",
      }}
    >
      {/* Collapsed row — always rendered, full-width clickable */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 14,
          alignItems: "center",
          padding: "12px 16px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Load-bearing dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: dotColor,
            opacity: lb ? 1 : 0.45,
            flexShrink: 0,
          }}
          aria-label={lb ? "load-bearing" : "auxiliary"}
        />

        {/* Name + summary */}
        <div style={{ minWidth: 0 }}>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13.5px",
              color: "var(--session-ink)",
              fontWeight: 500,
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {field.path}
          </code>
          <div
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "13.5px",
              lineHeight: 1.4,
              color: "var(--session-ink-soft)",
              marginTop: 2,
            }}
          >
            {field.summary}
          </div>
        </div>

        {/* Chevron */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && <FieldDetail field={field} />}
    </div>
  );
}

function FieldDetail({ field }: { field: Field }) {
  return (
    <div
      style={{
        padding: "0 16px 18px 38px", // align with summary text under the dot
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
        columnGap: 14,
        rowGap: 10,
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        lineHeight: 1.55,
        color: "var(--session-ink-soft)",
        borderTop: "1px solid var(--session-walnut-border-soft)",
        paddingTop: 14,
        marginTop: 0,
      }}
    >
      <span style={{ color: "var(--session-ink-ghost)" }}>Type</span>
      <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        {field.type}
      </code>

      <span style={{ color: "var(--session-ink-ghost)" }}>What it is</span>
      <span style={{ color: "var(--session-ink)" }}>{field.represents}</span>

      <span style={{ color: "var(--session-ink-ghost)" }}>Storage</span>
      <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        {field.storage}
      </code>

      <span style={{ color: "var(--session-ink-ghost)" }}>Readers</span>
      <ul
        style={{
          margin: 0,
          paddingLeft: 16,
          listStyle: "disc",
        }}
      >
        {field.readers.map((r, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--session-ink)",
              }}
            >
              {r.where}
            </code>{" "}
            <span style={{ color: "var(--session-ink-soft)" }}>— {r.what}</span>
          </li>
        ))}
      </ul>

      <span style={{ color: "var(--session-ink-ghost)" }}>Gates</span>
      <span>{field.gates}</span>

      {field.notes && (
        <>
          <span style={{ color: "var(--session-ink-ghost)" }}>Note</span>
          <span style={{ fontStyle: "italic", color: "var(--session-ink-soft)" }}>
            {field.notes}
          </span>
        </>
      )}
    </div>
  );
}
