"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import type {
  PhaseData,
  PromptSection,
} from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import type { ConversationMode } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Under the hood — guided walkthrough of how Jove's prompt is assembled.
//
// Data source: /api/admin/prompt-architecture. Sections, source paths, real
// token counts, and actual rendered text all come from the live codebase
// via parsePromptSections. Anything the page describes traces back to a
// real export — no hand-curated metadata drift.
// ---------------------------------------------------------------------------

interface Stage {
  id: number;
  title: string;
  caption: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: "Layer 0 — the whole prompt",
    caption:
      "Every user message triggers one Anthropic call. The system prompt below is what Jove sees. ~7,000 tokens on a normal turn.",
  },
  {
    id: 2,
    title: "Layer 1 — static prefix (always-on)",
    caption:
      "Identity, Tier 1 constitutional rules, and the base voice scaffold. Identical across every user, every turn. Cached forever.",
  },
  {
    id: 3,
    title: "Layer 2 — persona delta (one of four)",
    caption:
      "Trait-specific voice rules layered on top of the base. Selected at signup from autistic / AuDHD / dyslexic / general. Click a pill to switch the active persona — the rest of the diagram re-renders from the live prompt.",
  },
  {
    id: 4,
    title: "Layer 3 — mode opener (one of three)",
    caption:
      "Entry-phase block by input mode (Situation / Guided Intake / Upload). Selected at conversation start. Click a pill to switch the active mode.",
  },
  {
    id: 5,
    title: "Layer 4 — conditional Tier-3 blocks",
    caption:
      "Tier 3 blocks that fire based on conversation state (first turn, returning user, approaching checkpoint, clinical material, etc.). Rebuilt each turn.",
  },
  {
    id: 6,
    title: "Layer 5 — live context (parallel)",
    caption:
      "Dynamic blocks appended at runtime: confirmed Manual entries (compressed), session context, extraction brief from the parallel Sonnet call. Rebuilt each turn.",
  },
  {
    id: 7,
    title: "Cache view — what's reused vs rebuilt",
    caption:
      "Static prefix + persona-keyed parts are cached. The conditional and dynamic layers are rebuilt every turn. That's why a ~7,000-token prompt streams in 2–3 seconds.",
  },
  {
    id: 8,
    title: "Worked example — token budget by layer",
    caption:
      "Token totals from the live prompt for the current persona × mode. Cached vs rebuilt percentages are computed from the actual section sizes.",
  },
];

const PERSONA_LABELS: Record<PersonaMode, string> = {
  autistic: "Autistic",
  adhd: "AuDHD",
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
  | { kind: "convmode"; mode: ConversationMode };

function selectionKey(s: Selection | null): string | null {
  if (!s) return null;
  if (s.kind === "overview") return "overview";
  if (s.kind === "section") return `section:${s.id}`;
  if (s.kind === "persona") return `persona:${s.mode}`;
  return `convmode:${s.mode}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApiResponse {
  phases: PhaseData[];
}

export default function UnderTheHoodPage() {
  const isAdmin = useIsAdmin();
  const [stageIndex, setStageIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [personaMode, setPersonaMode] = useState<PersonaMode>("adhd");
  const [convMode, setConvMode] = useState<ConversationMode>("situation");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetch(
      `/api/admin/prompt-architecture?personaModes=${personaMode}&convMode=${convMode}`,
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
  }, [personaMode, convMode]);

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

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
  };

  const handlePersonaPillClick = (mode: PersonaMode) => {
    if (mode !== personaMode) setPersonaMode(mode);
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
          <Header personaMode={personaMode} convMode={convMode} />
          <Stepper
            stageIndex={stageIndex}
            setStageIndex={(i) => {
              setStageIndex(i);
              setSelection(null);
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
                  personaMode={personaMode}
                  convMode={convMode}
                  sectionById={sectionById}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                overflowY: "auto",
              }}
            >
              {selection ? (
                <DetailPanel
                  selection={selection}
                  sectionById={sectionById}
                  personaMode={personaMode}
                  convMode={convMode}
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
  );
}

// ---------------------------------------------------------------------------
// Header + stepper
// ---------------------------------------------------------------------------

function Header({
  personaMode,
  convMode,
}: {
  personaMode: PersonaMode;
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
          Active: {PERSONA_LABELS[personaMode]} · {MODE_LABELS[convMode]}
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
        How Jove&rsquo;s system prompt is assembled, layer by layer. The
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
        inspect its source path, token count, and rendered text.
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
// Right column — stage caption or detail panel
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
        Click any band, pill, or block to inspect its source.
      </p>
    </>
  );
}

function DetailPanel({
  selection,
  sectionById,
  personaMode,
  convMode,
  onClose,
}: {
  selection: Selection;
  sectionById: Map<string, PromptSection>;
  personaMode: PersonaMode;
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
        activeMode={personaMode}
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
        ← Back to stage
      </button>
    </div>
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
          {section.text}
        </pre>
      )}
    </>
  );
}

function PersonaDetail({
  mode,
  activeMode,
  sectionById,
  onClose,
}: {
  mode: PersonaMode;
  activeMode: PersonaMode;
  sectionById: Map<string, PromptSection>;
  onClose: () => void;
}) {
  const isActive = mode === activeMode;
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
        {PERSONA_LABELS[isActive ? activeMode : mode]}.
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
  personaMode: PersonaMode;
  convMode: ConversationMode;
  sectionById: Map<string, PromptSection>;
}

function Diagram({
  visible,
  selection,
  onSelect,
  onPersonaPill,
  onModePill,
  personaMode,
  convMode,
  sectionById,
}: DiagramProps) {
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
        <DynamicSidecar
          selection={selection}
          onSelect={onSelect}
          sectionById={sectionById}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <CacheWrap active={visible.cache}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PromptHeader
              visible={visible.atom}
              selected={selection?.kind === "overview"}
              onSelect={() => onSelect({ kind: "overview" })}
            />
            {visible.spine && (
              <SpineBands
                selection={selection}
                onSelect={onSelect}
                sectionById={sectionById}
              />
            )}
            {visible.persona && (
              <PersonaFan
                selection={selection}
                onPersonaPill={onPersonaPill}
                personaMode={personaMode}
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
              />
            )}
          </div>
        </CacheWrap>
        {visible.example && (
          <ExampleAssemblyFooter
            sectionById={sectionById}
            personaMode={personaMode}
            convMode={convMode}
          />
        )}
      </div>
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

function SectionBand({
  sectionId,
  selection,
  onSelect,
  sectionById,
  bg,
  border,
  fg,
}: {
  sectionId: string;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
  bg: string;
  border: string;
  fg?: string;
}) {
  const section = sectionById.get(sectionId);
  if (!section) return null;
  const selected =
    selection?.kind === "section" && selection.id === sectionId;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "section", id: sectionId })}
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
          {section.label}
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
          {section.tokens.toLocaleString()} tok · {section.condition.label}
        </span>
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
  // Tier 1 + every Tier 2 section that's truly base (always-on).
  const t1Ids = ["intro", "tier1"];
  const t2BaseIds = Array.from(BASE_VOICE_IDS);
  return (
    <>
      {t1Ids.map((id) => (
        <SectionBand
          key={id}
          sectionId={id}
          selection={selection}
          onSelect={onSelect}
          sectionById={sectionById}
          bg={COLOR.identityBg}
          border={COLOR.identityBorder}
        />
      ))}
      {t2BaseIds.map((id) => (
        <SectionBand
          key={id}
          sectionId={id}
          selection={selection}
          onSelect={onSelect}
          sectionById={sectionById}
          bg={COLOR.baseVoice}
          border={COLOR.baseVoiceBorder}
        />
      ))}
    </>
  );
}

function PersonaFan({
  selection,
  onPersonaPill,
  personaMode,
}: {
  selection: Selection | null;
  onPersonaPill: (mode: PersonaMode) => void;
  personaMode: PersonaMode;
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
          1 of 4 · click to switch
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
          const isActive = p === personaMode;
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
          1 of 3 · click to switch
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
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  sectionById: Map<string, PromptSection>;
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
                  color: "var(--session-ink)",
                  fontWeight: 500,
                }}
              >
                {s.label}
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
                {s.label}
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
        the prompt at turn N+1 — a one-turn lag.
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

function ExampleAssemblyFooter({
  sectionById,
  personaMode,
  convMode,
}: {
  sectionById: Map<string, PromptSection>;
  personaMode: PersonaMode;
  convMode: ConversationMode;
}) {
  // Group sections by cache tier (derived from tier + condition).
  type Bucket = { label: string; tokens: number; tier: "static" | "persona" | "dynamic" };
  const buckets: Record<string, Bucket> = {
    "tier1-static": { label: "Tier 1 + Introduction", tokens: 0, tier: "static" },
    "tier2-base": { label: "Tier 2 base voice (always-on)", tokens: 0, tier: "static" },
    "tier2-persona": { label: `Tier 2 persona delta (${PERSONA_LABELS[personaMode]})`, tokens: 0, tier: "persona" },
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
          Token budget — {PERSONA_LABELS[personaMode]} · {MODE_LABELS[convMode]}
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

