"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import type {
  PhaseData,
  PromptSection,
} from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import { togglePersonaMode } from "@/lib/persona/persona-mode-toggle";
import type { ConversationMode } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Under the hood — guided walkthrough of how Jove's prompt is assembled.
//
// Data source: /api/admin/prompt-architecture. Sections, source paths, real
// token counts, and actual rendered text all come from the live codebase
// via parsePromptSections. Anything the page describes traces back to a
// real export — no hand-curated metadata drift.
// ---------------------------------------------------------------------------

interface Step {
  id: number;
  title: string;
  caption: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "The whole prompt",
    caption:
      "Every user message triggers one Anthropic call. The system prompt below is what Jove sees. ~7,000 tokens on a normal turn. These first six steps group the prompt by how often each part changes — which is why Tier 2's voice shows up in two of them.",
  },
  {
    id: 2,
    title: "The static prefix (always-on)",
    caption:
      "Identity, Tier 1 constitutional rules, and the base voice scaffold. Identical across every user, every turn. Cached forever.",
  },
  {
    id: 3,
    title: "The persona delta (one of four)",
    caption:
      "Trait-specific voice rules layered on top of the base. Selected at signup from autistic / ADHD / dyslexic / general. Click a pill to switch the active persona — the rest of the diagram re-renders from the live prompt.",
  },
  {
    id: 4,
    title: "The mode opener (one of three)",
    caption:
      "Entry-phase block by input mode (Situation / Guided Intake / Upload). Selected at conversation start. Click a pill to switch the active mode.",
  },
  {
    id: 5,
    title: "The conditional Tier-3 blocks",
    caption:
      "Tier 3 blocks that fire based on conversation state (first turn, returning user, approaching checkpoint, clinical material, etc.). Rebuilt each turn.",
  },
  {
    id: 6,
    title: "The live context (parallel)",
    caption:
      "Dynamic blocks appended at runtime: confirmed Manual entries (compressed), session context, extraction brief from the parallel Sonnet call. Rebuilt each turn.",
  },
  {
    id: 7,
    title: "Alongside — what travels with the prompt",
    caption:
      "The system prompt isn't sent alone. The same Anthropic call carries the user's just-sent message, the full conversation history (with a sliding window once it gets long), any synthetic system messages from confirm/reject/refine actions, and a cache_control marker telling Anthropic where the cache boundary sits.",
  },
  {
    id: 8,
    title: "Sibling calls — the other AI calls this turn",
    caption:
      "Jove is one of three model calls that fire on every turn — Jove (Sonnet), Extraction (Sonnet), and the shadow Monitor (Opus, whose output nothing reads). The Composer (Opus) is a fourth model call, but it fires only on checkpoint turns, composing at proposal time. The detector that flags a checkpoint is a deterministic regex, not a model call.",
  },
  {
    id: 9,
    title: "Cache view — what's reused vs rebuilt",
    caption:
      "Static prefix + persona-keyed parts are cached. The conditional and dynamic layers are rebuilt every turn. That's why a ~7,000-token prompt streams in 2–3 seconds.",
  },
  {
    id: 10,
    title: "Worked example — token budget by cache group",
    caption:
      "Token totals from the live prompt for the current persona × mode. Cached vs rebuilt percentages are computed from the actual section sizes.",
  },
];

const PERSONA_LABELS: Record<PersonaMode, string> = {
  autistic: "Autistic",
  adhd: "ADHD",
  dyslexic: "Dyslexic",
  general: "General",
};

const MODE_LABELS: Record<ConversationMode, string> = {
  situation: "Situation",
  "guided-intake": "Guided",
  upload: "Upload",
};

const PERSONAS: PersonaMode[] = ["autistic", "adhd", "dyslexic", "general"];
const MODES: ConversationMode[] = ["situation", "guided-intake", "upload"];

// Mirrors composeTier2's "effective modes" rule: empty → general; any neurotype
// drops general (it's a fallback only). Used wherever the page shows the active
// persona as a single label — now a stacked label like "Autistic + ADHD".
function personaLabel(modes: PersonaMode[]): string {
  const requested = modes.length > 0 ? modes : (["general"] as PersonaMode[]);
  const neuro = requested.filter((m) => m !== "general");
  const effective = neuro.length > 0 ? neuro : requested;
  return effective.map((m) => PERSONA_LABELS[m]).join(" + ");
}

// Section ids surfaced as Tier 3 mode-opener pills (vs the bigger conditional ladder).
const MODE_OPENER_IDS = new Set<string>(["guided-intake", "upload-mode"]);

// Section ids that compose the always-on base voice (Tier 2, condition === "always").
// Persona-conditioned Tier 2 sections (voice-rules, example-register, etc.) get
// surfaced under "persona delta" since the user perceives them as varying.
const BASE_VOICE_IDS = new Set<string>([
  "tier2-voice",
  "banned-phrases",
  "pacing",
  "when-wrong",
  "advisory",
]);

// Spine bands collapse Tier 1 (intro + constitutional rules) and the always-on
// Tier 2 base voice into one band each — the sub-section headers stay visible
// inside the band, and the full breakdown shows on click. Mirrors the real
// cache blocks (buildSystemPromptBlocks bundles intro + Tier 1 into one block).
const SPINE_GROUPS: { id: string; tier: "1" | "2"; label: string; sectionIds: string[] }[] = [
  { id: "tier1", tier: "1", label: "Tier 1 · Identity + Constitutional Rules", sectionIds: ["intro", "tier1"] },
  { id: "tier2-base", tier: "2", label: "Tier 2 · Base Voice", sectionIds: ["tier2-voice", "banned-phrases", "pacing", "when-wrong", "advisory"] },
];

// Plain-language descriptions for the live-context (dynamic) blocks, shown in
// the detail panel so an admin can't mistake the placeholder example text for
// shared prompt content.
const DYNAMIC_DESCRIPTIONS: Record<string, string> = {
  "extraction-brief":
    "The note Jove's parallel extraction call writes about the user's last message — the scene, the body words, whether a checkpoint is near. Generated fresh per user, every turn. Jove reads it; the user never sees it.",
  "confirmed-manual":
    "The user's recent confirmed Manual entries, in full prose, read from the database each turn.",
  "earlier-entries":
    "Older Manual entries compressed to one line each (headline + summary + key words) so Jove recognizes them without re-reading the full prose.",
  "session-context":
    "A session-history summary for a returning user — how many sessions they've had, and a short recap of the previous one. Read from the database.",
  "transcript-detected":
    "Fires only when the user pastes a transcript — tells Jove to read it as material, not as a message.",
  "exploration-focus":
    "Fires only when the user taps 'Explore with Jove' on a Manual entry or an empty layer.",
};

// How each live-context block operates — shown in the expandable detail so the
// box explains the mechanism first, then labels the illustrative sample beneath.
const DYNAMIC_OPERATION: Record<string, string> = {
  "extraction-brief":
    "Every turn, the extraction call — a separate Sonnet request running in parallel with Jove — reads the user's latest message and writes a short brief. It is injected under the header \"── BRIEF FOR YOUR NEXT RESPONSE ──\", refreshed each turn, and overwritten the next. Because it runs in parallel, the brief reaches Jove one turn later (the one-turn lag).\n\nIn scope: the concrete scene the user described, their body and sensory words, the bind taking shape (what a pattern protects and what it costs), charged language, which Manual layer the material points to, and whether there is enough to propose a checkpoint.\n\nOut of scope: it does not decide Jove's reply or wording (advisory only — a research note, not a script); it never writes to the Manual (the checkpoint composer does that, and only after the user confirms); it is not shown to the user; and it lags one turn, so Jove trusts the live conversation over a stale brief.",
  "confirmed-manual":
    "Each turn, the prompt builder reads the user's confirmed Manual entries from the database. The recent ones (everything from the current conversation, plus a backfill up to 4 of the most recent overall) are pasted in full, under the header \"CONFIRMED MANUAL\", so Jove can quote them precisely. Rebuilt every turn from current data.",
  "earlier-entries":
    "Older entries beyond the recent four collapse to one line each — [Layer N — Name] \"Headline\" — summary; key words — under the header \"EARLIER ENTRIES (compressed)\". Enough for Jove to recognize an entry exists without re-reading its full prose. The summary and key words were written once, when the entry was confirmed.",
  "session-context":
    "For a returning user, the prompt builder reads the session count and a summary of the previous session from the database and pastes them under \"SESSION CONTEXT\", so Jove can pick up where things left off without a recap.",
  "transcript-detected":
    "When the user pastes a transcript, a detector flags it and this block is injected to tell Jove to treat the paste as material to analyze, not a message addressed to it.",
  "exploration-focus":
    "When the user taps \"Explore with Jove\" on a Manual entry or an empty layer, this block is injected to point Jove at that specific entry or layer for the turn.",
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

// ---------------------------------------------------------------------------
// Selection model — every clickable thing maps to a typed Selection.
// ---------------------------------------------------------------------------

type Selection =
  | { kind: "overview" }
  | { kind: "section"; id: string }
  | { kind: "persona"; mode: PersonaMode }
  | { kind: "convmode"; mode: ConversationMode }
  | { kind: "alongside"; id: string }
  | { kind: "sibling"; id: string }
  | { kind: "group"; id: string };

function selectionKey(s: Selection | null): string | null {
  if (!s) return null;
  if (s.kind === "overview") return "overview";
  if (s.kind === "section") return `section:${s.id}`;
  if (s.kind === "persona") return `persona:${s.mode}`;
  if (s.kind === "convmode") return `convmode:${s.mode}`;
  if (s.kind === "alongside") return `alongside:${s.id}`;
  if (s.kind === "sibling") return `sibling:${s.id}`;
  return `group:${s.id}`;
}

// ---------------------------------------------------------------------------
// Alongside + Sibling content — hand-curated since these aren't surfaced as
// prompt sections by the API. Source paths are real and grep-able.
// ---------------------------------------------------------------------------

interface AdjacentItem {
  id: string;
  label: string;
  oneLine: string;
  description: string;
  source: string;
}

const ALONGSIDE_ITEMS: AdjacentItem[] = [
  {
    id: "user-message",
    label: "User message",
    oneLine: "The message just sent",
    description:
      "The just-sent user message becomes the last entry in the messages array. Server-triggered openers (mode === 'guided-intake' or 'upload' first turn, post-confirm continuations) pass message: null so no user line is appended.",
    source: "src/app/api/chat/route.ts → POST handler",
  },
  {
    id: "conv-history",
    label: "Conversation history",
    oneLine: "All prior turns this session",
    description:
      "Every previous user + assistant turn for this conversation, fetched from the messages table ordered by created_at. Loaded by persona-pipeline before the prompt is assembled.",
    source: "src/lib/persona/persona-pipeline.ts → loadConversationContext",
  },
  {
    id: "sliding-window",
    label: "Sliding window",
    oneLine: "First 2 + last 48 once turns > 50",
    description:
      "Past 50 total messages, the window collapses to the first 2 (to preserve the bootstrap context) plus the last 48 (for recency). The middle is dropped. ADR-023.",
    source: "src/lib/persona/call-persona.ts → applySlidingWindow",
  },
  {
    id: "system-messages",
    label: "Synthetic system messages",
    oneLine: "Checkpoint action records",
    description:
      "When the user confirms / rejects / refines a checkpoint, a canonical system message is inserted into the messages array as a structured record. mapSystemMessages re-maps these to assistant turns at API-call time so Claude sees them as conversation events, not bare metadata.",
    source: "src/lib/persona/persona-pipeline.ts → insertCheckpointActionMessage, mapSystemMessages",
  },
  {
    id: "cache-control",
    label: "cache_control marker",
    oneLine: "Where the cache boundary sits",
    description:
      "A cache_control: { type: 'ephemeral' } marker placed at the end of the static + persona-keyed blocks tells Anthropic to cache everything up to that point. Everything after is rebuilt every turn.",
    source: "src/lib/persona/system-prompt.ts → buildSystemPromptBlocks",
  },
];

const SIBLING_CALLS: {
  id: string;
  label: string;
  model: string;
  when: string;
  reads: string;
  writes: string;
  description: string;
  source: string;
}[] = [
  {
    id: "extraction",
    label: "Extraction",
    model: "Sonnet",
    when: "Parallel — fires the same instant as Jove",
    reads: "The user's last message + previous extraction state",
    writes: "conversations.extraction_state JSONB (used by next turn)",
    description:
      "Background analyzer. Fires as a non-awaited Promise the same turn the user sends a message — Jove and extraction race. The brief it writes feeds the prompt one turn later (the 'one-turn lag' you never feel). Includes the language bank, layer signals, checkpoint gate, sage brief.",
    source: "src/lib/persona/extraction.ts → runExtraction",
  },
  {
    id: "monitor",
    label: "Shadow monitor",
    model: "Opus",
    when: "Parallel — fires the same instant as Jove, every turn",
    reads: "The last 8 messages of the conversation",
    writes: "A structured alliance read to the monitor_reads table",
    description:
      "Reads the alliance, not the topic — is the bond holding, is the conversation drifting or sinking. Phase 0 shadow mode: it runs on every web turn and writes to its own table, but NOTHING downstream reads it back. A validated sensor wired to no actuator — the input to a feedback loop (the deterministic selector) that isn't built yet. Until that exists, the monitor changes nothing about Jove's behavior.",
    source: "src/lib/persona/monitor.ts → runMonitor",
  },
  {
    id: "classifier",
    label: "Checkpoint detector",
    model: "Regex",
    when: "Post-stream — after Jove finishes",
    reads: "Jove's just-streamed response",
    writes: "Triggers composer if a checkpoint is detected",
    description:
      "Looks at what Jove just said and decides if it's a checkpoint proposal. Deterministic phrase match for the canonical transition line — no model call, no streaming. If matched, the composer fires next.",
    source: "src/lib/persona/detect-checkpoint.ts → detectCheckpointInResponse",
  },
  {
    id: "composer",
    label: "Manual entry composer",
    model: "Opus",
    when: "Post-stream — at proposal time, on checkpoint turns only",
    reads: "Conversation turn(s), language bank, manual entry list",
    writes: "Returns the proposed entry (name + content + summary + key_words) for the checkpoint card — NOT a DB write",
    description:
      "Composes the proposed Manual entry server-side at proposal time — right after the detector flags a checkpoint, before the user sees the card. Includes headline validation + focused retry. Produces summary + key_words too, so the Manual-context compressor has them next turn. The actual manual_entries write happens later, only if the user confirms the card — a non-model database step (confirmCheckpoint), not part of this call.",
    source: "src/lib/persona/confirm-checkpoint.ts → composeManualEntry",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApiResponse {
  phases: PhaseData[];
}

export default function UnderTheHoodPage() {
  const isAdmin = useIsAdmin();
  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [personaModes, setPersonaModes] = useState<PersonaMode[]>(["adhd"]);
  const [convMode, setConvMode] = useState<ConversationMode>("situation");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  // CSV mirrors how the runtime carries persona_modes; the route splits it and
  // feeds composeTier2, so the rendered Tier-2 stacks exactly like production.
  const personaParam = personaModes.join(",");
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetch(
      `/api/admin/prompt-architecture?personaModes=${personaParam}&convMode=${convMode}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return r.json();
      })
      .then((json: ApiResponse) => {
        if (cancelled) return;
        setData(json);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [personaParam, convMode]);

  // Aggregate sections across all phases (deduped by id) so the diagram can
  // show every block that could appear, not just whatever is active in one
  // lifecycle phase.
  const sectionById = useMemo(() => {
    const map = new Map<string, PromptSection>();
    if (!data) return map;
    for (const phase of data.phases) {
      for (const s of phase.sections) {
        // Keep the last occurrence — later phases have more context.
        map.set(s.id, s);
      }
    }
    return map;
  }, [data]);

  // Phase-presence: which lifecycle phases each section appears in.
  // Surfaced as small dots on each conditional-ladder chip.
  const phasesBySection = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!data) return map;
    for (const phase of data.phases) {
      for (const s of phase.sections) {
        if (!map.has(s.id)) map.set(s.id, new Set());
        map.get(s.id)!.add(phase.id);
      }
    }
    return map;
  }, [data]);

  const phaseList = useMemo(() => {
    if (!data) return [] as { id: string; label: string }[];
    return data.phases.map((p) => ({ id: p.id, label: p.label }));
  }, [data]);

  const step = STEPS[stepIndex];
  const visible = useMemo(
    () => ({
      atom: step.id >= 1,
      spine: step.id >= 2,
      persona: step.id >= 3,
      mode: step.id >= 4,
      conditional: step.id >= 5,
      dynamic: step.id >= 6,
      alongside: step.id >= 7,
      siblings: step.id >= 8,
      cache: step.id >= 9,
      example: step.id >= 10,
    }),
    [step.id],
  );

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
  };

  // Reuse the exact runtime toggle (neurotypes stack; general is exclusive) so
  // the admin selector can never drift from how the app composes personas.
  const handlePersonaPillClick = (mode: PersonaMode) => {
    setPersonaModes((cur) => togglePersonaMode(cur, mode));
    handleSelect({ kind: "persona", mode });
  };

  const handleModePillClick = (mode: ConversationMode) => {
    if (mode !== convMode) setConvMode(mode);
    handleSelect({ kind: "convmode", mode });
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
        <AdminNavRail activeId="prompt-architecture" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Header personaModes={personaModes} convMode={convMode} />

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
              <BucketsOverview onJump={setStepIndex} />
              {loadState === "loading" && <DiagramSkeleton />}
              {loadState === "error" && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--session-error)",
                    padding: 16,
                  }}
                >
                  Failed to load prompt architecture. Check the API.
                </div>
              )}
              {loadState === "ready" && (
                <Diagram
                  visible={visible}
                  selection={selection}
                  onSelect={handleSelect}
                  onPersonaPill={handlePersonaPillClick}
                  onModePill={handleModePillClick}
                  personaModes={personaModes}
                  convMode={convMode}
                  sectionById={sectionById}
                  phasesBySection={phasesBySection}
                  phaseList={phaseList}
                />
              )}
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
                  stepIndex={stepIndex}
                  setStepIndex={(i) => {
                    setStepIndex(i);
                    setSelection(null);
                  }}
                  step={step}
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
                  <DetailPanel
                    selection={selection}
                    sectionById={sectionById}
                    personaModes={personaModes}
                    convMode={convMode}
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
// Header + stepper
// ---------------------------------------------------------------------------

function Header({
  personaModes,
  convMode,
}: {
  personaModes: PersonaMode[];
  convMode: ConversationMode;
}) {
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
          display: "flex",
          alignItems: "baseline",
          gap: 14,
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
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
          }}
        >
          Active: {personaLabel(personaModes)} · {MODE_LABELS[convMode]}
        </span>
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
        How Jove&rsquo;s system prompt is assembled, piece by piece. The
        diagram reads the live codebase via{" "}
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
          /api/admin/prompt-architecture
        </code>{" "}
        — every section is a real export. Click any band, pill, or block to
        inspect its source path, token count, and rendered text. The
        conversation state shown — Manual entries, briefs, turn counts — is
        illustrative fixture data, not a real user.
      </p>
    </div>
  );
}

function Stepper({
  stepIndex,
  setStepIndex,
}: {
  stepIndex: number;
  setStepIndex: (i: number) => void;
  step: Step;
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
// Right column — step caption or detail panel
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
        Step {step.id}
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
        Click any band, pill, or block to inspect its source.
      </p>
    </>
  );
}

function DetailPanel({
  selection,
  sectionById,
  personaModes,
  convMode,
  onClose,
}: {
  selection: Selection;
  sectionById: Map<string, PromptSection>;
  personaModes: PersonaMode[];
  convMode: ConversationMode;
  onClose: () => void;
}) {
  if (selection.kind === "overview") {
    return <OverviewDetail onClose={onClose} sectionById={sectionById} />;
  }
  if (selection.kind === "persona") {
    return (
      <PersonaDetail
        mode={selection.mode}
        activeModes={personaModes}
        sectionById={sectionById}
        onClose={onClose}
      />
    );
  }
  if (selection.kind === "convmode") {
    return (
      <ConvModeDetail
        mode={selection.mode}
        activeMode={convMode}
        sectionById={sectionById}
        onClose={onClose}
      />
    );
  }
  if (selection.kind === "alongside") {
    return <AlongsideDetail id={selection.id} onClose={onClose} />;
  }
  if (selection.kind === "sibling") {
    return <SiblingDetail id={selection.id} onClose={onClose} />;
  }
  if (selection.kind === "group") {
    return (
      <GroupDetail groupId={selection.id} sectionById={sectionById} onClose={onClose} />
    );
  }
  // section
  const section = sectionById.get(selection.id);
  if (!section) {
    return (
      <>
        <DetailHeader label="Not in current phase" onClose={onClose} />
        <p style={{ color: "var(--session-ink-soft)", fontSize: 14 }}>
          This section isn&rsquo;t active for the current persona × mode × phase
          combination. Switch persona or mode to surface it.
        </p>
      </>
    );
  }
  return <SectionDetail section={section} onClose={onClose} />;
}

function DetailHeader({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
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
        {label}
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
  );
}

function GroupDetail({
  groupId,
  sectionById,
  onClose,
}: {
  groupId: string;
  sectionById: Map<string, PromptSection>;
  onClose: () => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const group = SPINE_GROUPS.find((g) => g.id === groupId);
  const sections = (group?.sectionIds ?? [])
    .map((id) => sectionById.get(id))
    .filter((s): s is PromptSection => Boolean(s));
  if (!group || sections.length === 0) {
    return (
      <>
        <DetailHeader label="Not in current view" onClose={onClose} />
        <p style={{ color: "var(--session-ink-soft)", fontSize: 14 }}>
          This group isn&rsquo;t active for the current persona × mode.
        </p>
      </>
    );
  }
  const tokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  const files = Array.from(new Set(sections.map((s) => s.source.file)));
  return (
    <>
      <DetailHeader label={`Tier ${group.tier} · always-on, cached`} onClose={onClose} />
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
        {group.label}
      </h2>
      <p
        style={{
          margin: "6px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        One cached band holding {sections.length} sections that ship together on
        every turn and never change. Broken out below.
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
        <DetailLabel>Sections</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>
          {sections
            .map((s) => `${s.label} (${s.tokens.toLocaleString()})`)
            .join(", ")}
        </span>
        <DetailLabel>Tokens</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>
          {tokens.toLocaleString()}
        </span>
        <DetailLabel>Source</DetailLabel>
        <div>
          {files.map((f) => (
            <code
              key={f}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--session-ink)",
                background: "var(--session-walnut-surface-soft)",
                padding: "1px 6px",
                borderRadius: 3,
                marginRight: 6,
                display: "inline-block",
              }}
            >
              {f}
            </code>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowSource((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          alignSelf: "flex-start",
          padding: "6px 12px",
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.5px",
          color: "var(--session-ink)",
          background: "var(--session-walnut-tint)",
          border: "1px solid var(--session-walnut-border)",
          borderRadius: 5,
        }}
      >
        {showSource ? "Hide rendered text ↑" : "Show rendered text ↓"}
      </button>
      {showSource && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--session-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {sections.map((s) => `── ${s.label} ──\n${s.text}`).join("\n\n")}
        </pre>
      )}
    </>
  );
}

function SectionDetail({
  section,
  onClose,
}: {
  section: PromptSection;
  onClose: () => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const showsOperation =
    section.tier === "dynamic" && Boolean(DYNAMIC_OPERATION[section.id]);
  return (
    <>
      <DetailHeader label={`Tier ${section.tier} · ${section.condition.label}`} onClose={onClose} />
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
        {section.label}
      </h2>

      {DYNAMIC_DESCRIPTIONS[section.id] && (
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: "var(--session-ink-soft)",
          }}
        >
          {DYNAMIC_DESCRIPTIONS[section.id]}
        </p>
      )}

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
        <DetailLabel>Source</DetailLabel>
        <div>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--session-ink)",
              background: "var(--session-walnut-surface-soft)",
              padding: "1px 6px",
              borderRadius: 3,
              wordBreak: "break-word",
              display: "inline-block",
            }}
          >
            {section.source.file}
          </code>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--session-ink-soft)",
              marginTop: 4,
            }}
          >
            {section.source.symbol}
          </div>
        </div>

        <DetailLabel>Tokens</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>
          {section.tokens.toLocaleString()}
        </span>

        <DetailLabel>Condition</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>
          {section.condition.label}
          <span
            style={{
              marginLeft: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--session-ink-ghost)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            ({section.condition.type})
          </span>
        </span>

        {section.alternatives.length > 0 && (
          <>
            <DetailLabel>Alternatives</DetailLabel>
            <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
              {section.alternatives.map((a) => (
                <li key={a.label} style={{ marginBottom: 3 }}>
                  <span style={{ color: "var(--session-ink)" }}>{a.label}</span>{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--session-ink-ghost)",
                    }}
                  >
                    ({a.tokens.toLocaleString()} tok · {a.trigger})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowSource((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          alignSelf: "flex-start",
          padding: "6px 12px",
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.5px",
          color: "var(--session-ink)",
          background: "var(--session-walnut-tint)",
          border: "1px solid var(--session-walnut-border)",
          borderRadius: 5,
        }}
      >
        {showSource ? "Hide rendered text ↑" : "Show rendered text ↓"}
      </button>

      {showSource && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--session-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {showsOperation
            ? `HOW IT OPERATES\n${DYNAMIC_OPERATION[section.id]}\n\n── EXAMPLE (illustrative — not a real user) ──\n${section.text}`
            : section.text}
        </pre>
      )}
    </>
  );
}

function PersonaDetail({
  mode,
  activeModes,
  sectionById,
  onClose,
}: {
  mode: PersonaMode;
  activeModes: PersonaMode[];
  sectionById: Map<string, PromptSection>;
  onClose: () => void;
}) {
  const isActive = activeModes.includes(mode);
  const [showSource, setShowSource] = useState(false);
  const personaSections = useMemo(
    () =>
      Array.from(sectionById.values()).filter(
        (s) => s.condition.type === "persona",
      ),
    [sectionById],
  );
  const totalTokens = personaSections.reduce((s, x) => s + x.tokens, 0);
  return (
    <>
      <DetailHeader label="Persona delta" onClose={onClose} />
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
        {PERSONA_LABELS[mode]}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        Persona-specific rules merged into Tier 2 sections on top of the shared
        base. Source:{" "}
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
          src/lib/persona/voice-{mode}.ts
        </code>
      </p>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-ink-soft)",
          lineHeight: 1.5,
        }}
      >
        {personaSections.length} Tier 2 sections vary by persona —{" "}
        {personaSections.map((s) => s.label).join(", ")} —{" "}
        {totalTokens.toLocaleString()} tokens total for{" "}
        {isActive ? personaLabel(activeModes) : PERSONA_LABELS[mode]}.
        {!isActive && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--session-ink-ghost)",
              marginLeft: 6,
            }}
          >
            (showing currently-loaded data; switching personas…)
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowSource((v) => !v)}
        disabled={personaSections.length === 0}
        style={{
          all: "unset",
          cursor: personaSections.length === 0 ? "default" : "pointer",
          alignSelf: "flex-start",
          padding: "6px 12px",
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.5px",
          color:
            personaSections.length === 0
              ? "var(--session-ink-ghost)"
              : "var(--session-ink)",
          background: "var(--session-walnut-tint)",
          border: `1px solid ${
            personaSections.length === 0
              ? "var(--session-walnut-border-soft)"
              : "var(--session-walnut-border)"
          }`,
          borderRadius: 5,
          opacity: personaSections.length === 0 ? 0.5 : 1,
        }}
      >
        {showSource ? "Hide rendered text ↑" : "Show rendered text ↓"}
      </button>

      {showSource && personaSections.length > 0 && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--session-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {personaSections
            .map((s) => `── ${s.label} (${s.tokens.toLocaleString()} tok) ──\n${s.text}`)
            .join("\n\n")}
        </pre>
      )}
    </>
  );
}

function ConvModeDetail({
  mode,
  activeMode,
  sectionById,
  onClose,
}: {
  mode: ConversationMode;
  activeMode: ConversationMode;
  sectionById: Map<string, PromptSection>;
  onClose: () => void;
}) {
  const isActive = mode === activeMode;
  const [showSource, setShowSource] = useState(false);
  const sourceFile: Record<ConversationMode, string> = {
    situation: "system-prompt.ts (default opener path)",
    "guided-intake": "system-prompt.ts + guided-intake-copy.ts",
    upload: "system-prompt.ts + upload-copy.ts",
  };
  const modeSections = useMemo(
    () =>
      Array.from(sectionById.values()).filter(
        (s) => s.condition.type === "conv-mode",
      ),
    [sectionById],
  );
  const totalTokens = modeSections.reduce((s, x) => s + x.tokens, 0);
  return (
    <>
      <DetailHeader label="Conversation mode" onClose={onClose} />
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
        {MODE_LABELS[mode]}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        Entry-phase Tier 3 block selected at conversation start. Source:{" "}
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
          {sourceFile[mode]}
        </code>
      </p>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-ink-soft)",
          lineHeight: 1.5,
        }}
      >
        {modeSections.length === 0 ? (
          <>
            No dedicated mode block — {MODE_LABELS[activeMode]} uses the
            default opener path. The entry-phase posture lives in the
            First Message block (state-conditioned).
          </>
        ) : (
          <>
            {modeSections.length} section{modeSections.length === 1 ? "" : "s"}{" "}
            specific to {MODE_LABELS[activeMode]} — {modeSections.map((s) => s.label).join(", ")}{" "}
            — {totalTokens.toLocaleString()} tokens total.
            {!isActive && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--session-ink-ghost)",
                  marginLeft: 6,
                }}
              >
                (showing currently-loaded data; switching modes…)
              </span>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowSource((v) => !v)}
        disabled={modeSections.length === 0}
        style={{
          all: "unset",
          cursor: modeSections.length === 0 ? "default" : "pointer",
          alignSelf: "flex-start",
          padding: "6px 12px",
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.5px",
          color:
            modeSections.length === 0
              ? "var(--session-ink-ghost)"
              : "var(--session-ink)",
          background: "var(--session-walnut-tint)",
          border: `1px solid ${
            modeSections.length === 0
              ? "var(--session-walnut-border-soft)"
              : "var(--session-walnut-border)"
          }`,
          borderRadius: 5,
          opacity: modeSections.length === 0 ? 0.5 : 1,
        }}
      >
        {showSource ? "Hide rendered text ↑" : "Show rendered text ↓"}
      </button>

      {showSource && modeSections.length > 0 && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--session-ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {modeSections
            .map((s) => `── ${s.label} (${s.tokens.toLocaleString()} tok) ──\n${s.text}`)
            .join("\n\n")}
        </pre>
      )}
    </>
  );
}

function OverviewDetail({
  sectionById,
  onClose,
}: {
  sectionById: Map<string, PromptSection>;
  onClose: () => void;
}) {
  const total = Array.from(sectionById.values()).reduce(
    (sum, s) => sum + s.tokens,
    0,
  );
  return (
    <>
      <DetailHeader label="Per-turn payload" onClose={onClose} />
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
        Jove&rsquo;s system prompt
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
        }}
      >
        Single text block prepended to every Anthropic call. Assembled by{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--session-ink)" }}>buildSystemPrompt</code>{" "}
        and{" "}
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--session-ink)" }}>buildSystemPromptBlocks</code>{" "}
        in <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--session-ink)" }}>src/lib/persona/system-prompt.ts</code>. Layers stack from static (cached forever) to dynamic (rebuilt each turn).
      </p>
      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-ink-soft)",
        }}
      >
        Across all phases, {sectionById.size} distinct sections totaling{" "}
        <strong style={{ color: "var(--session-ink)" }}>
          {total.toLocaleString()}
        </strong>{" "}
        tokens for the current persona × mode.
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

function DiagramSkeleton() {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--session-ink-ghost)",
        letterSpacing: 1,
        padding: 24,
      }}
    >
      Loading prompt sections…
    </div>
  );
}

interface DiagramProps {
  visible: Record<string, boolean>;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  onPersonaPill: (mode: PersonaMode) => void;
  onModePill: (mode: ConversationMode) => void;
  personaModes: PersonaMode[];
  convMode: ConversationMode;
  sectionById: Map<string, PromptSection>;
  phasesBySection: Map<string, Set<string>>;
  phaseList: { id: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Buckets overview — the plain-language front door. One prompt, three parts,
// each expanding to its section headers + one-liners. "Show it in the diagram
// below" jumps the walkthrough to that region. Static content (no live data),
// so it renders regardless of load state.
// ---------------------------------------------------------------------------

const OVERVIEW_PARTS: {
  id: string;
  title: string;
  one: string;
  accent: string;
  step: number;
  items: { name: string; note: string }[];
}[] = [
  {
    id: "instructions",
    title: "Instructions",
    one: "How Jove behaves — written by you, in code.",
    accent: "var(--session-walnut-meta-strong)",
    step: 4,
    items: [
      { name: "Tier 1 · Constitutional", note: "Seven hard rules that never change and override everything." },
      { name: "Tier 2 · Voice", note: "How Jove sounds — a shared base plus a small per-persona add-on." },
      { name: "Tier 3 · Conversation mechanics", note: "Situational guidance that switches on and off by the moment." },
    ],
  },
  {
    id: "about-user",
    title: "About the user",
    one: "Who this person is — read from the database each turn.",
    accent: "var(--session-persona)",
    step: 5,
    items: [
      { name: "Recent confirmed Manual entries", note: "Their latest entries, in full prose." },
      { name: "Earlier confirmed Manual entries (compressed)", note: "Older entries, one line each." },
      { name: "Last session recap", note: "Session count + a summary of last time." },
      { name: "Extraction brief", note: "A per-turn note about their last message; one turn behind." },
    ],
  },
  {
    id: "conversation",
    title: "The conversation",
    one: "What's being said now — the messages the model continues.",
    accent: "var(--session-warning)",
    step: 6,
    items: [
      { name: "The new message", note: "What the user just sent." },
      { name: "The chat so far", note: "Every earlier turn, re-sent each turn." },
      { name: "Trimming for long chats", note: "First 2 + last 48 once it passes ~50 messages." },
      { name: "Checkpoint actions", note: "Confirm / reject inserted as chat events." },
    ],
  },
];

function BucketsOverview({ onJump }: { onJump: (i: number) => void }) {
  const [open, setOpen] = useState<string | null>("instructions");
  const [shown, setShown] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingBottom: 1,
          borderBottom: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        {shown ? "Hide the overview" : "The prompt, in three parts"}
        <span style={{ fontSize: 9 }}>{shown ? "▲" : "▾"}</span>
      </button>
      {shown && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid var(--session-walnut-border)",
            borderRadius: 10,
            background: "var(--session-walnut-tint)",
            overflow: "hidden",
          }}
        >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "11px 16px",
          borderBottom: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-strong)",
          }}
        >
          The prompt — one call, every turn
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--session-ink-ghost)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          3 parts · click to open
        </span>
      </div>
      {OVERVIEW_PARTS.map((p, i) => {
        const isOpen = open === p.id;
        return (
          <div
            key={p.id}
            style={{
              position: "relative",
              borderTop: i ? "1px solid var(--session-walnut-border-soft)" : "none",
            }}
          >
            <span
              style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: p.accent }}
            />
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                boxSizing: "border-box",
                width: "100%",
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "13px 16px 13px 22px",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--session-ink-ghost)" }}>
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: "var(--session-ink)",
                  }}
                >
                  {p.title}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--session-ink-soft)", marginTop: 2 }}>
                  {p.one}
                </span>
              </span>
              <span
                style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--session-ink-soft)", lineHeight: 1 }}
              >
                {isOpen ? "–" : "+"}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 14px 22px" }}>
                {p.items.map((it) => (
                  <div
                    key={it.name}
                    style={{ padding: "9px 0", borderTop: "1px solid var(--session-walnut-border-soft)" }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "var(--session-ink)",
                      }}
                    >
                      {it.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--session-ink-soft)", marginTop: 1 }}>
                      {it.note}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onJump(p.step)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    marginTop: 12,
                    padding: "5px 11px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.5px",
                    color: "var(--session-ink)",
                    background: "var(--session-walnut-surface-soft)",
                    border: "1px solid var(--session-walnut-border)",
                    borderRadius: 5,
                  }}
                >
                  Show it in the diagram below ↓
                </button>
              </div>
            )}
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

function Diagram({
  visible,
  selection,
  onSelect,
  onPersonaPill,
  onModePill,
  personaModes,
  convMode,
  sectionById,
  phasesBySection,
  phaseList,
}: DiagramProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <CacheWrap active={visible.cache}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PromptHeader
              visible={visible.atom}
              selected={selection?.kind === "overview"}
              onSelect={() => onSelect({ kind: "overview" })}
            />
            {visible.spine && (
              <div
                style={{
                  border: `1px solid ${COLOR.identityBorder}`,
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
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
                  The foundation · in every packet
                </span>
                <SpineBands
                  selection={selection}
                  onSelect={onSelect}
                  sectionById={sectionById}
                />
              </div>
            )}
            {visible.persona && (
              <PersonaFan
                selection={selection}
                onPersonaPill={onPersonaPill}
                personaModes={personaModes}
              />
            )}
            {visible.mode && (
              <ModeFan
                selection={selection}
                onModePill={onModePill}
                convMode={convMode}
              />
            )}
            {visible.conditional && (
              <ConditionalLadder
                selection={selection}
                onSelect={onSelect}
                sectionById={sectionById}
                phasesBySection={phasesBySection}
                phaseList={phaseList}
              />
            )}
          </div>
        </CacheWrap>
        {/* Live context = the prompt's dynamic tail, below the cache line. */}
        <div
          style={{
            opacity: visible.dynamic ? 1 : 0.1,
            transition: "opacity 220ms ease",
            marginTop: 10,
          }}
        >
          <DynamicSidecar
            selection={selection}
            onSelect={onSelect}
            sectionById={sectionById}
          />
        </div>
        {visible.alongside && (
          <AlongsideStrip selection={selection} onSelect={onSelect} />
        )}
        {visible.siblings && (
          <SiblingCallsStrip selection={selection} onSelect={onSelect} />
        )}
        {visible.example && (
          <ExampleAssemblyFooter
            sectionById={sectionById}
            personaModes={personaModes}
            convMode={convMode}
          />
        )}
    </div>
  );
}

function PromptHeader({
  visible,
  selected,
  onSelect,
}: {
  visible: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: COLOR.identityBg,
        border: `1px solid ${COLOR.identityBorder}`,
        borderRadius: 8,
        opacity: visible ? 1 : 0.2,
        transition: "opacity 220ms ease, box-shadow 120ms ease",
        boxShadow: selected ? SELECTED_RING : "none",
        width: "100%",
        boxSizing: "border-box",
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
        Jove&rsquo;s system prompt — assembled per turn
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--session-ink-ghost)",
        }}
      >
        click for overview
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Clickable bands
// ---------------------------------------------------------------------------

// Prefix a card header with its tier/live origin, e.g. "Tier 2 · Voice".
// Defensive: skips labels that already carry a "Tier …"/"Live …" prefix so
// the three baked-in labels (Constitutional Rules, Voice, Conversation
// Mechanics) don't double up.
function displayLabel(section: { tier: string; label: string }): string {
  if (/^(Tier |Live )/.test(section.label)) return section.label;
  switch (section.tier) {
    case "intro":
    case "1":
      return `Tier 1 · ${section.label}`;
    case "2":
      return `Tier 2 · ${section.label}`;
    case "3":
      return `Tier 3 · ${section.label}`;
    case "dynamic":
      return section.label;
    default:
      return section.label;
  }
}

function GroupBand({
  group,
  selection,
  onSelect,
  sectionById,
  bg,
  border,
}: {
  group: { id: string; tier: "1" | "2"; label: string; sectionIds: string[] };
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
  bg: string;
  border: string;
}) {
  const sections = group.sectionIds
    .map((id) => sectionById.get(id))
    .filter((s): s is PromptSection => Boolean(s));
  if (sections.length === 0) return null;
  const tokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  const selected = selection?.kind === "group" && selection.id === group.id;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "group", id: group.id })}
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
            color: "var(--session-ink)",
          }}
        >
          {group.label}
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
          {tokens.toLocaleString()} tok
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.3px",
          color: "var(--session-ink-ghost)",
        }}
      >
        {sections.map((s) => s.label).join("  ·  ")}
      </div>
    </button>
  );
}

function SpineBands({
  selection,
  onSelect,
  sectionById,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
}) {
  return (
    <>
      {SPINE_GROUPS.map((group) => (
        <GroupBand
          key={group.id}
          group={group}
          selection={selection}
          onSelect={onSelect}
          sectionById={sectionById}
          bg={group.tier === "1" ? COLOR.identityBg : COLOR.baseVoice}
          border={group.tier === "1" ? COLOR.identityBorder : COLOR.baseVoiceBorder}
        />
      ))}
    </>
  );
}

function PersonaFan({
  selection,
  onPersonaPill,
  personaModes,
}: {
  selection: Selection | null;
  onPersonaPill: (mode: PersonaMode) => void;
  personaModes: PersonaMode[];
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
          Persona delta — affects voice rules, register, landing, deepening
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
          neurotypes stack · general is exclusive
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
        {PERSONAS.map((p) => {
          const isActive = personaModes.includes(p);
          const isSelected =
            selection?.kind === "persona" && selection.mode === p;
          return (
            <VariantPill
              key={p}
              label={PERSONA_LABELS[p]}
              active={isActive}
              selected={isSelected}
              onClick={() => onPersonaPill(p)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ModeFan({
  selection,
  onModePill,
  convMode,
}: {
  selection: Selection | null;
  onModePill: (mode: ConversationMode) => void;
  convMode: ConversationMode;
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
          Mode opener — entry-phase Tier 3 block
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
          entry phase only · click to switch
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
        {MODES.map((m) => {
          const isActive = m === convMode;
          const isSelected =
            selection?.kind === "convmode" && selection.mode === m;
          return (
            <VariantPill
              key={m}
              label={MODE_LABELS[m]}
              active={isActive}
              selected={isSelected}
              onClick={() => onModePill(m)}
            />
          );
        })}
      </div>
    </div>
  );
}

function VariantPill({
  label,
  active,
  selected,
  onClick,
}: {
  label: string;
  active: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "0.5px",
        padding: "2px 8px",
        borderRadius: 3,
        background: active
          ? "var(--session-walnut-highlight)"
          : "transparent",
        color: active ? "var(--session-ink)" : "var(--session-ink-soft)",
        border: `1px solid ${
          active
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

function ConditionalLadder({
  selection,
  onSelect,
  sectionById,
  phasesBySection,
  phaseList,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
  phasesBySection: Map<string, Set<string>>;
  phaseList: { id: string; label: string }[];
}) {
  // Tier 3 sections that aren't mode-openers and aren't always-on
  // adapting/pacing/etc. Render every Tier 3 section in the aggregated map.
  const tier3 = Array.from(sectionById.values()).filter(
    (s) => s.tier === "3" && !MODE_OPENER_IDS.has(s.id) && s.id !== "tier3",
  );
  // Sort: state/dynamic conditions first (the interesting ones), then always-on.
  tier3.sort((a, b) => {
    const score = (s: PromptSection) =>
      s.condition.type === "state" ? 0 : s.condition.type === "dynamic" ? 1 : 2;
    return score(a) - score(b);
  });
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
          Tier 3 — Conversation mechanics ({tier3.length} blocks)
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

      {/* Legend for phase dots */}
      {phaseList.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          <span>fires in:</span>
          {phaseList.map((p) => (
            <span
              key={p.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "var(--session-walnut-meta)",
                  display: "inline-block",
                }}
              />
              {p.label}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {tier3.map((s) => {
          const selected =
            selection?.kind === "section" && selection.id === s.id;
          const phases = phasesBySection.get(s.id) ?? new Set<string>();
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect({ kind: "section", id: s.id })}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 5,
                background: COLOR.conditional,
                border: `1px solid ${COLOR.conditionalBorder}`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                boxShadow: selected ? SELECTED_RING : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    color: "var(--session-ink)",
                    fontWeight: 500,
                  }}
                >
                  {displayLabel(s)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--session-ink-ghost)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.tokens.toLocaleString()} tok
                </span>
              </div>
              {phaseList.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  aria-label={`Fires in: ${phaseList
                    .filter((p) => phases.has(p.id))
                    .map((p) => p.label)
                    .join(", ")}`}
                >
                  {phaseList.map((p) => {
                    const present = phases.has(p.id);
                    return (
                      <span
                        key={p.id}
                        title={p.label}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background: present
                            ? "var(--session-walnut-meta)"
                            : "var(--session-walnut-border-soft)",
                          display: "inline-block",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DynamicSidecar({
  selection,
  onSelect,
  sectionById,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
}) {
  const items = Array.from(sectionById.values()).filter((s) => s.tier === "dynamic");
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
      {items.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--session-ink-ghost)",
          }}
        >
          (no dynamic sections in current phase)
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((s) => {
          const selected =
            selection?.kind === "section" && selection.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect({ kind: "section", id: s.id })}
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
                {displayLabel(s)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--session-ink-ghost)",
                  marginTop: 1,
                }}
              >
                {s.tokens.toLocaleString()} tok · {s.condition.label}
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
        the prompt at turn N+1 — a one-turn lag. Two other live-context blocks
        — Transcript detected and Exploration focus — fire only on a paste or
        an Explore tap, so these examples never show them.
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
        padding: active ? "12px 16px 16px" : 0,
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
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: "1px solid var(--session-walnut-border-soft)",
          }}
        >
          Cache hierarchy
        </div>
      )}
      {children}
    </div>
  );
}

function ExampleAssemblyFooter({
  sectionById,
  personaModes,
  convMode,
}: {
  sectionById: Map<string, PromptSection>;
  personaModes: PersonaMode[];
  convMode: ConversationMode;
}) {
  // Group sections by cache tier (derived from tier + condition).
  type Bucket = { label: string; tokens: number; tier: "static" | "persona" | "dynamic" };
  const buckets: Record<string, Bucket> = {
    "tier1-static": { label: "Tier 1 + Introduction", tokens: 0, tier: "static" },
    "tier2-base": { label: "Tier 2 base voice (always-on)", tokens: 0, tier: "static" },
    "tier2-persona": { label: `Tier 2 persona delta (${personaLabel(personaModes)})`, tokens: 0, tier: "persona" },
    "tier3-mode": { label: `Tier 3 mode opener (${MODE_LABELS[convMode]})`, tokens: 0, tier: "persona" },
    "tier3-conditional": { label: "Tier 3 conditional blocks", tokens: 0, tier: "dynamic" },
    "dynamic": { label: "Live context (Manual, session, extraction)", tokens: 0, tier: "dynamic" },
  };
  for (const s of Array.from(sectionById.values())) {
    if (s.tier === "intro" || s.tier === "1") {
      buckets["tier1-static"].tokens += s.tokens;
    } else if (s.tier === "2" && BASE_VOICE_IDS.has(s.id)) {
      buckets["tier2-base"].tokens += s.tokens;
    } else if (s.tier === "2") {
      buckets["tier2-persona"].tokens += s.tokens;
    } else if (s.tier === "3" && MODE_OPENER_IDS.has(s.id)) {
      buckets["tier3-mode"].tokens += s.tokens;
    } else if (s.tier === "3") {
      buckets["tier3-conditional"].tokens += s.tokens;
    } else if (s.tier === "dynamic") {
      buckets["dynamic"].tokens += s.tokens;
    }
  }
  const entries = Object.values(buckets).filter((b) => b.tokens > 0);
  const total = entries.reduce((s, x) => s + x.tokens, 0);
  const cached = entries
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
          Token budget — {personaLabel(personaModes)} · {MODE_LABELS[convMode]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--session-ink-soft)",
          }}
        >
          {total.toLocaleString()} tokens · {total === 0 ? 0 : ((cached / total) * 100).toFixed(0)}% cached
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map((s) => (
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

// ---------------------------------------------------------------------------
// Alongside — what travels with the prompt in the same API call
// ---------------------------------------------------------------------------

function AlongsideStrip({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: 16,
        borderRadius: 10,
        border: "1px solid var(--session-walnut-border-soft)",
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
          marginBottom: 4,
        }}
      >
        Alongside the prompt
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--session-ink-soft)",
          marginBottom: 10,
        }}
      >
        Travels in the same Anthropic call but isn’t the system prompt itself.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 6,
        }}
      >
        {ALONGSIDE_ITEMS.map((i) => {
          const selected =
            selection?.kind === "alongside" && selection.id === i.id;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onSelect({ kind: "alongside", id: i.id })}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "8px 10px",
                background: "var(--session-walnut-surface-soft)",
                border: "1px solid var(--session-walnut-border-soft)",
                borderRadius: 5,
                boxShadow: selected ? SELECTED_RING : "none",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--session-ink)",
                }}
              >
                {i.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--session-ink-ghost)",
                  letterSpacing: "0.3px",
                }}
              >
                {i.oneLine}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sibling calls — the other AI calls per turn
// ---------------------------------------------------------------------------

function SiblingCallsStrip({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 10,
        border: "1px solid var(--session-persona-border)",
        background: "var(--session-persona-muted)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-persona)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Sibling calls — what else runs this turn
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--session-ink-soft)",
          marginBottom: 10,
        }}
      >
        Separate Anthropic calls that run before, during, or after Jove.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        {SIBLING_CALLS.map((c) => {
          const selected =
            selection?.kind === "sibling" && selection.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect({ kind: "sibling", id: c.id })}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "10px 12px",
                background: "var(--session-walnut-tint)",
                border: "1px solid var(--session-persona-border)",
                borderRadius: 6,
                boxShadow: selected ? SELECTED_RING : "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
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
                  {c.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--session-persona)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {c.model}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "var(--session-ink-soft)",
                  lineHeight: 1.4,
                }}
              >
                {c.when}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panels for the alongside / sibling cards
// ---------------------------------------------------------------------------

function AlongsideDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const item = ALONGSIDE_ITEMS.find((i) => i.id === id);
  if (!item) {
    return (
      <>
        <DetailHeader label="Not found" onClose={onClose} />
        <p style={{ color: "var(--session-ink-soft)", fontSize: 14 }}>
          Unknown alongside item.
        </p>
      </>
    );
  }
  return (
    <>
      <DetailHeader label="Alongside the prompt" onClose={onClose} />
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
        {item.label}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        {item.description}
      </p>
      <div
        style={{
          marginTop: 6,
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-ink-soft)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
            marginRight: 10,
          }}
        >
          Source
        </span>
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
          {item.source}
        </code>
      </div>
    </>
  );
}

function SiblingDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const call = SIBLING_CALLS.find((c) => c.id === id);
  if (!call) {
    return (
      <>
        <DetailHeader label="Not found" onClose={onClose} />
        <p style={{ color: "var(--session-ink-soft)", fontSize: 14 }}>
          Unknown sibling call.
        </p>
      </>
    );
  }
  return (
    <>
      <DetailHeader label={`Sibling call · ${call.model}`} onClose={onClose} />
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
        {call.label}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        {call.description}
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
        <DetailLabel>Model</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>{call.model}</span>

        <DetailLabel>When</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>{call.when}</span>

        <DetailLabel>Reads</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>{call.reads}</span>

        <DetailLabel>Writes</DetailLabel>
        <span style={{ color: "var(--session-ink)" }}>{call.writes}</span>

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
          {call.source}
        </code>
      </div>
    </>
  );
}

