"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Extraction map — "one call, two consumers."
//
// A background Sonnet call ("extraction") reads each turn and writes a single
// JSON case file (conversations.extraction_state). Nothing renders it into
// Jove's live turns — the per-turn brief (formatExtractionForPersona) was
// retired 2026-07-02. Under the pull model (the Jove-pushed checkpoint gate was
// removed 2026-07-03), the case file now does exactly two jobs: it drives the
// REFLECTION METER (the deterministic capture surface — how full the "reflection
// ready" bar is, and when a crisis hides it) and it feeds the save-time COMPOSER
// (the Opus call that writes the entry once the USER taps to capture). A small
// set of raw notes — above all the user's exact words — feed both jobs.
//
// Readiness itself is NOT in this file: the meter's "ready" latch is Jove's own
// published ---reflection-ready--- marker, not an extraction field.
//
// This page is organized around that frame: a front door, a lifecycle
// walkthrough, and a field-by-field map tagged by which job each note serves.
//
// FIELDS data is hand-curated — when extraction.ts changes the JSON shape,
// this file needs to follow.
// ---------------------------------------------------------------------------

type LoadBearing = "load-bearing" | "auxiliary";

// What job each note does in the "two consumers" frame.
//   meter    — deterministic input to the reflection meter (fill, crisis-hide).
//   compose  — feeds the save-time Manual-entry composer (composeManualEntry).
//   material — raw notes both jobs draw from (above all the user's words).
type JobId = "meter" | "compose" | "material";

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
  meter: {
    label: "Drives the reflection meter",
    tag: "shows",
    tone: "hard",
    blurb:
      "Deterministic inputs to the pull-model capture surface — how full the “reflection ready” bar is (depth) and when a crisis hides it entirely. This is what the user sees; readiness itself is Jove's own signal, not a field here.",
  },
  compose: {
    label: "Composes the entry",
    tag: "writes",
    tone: "soft",
    blurb:
      "Feeds the save-time composer that writes the Manual entry once the user taps to capture — the user's exact words, the depth reached, whether the scene recurs. It shapes the entry's prose, not Jove's live turns.",
  },
  material: {
    label: "Raw material",
    tag: "raw",
    tone: "both",
    blurb:
      "The user's exact words, captured verbatim. The composer quotes the language bank straight into every entry — nothing here is summarized or derived. It's the heart of the system.",
  },
};

const JOB_ORDER: JobId[] = ["meter", "compose", "material"];

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
      "The call writes one JSON blob — the case file — to conversations.extraction_state. Every note is color-coded here by the job it does. Most either drive the reflection meter or feed the save-time composer; a few are raw material both draw from. Click any note to see what it means, who reads it, and whether anything breaks if you remove it.",
  },
  {
    id: 3,
    title: "Job 1 · Composes the entry",
    caption:
      "The soft job. When the user taps to capture, these notes are handed to the save-time composer — the Opus call that writes the actual Manual entry. The user's exact words, the depth the conversation reached, whether the scene recurs, a one-line orientation of what's underneath. They shape the entry's prose. Nothing here touches Jove's live turns — the per-turn brief was retired in 2026.",
  },
  {
    id: 4,
    title: "Job 2 · Drives the reflection meter",
    caption:
      "The deterministic job. Under the pull model, the user captures — Jove never proposes. These notes drive the “reflection ready” meter the user sees: depth sets how full the bar is, and a crisis flag hides the meter entirely so no one in crisis is nudged to capture. The one thing NOT here is readiness — the meter's “ready” latch is Jove's own published signal, not an extraction field.",
  },
  {
    id: 5,
    title: "The raw material",
    caption:
      "The user's own words. The language bank — the exact charged phrases — is the center of gravity: it keeps the composed entry quoting the user instead of paraphrasing them into a stranger. Everything the composer writes is anchored to these words. (Depth is the one note read on both sides — it fills the meter and tells the composer how far down the conversation reached — so it lives with the meter above.)",
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
      return new Set<JobId>(["compose"]);
    case 4:
      return new Set<JobId>(["meter"]);
    case 5:
      return new Set<JobId>(["material"]);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// FIELDS — every note the extraction Sonnet call writes. Hand-curated to
// track extraction.ts; the readers are real call sites you can grep.
// ---------------------------------------------------------------------------

const FIELDS: Field[] = [
  // ── Drives the reflection meter (deterministic) ────────────────────────
  {
    path: "depth",
    type: "enum (5 values)",
    job: "meter",
    loadBearing: "load-bearing",
    summary: "How far down it's gone: surface → behavior → feeling → mechanism → origin.",
    represents:
      "Vertical position of the conversation — where it has descended to. surface → behavior → feeling → mechanism → origin. The one note read on both sides: it fills the meter AND tells the composer how far the conversation reached.",
    storage: "conversations.extraction_state.depth",
    readers: [
      { where: "persona-pipeline.ts:749 (reflectionMeterFill)", what: "Sets the meter FILL — each depth level maps to a % (REFLECTION_DEPTH_PCT), so a deeper conversation shows a fuller bar. Resolved by resolveReflectionMeter, shared by the live SSE emit (call-persona) and the reload-restore route (checkpoint/meter) so the two can't drift" },
      { where: "checkpoint/compose/route.ts:127 → composeManualEntry", what: "Carried into the save-time composer so the entry is written from the depth the whole conversation reached, not just the last few messages" },
      { where: "call-persona.ts:549 (dev debug log)", what: "Dev-only turn/depth console line; not a production reader" },
    ],
    gates: "Fills the reflection meter (depth → % via REFLECTION_DEPTH_PCT) and doubles as a composer input. The shared note between the two jobs.",
  },
  {
    path: "clinical_flag { active, level, note }",
    type: "object",
    job: "meter",
    loadBearing: "load-bearing",
    summary: "Safety signal. A crisis level hides the reflection meter.",
    represents:
      "Safety signal. level ∈ {none, caution, crisis}. Extraction sets it when the user introduces diagnostic asks (caution) or expresses suicidal / harm intent (crisis).",
    storage: "conversations.extraction_state.clinical_flag",
    readers: [
      { where: "persona-pipeline.ts:785 (resolveReflectionMeter)", what: "A crisis flag HIDES the meter (returns null) and clears any latched readiness — a user in crisis is never nudged to capture" },
    ],
    gates: "Crisis override on the capture surface — hides the reflection meter so no one in crisis is nudged to build an entry.",
    notes: "The 988 response is NOT driven by this flag: handleCrisisDetection scans the user's message for crisis language independently (persona-pipeline.ts). This flag's only verified reader is the meter-hide, so the 'caution' level currently has no consumer — a prune candidate to revisit.",
  },

  // ── Composes the entry (save-time) ─────────────────────────────────────
  {
    path: "sage_brief",
    type: "string (3-5 sentences)",
    job: "compose",
    loadBearing: "load-bearing",
    summary: "The composer's orientation — what's underneath, which words are load-bearing.",
    represents:
      "Short paragraph orienting the composer — what's underneath the surface topic, which of the user's exact words are load-bearing, what's most charged. Written every turn; consumed only when the user pulls a reflection and the entry is composed.",
    storage: "conversations.extraction_state.sage_brief",
    readers: [
      { where: "checkpoint/compose/route.ts:128 → composeManualEntry", what: "Passed to the save-time composer as orientation for the entry's prose (the session's accumulated read, in the user's words)" },
      { where: "call-persona.ts:550 (dev debug log)", what: "Dev-only 'Brief:' console line (first 150 chars)" },
      { where: "components/admin/ExtractionPanel.tsx", what: "Rendered in the admin extraction-snapshot panel (debug UI)" },
    ],
    gates: "The composer's orientation note. Empty = the entry is written from the transcript alone.",
    notes: "Named sage_brief for historical reasons (the persona was once 'Sage') and dates from when it fed a per-turn brief; that brief was retired 2026-07-02 and it now feeds only the save-time composer.",
  },
  {
    path: "current_thread",
    type: "string",
    job: "compose",
    loadBearing: "auxiliary",
    summary: "One sentence: what the conversation is actually about right now.",
    represents:
      "One sentence describing what the conversation is actually about right now.",
    storage: "conversations.extraction_state.current_thread",
    readers: [
      { where: "checkpoint/compose/route.ts:129 → composeManualEntry", what: "Passed to the composer as the one-line 'what this is actually about' anchor" },
    ],
    gates: "Minor composer input — a one-line anchor. Overlaps with sage_brief.",
    notes: "Overlaps with sage_brief. Removing it marginally shortens the composer prompt.",
  },
  {
    path: "checkpoint_gate.distinct_contexts",
    type: "number (optional, recent)",
    job: "compose",
    loadBearing: "load-bearing",
    summary: "How many *different* situations — not moments inside one.",
    represents:
      "Count of DIFFERENT situations / events / time-periods the user has narrated. Four moments in one phone call = 1 distinct context, not 4. The last survivor of the old checkpoint_gate object — the gate is gone; only this field remains, and it feeds the composer.",
    storage: "conversations.extraction_state.checkpoint_gate.distinct_contexts",
    readers: [
      { where: "checkpoint/compose/route.ts:126 → composeManualEntry", what: "Plumbed into the composer — feeds validateHeadline's can/sometimes hedge so a single-scene entry doesn't over-claim a recurring pattern" },
    ],
    gates: "Not a gate (there is no gate). Strengthens the composed entry — feeds validateHeadline's can/sometimes hedge for single-scene entries (confirm-checkpoint.ts). A single vivid scene in the user's charged language is still saveable.",
    notes: "Still nested under a `checkpoint_gate` key for storage-shape stability, but that container is now vestigial — this is its only field.",
  },
  // ── Raw material ───────────────────────────────────────────────────────
  {
    path: "language_bank[]",
    type: "array of { phrase, context, charge, layers }",
    job: "material",
    loadBearing: "load-bearing",
    summary: "The user's exact charged phrases — the heart of the system.",
    represents:
      "User's exact phrases that carry weight (sensory, somatic, masking, shutdown, system, bind language). Cumulative across the session; high/medium phrases kept, low-charge capped and aged out oldest-first. Quoted verbatim into the composed entry so the Manual stays in the user's own voice.",
    storage: "conversations.extraction_state.language_bank",
    readers: [
      { where: "checkpoint/compose/route.ts:124 → composeManualEntry", what: "Top high/medium-charge phrases passed into the save-time composer verbatim — the entry quotes the user rather than paraphrasing" },
    ],
    gates: "Keeps the user's voice in their Manual. Without it, the composer drifts into clinical-adjacent prose.",
    notes: "Once also fed the deterministic checkpoint gate's charged-language check; that gate was removed 2026-07-03, so the composer is now its only reader.",
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
        notes that drive the &ldquo;reflection ready&rdquo; meter the user sees
        (how deep the talk has gone) and, when the user taps to capture, get
        woven into the Manual entry itself. Nothing here renders into
        Jove&rsquo;s live turns. This page maps every note: what it&rsquo;s for,
        who reads it, and whether anything breaks if you remove it. Use it to see
        what the extractor tracks, and to spot notes nothing reads.
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
        ↳ See the prompt this feeds around — Tuning →
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
            of two jobs — driving the reflection meter or composing the entry —
            over a base of the user&rsquo;s raw words.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FrontDoorJob job="meter" onJump={() => onJump(3)} />
            <FrontDoorJob job="compose" onJump={() => onJump(2)} />

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
                <strong style={{ fontWeight: 600 }}>And the raw material underneath.</strong>{" "}
                The user&rsquo;s exact words — the language bank — get quoted
                straight into every composed entry. It&rsquo;s the heart of the
                system.
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
          {job === "compose" ? "soft" : "hard"}
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
          {node("Reflection meter", "Depth fills the bar; crisis hides it.", "hard")}
        </div>
        <div style={{ height: 6 }} />
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          <div style={{ flex: 1 }} />
          {arrow("feeds")}
          {node("Composes the entry", "Writes the Manual entry when the user taps to capture.", "soft")}
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
        because the call isn&rsquo;t waited on, the notes that set this turn&rsquo;s
        meter are the ones written <em>last</em> turn. On purpose — Jove never
        stalls, and a continuous conversation barely notices the delay.
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
      label: "Reflection meter",
      count: FIELDS.filter((f) =>
        f.readers.some(
          (r) =>
            r.where.includes("reflectionMeterFill") ||
            r.where.includes("resolveReflectionMeter"),
        ),
      ).length,
      oneLine: "Inputs to the pull-model capture surface — meter fill and crisis-hide.",
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
