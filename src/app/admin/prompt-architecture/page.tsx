"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import type {
  PhaseData,
  PromptSection,
  Tier,
  ConditionType,
} from "@/lib/admin/prompt-sections";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type PersonaMode = "autistic" | "audhd" | "dyslexic" | "general";
type ConvMode = "situation" | "guided-intake" | "upload";

const PERSONA_OPTIONS: { id: PersonaMode; label: string }[] = [
  { id: "autistic", label: "Autistic" },
  { id: "audhd", label: "AuDHD" },
  { id: "dyslexic", label: "Dyslexic" },
  { id: "general", label: "General" },
];

const CONV_MODE_OPTIONS: { id: ConvMode; label: string }[] = [
  { id: "situation", label: "Standard" },
  { id: "guided-intake", label: "Guided Intake" },
  { id: "upload", label: "Upload" },
];

const TIER_COLORS: Record<Tier, string> = {
  intro: "rgba(100, 140, 200, 0.7)",
  "1": "rgba(140, 100, 70, 0.7)",
  "2": "rgba(196, 154, 60, 0.7)",
  "3": "rgba(90, 138, 106, 0.7)",
  dynamic: "rgba(120, 100, 160, 0.7)",
};

const TIER_BG: Record<Tier, string> = {
  intro: "rgba(100, 140, 200, 0.06)",
  "1": "rgba(140, 100, 70, 0.06)",
  "2": "rgba(196, 154, 60, 0.06)",
  "3": "rgba(90, 138, 106, 0.06)",
  dynamic: "rgba(120, 100, 160, 0.06)",
};

const CONDITION_COLORS: Record<ConditionType, string> = {
  always: "rgba(120, 120, 120, 0.55)",
  persona: "rgba(196, 154, 60, 0.75)",
  state: "rgba(90, 138, 106, 0.75)",
  "conv-mode": "rgba(100, 140, 200, 0.75)",
  dynamic: "rgba(120, 100, 160, 0.75)",
};

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function PromptArchitecturePage() {
  return (
    <Suspense fallback={null}>
      <PromptArchitectureInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function PromptArchitectureInner() {
  const isAdmin = useIsAdmin();
  const [personaModes, setPersonaModes] = useState<PersonaMode[]>(["autistic"]);
  const [convMode, setConvMode] = useState<ConvMode>("situation");
  const [phases, setPhases] = useState<PhaseData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const phaseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchData = useCallback(async (modes: PersonaMode[], cm: ConvMode) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        personaModes: modes.join(","),
        convMode: cm,
      });
      const res = await fetch(`/api/admin/prompt-architecture?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setPhases(json.phases);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData(personaModes, convMode);
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePersonaToggle(mode: PersonaMode) {
    let next: PersonaMode[];
    const neurotypes: PersonaMode[] = ["autistic", "audhd", "dyslexic"];

    if (mode === "general") {
      next = personaModes.includes("general") ? ["autistic"] : ["general"];
    } else {
      if (personaModes.includes(mode)) {
        next = personaModes.filter((m) => m !== mode);
        if (next.length === 0) next = ["autistic"];
      } else {
        next = [...personaModes.filter((m) => neurotypes.includes(m)), mode];
      }
    }

    setPersonaModes(next);
    fetchData(next, convMode);
  }

  function handleConvModeChange(cm: ConvMode) {
    setConvMode(cm);
    fetchData(personaModes, cm);
  }

  function scrollToPhase(phaseId: string) {
    phaseRefs.current[phaseId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--session-linen)",
          borderBottom: "1px solid var(--session-ink-hairline)",
          padding: "16px 32px 12px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h1
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "20px",
              fontWeight: 500,
              color: "var(--session-ink)",
              margin: 0,
            }}
          >
            Jove System Prompt Architecture
          </h1>
          <a
            href="/admin"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "1px",
              textDecoration: "none",
            }}
          >
            ← ADMIN
          </a>
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            margin: "0 0 12px",
            maxWidth: 640,
            lineHeight: 1.5,
          }}
        >
          Live rendering of the Jove system prompt across four lifecycle phases.
          Every section imports directly from the source modules — no copy-pasted text.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          {/* Persona checkboxes */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={controlLabelStyle}>Persona</span>
            {PERSONA_OPTIONS.map((p) => {
              const active = personaModes.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => handlePersonaToggle(p.id)}
                  style={{
                    ...chipStyle,
                    background: active ? "rgba(196, 154, 60, 0.18)" : "transparent",
                    color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
                    borderColor: active ? "rgba(196, 154, 60, 0.4)" : "var(--session-ink-hairline)",
                  }}
                >
                  {active && <span style={{ marginRight: 3 }}>✓</span>}
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Conv mode radio */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={controlLabelStyle}>Mode</span>
            {CONV_MODE_OPTIONS.map((cm) => {
              const active = convMode === cm.id;
              return (
                <button
                  key={cm.id}
                  onClick={() => handleConvModeChange(cm.id)}
                  style={{
                    ...chipStyle,
                    background: active ? "rgba(100, 140, 200, 0.15)" : "transparent",
                    color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
                    borderColor: active ? "rgba(100, 140, 200, 0.4)" : "var(--session-ink-hairline)",
                  }}
                >
                  {cm.label}
                </button>
              );
            })}
          </div>

          {/* Phase nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            {(phases ?? []).map((p, i) => (
              <button
                key={p.id}
                onClick={() => scrollToPhase(p.id)}
                style={{
                  ...chipStyle,
                  fontSize: "10px",
                  color: "var(--session-ink-ghost)",
                  borderColor: "var(--session-ink-hairline)",
                  background: "transparent",
                }}
              >
                Phase {i + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Scrollable body ───────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 32px 80px",
        }}
      >
        {loading && !phases && (
          <div style={{ ...statusStyle, marginTop: 60 }}>Loading prompt data…</div>
        )}
        {error && <div style={{ ...statusStyle, marginTop: 60, color: "var(--session-error)" }}>Error: {error}</div>}
        {phases && phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            ref={(el) => { phaseRefs.current[phase.id] = el; }}
          />
        ))}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase block
// ---------------------------------------------------------------------------

import { forwardRef } from "react";

const PhaseBlock = forwardRef<HTMLDivElement, { phase: PhaseData }>(function PhaseBlock(
  { phase },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{ marginTop: 40, scrollMarginTop: 180 }}
    >
      {/* Phase heading */}
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "17px",
            fontWeight: 500,
            color: "var(--session-ink)",
            margin: 0,
          }}
        >
          {phase.label}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            margin: "4px 0 0",
          }}
        >
          {phase.description}
        </p>
      </div>

      {/* Sections */}
      {phase.sections.map((section) => (
        <SectionRow key={section.id} section={section} />
      ))}

      {/* Phase footer */}
      <PhaseFooter phase={phase} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Section row — main column + margin
// ---------------------------------------------------------------------------

function SectionRow({ section }: { section: PromptSection }) {
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const previewLines = 3;
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > previewLines + 2;

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 2,
          borderLeft: `3px solid ${TIER_COLORS[section.tier]}`,
          background: TIER_BG[section.tier],
          borderRadius: "0 6px 6px 0",
          minHeight: 48,
        }}
      >
        {/* ── Main column ──────────────────────────────────────── */}
        <div style={{ flex: "1 1 65%", padding: "12px 16px", minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: TIER_COLORS[section.tier],
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {section.label}
          </div>

          <div style={{ position: "relative" }}>
            <pre
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                lineHeight: 1.55,
                color: "var(--session-ink)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                maxHeight: expanded || !needsTruncation ? "none" : "4.7em",
                overflow: "hidden",
                opacity: 0.85,
              }}
            >
              {section.text}
            </pre>

            {needsTruncation && !expanded && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  background: `linear-gradient(transparent, ${tierBgSolid(section.tier)})`,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {needsTruncation && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: TIER_COLORS[section.tier],
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0 0",
              }}
            >
              {expanded ? "▴ Collapse" : "▾ Show full text"}
            </button>
          )}
        </div>

        {/* ── Margin column ────────────────────────────────────── */}
        <div
          style={{
            flex: "0 0 35%",
            padding: "12px 14px",
            borderLeft: "1px solid var(--session-ink-hairline)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Token count */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
            }}
          >
            ~{section.tokens.toLocaleString()} tokens
          </span>

          {/* Condition pill */}
          <span
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "#fff",
              background: CONDITION_COLORS[section.condition.type],
              borderRadius: 10,
              padding: "2px 8px",
              alignSelf: "flex-start",
            }}
          >
            {section.condition.label}
          </span>

          {/* Alternatives */}
          {section.alternatives.length > 0 && (
            <div style={{ marginTop: 2 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--session-ink-ghost)",
                  marginBottom: 3,
                }}
              >
                Alternatives
              </div>
              {section.alternatives.map((alt, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    color: "var(--session-ink-ghost)",
                    lineHeight: 1.4,
                    marginBottom: 2,
                  }}
                >
                  {alt.label}
                  {alt.tokens > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", marginLeft: 4 }}>
                      ~{alt.tokens.toLocaleString()}t
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info button */}
          <button
            onClick={() => setInfoOpen(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              background: "none",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              alignSelf: "flex-start",
              marginTop: "auto",
            }}
          >
            ⓘ Info
          </button>
        </div>
      </div>

      {/* ── Info modal ─────────────────────────────────────────── */}
      {infoOpen && (
        <InfoModal section={section} onClose={() => setInfoOpen(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Info modal
// ---------------------------------------------------------------------------

function InfoModal({
  section,
  onClose,
}: {
  section: PromptSection;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--session-linen)",
          borderRadius: 10,
          border: "1px solid var(--session-ink-hairline)",
          maxWidth: 720,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--session-ink-hairline)",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "16px",
                fontWeight: 500,
                color: "var(--session-ink)",
                margin: 0,
              }}
            >
              {section.label}
            </h3>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--session-ink-ghost)",
                }}
              >
                {section.source.file} → {section.source.symbol}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--session-ink-ghost)",
                }}
              >
                ~{section.tokens.toLocaleString()} tokens
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              color: "var(--session-ink-ghost)",
              cursor: "pointer",
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal metadata */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid var(--session-ink-hairline)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "#fff",
              background: CONDITION_COLORS[section.condition.type],
              borderRadius: 10,
              padding: "2px 8px",
            }}
          >
            {section.condition.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.5px",
              color: "#fff",
              background: TIER_COLORS[section.tier],
              borderRadius: 10,
              padding: "2px 8px",
            }}
          >
            Tier {section.tier === "intro" ? "Intro" : section.tier === "dynamic" ? "Dynamic" : section.tier}
          </span>
        </div>

        {/* Modal body — full text */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px" }}>
          <pre
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              lineHeight: 1.6,
              color: "var(--session-ink)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              opacity: 0.9,
            }}
          >
            {section.text}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase footer
// ---------------------------------------------------------------------------

function PhaseFooter({ phase }: { phase: PhaseData }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "12px 16px",
        background: "rgba(0,0,0,0.02)",
        borderRadius: 6,
        border: "1px solid var(--session-ink-hairline)",
      }}
    >
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--session-ink)",
            fontWeight: 500,
          }}
        >
          {phase.totalTokens.toLocaleString()} tokens total
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--session-ink-ghost)",
          }}
        >
          {phase.sections.length} sections
        </span>
        {phase.deltaTokens !== null && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: phase.deltaTokens > 0 ? "rgba(90, 138, 106, 0.9)" : "rgba(196, 100, 60, 0.9)",
            }}
          >
            {phase.deltaTokens > 0 ? "+" : ""}
            {phase.deltaTokens.toLocaleString()} tokens
          </span>
        )}
        {phase.deltaBlocks !== null && phase.deltaBlocks !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--session-ink-ghost)",
            }}
          >
            {phase.deltaBlocks > 0 ? "+" : ""}
            {phase.deltaBlocks} sections
          </span>
        )}
      </div>
      {phase.changes.length > 0 && (
        <ul
          style={{
            margin: "6px 0 0",
            paddingLeft: 16,
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--session-ink-ghost)",
            lineHeight: 1.5,
          }}
        >
          {phase.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const chipStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  letterSpacing: "0.3px",
  border: "1px solid",
  borderRadius: 14,
  padding: "3px 10px",
  cursor: "pointer",
  transition: "all 0.15s",
  background: "transparent",
};

const controlLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--session-ink-ghost)",
  marginRight: 2,
};

const statusStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--session-ink-ghost)",
  textAlign: "center",
  letterSpacing: "0.5px",
};

function tierBgSolid(tier: Tier): string {
  switch (tier) {
    case "intro":
      return "rgba(245, 243, 238, 1)";
    case "1":
      return "rgba(245, 243, 238, 1)";
    case "2":
      return "rgba(247, 244, 238, 1)";
    case "3":
      return "rgba(244, 246, 243, 1)";
    case "dynamic":
      return "rgba(244, 243, 246, 1)";
  }
}
