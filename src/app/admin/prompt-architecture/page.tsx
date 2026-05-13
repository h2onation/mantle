"use client";

import {
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

const TIER_LABELS: Record<Tier, string> = {
  intro: "Introduction",
  "1": "Tier 1",
  "2": "Tier 2",
  "3": "Tier 3",
  dynamic: "Dynamic",
};

// ---------------------------------------------------------------------------
// Absent section — sections present in other phases but not this one
// ---------------------------------------------------------------------------

interface AbsentSection {
  id: string;
  label: string;
  tier: Tier;
  presentIn: string[];
  condition: { type: ConditionType; label: string };
}

function computeAbsentSections(
  currentPhase: PhaseData,
  allPhases: PhaseData[],
): AbsentSection[] {
  const currentIds = new Set(currentPhase.sections.map((s) => s.id));
  const absent: AbsentSection[] = [];
  const seen = new Set<string>();

  for (const phase of allPhases) {
    if (phase.id === currentPhase.id) continue;
    for (const section of phase.sections) {
      if (!currentIds.has(section.id) && !seen.has(section.id)) {
        seen.add(section.id);
        const presentIn = allPhases
          .filter((p) => p.sections.some((s) => s.id === section.id))
          .map((p) => p.label.replace(/^Phase \d+ — /, ""));
        absent.push({
          id: section.id,
          label: section.label,
          tier: section.tier,
          presentIn,
          condition: section.condition,
        });
      }
    }
  }

  return absent;
}

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
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const phaseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (phases && phases.length > 0 && !activePhase) {
      setActivePhase(phases[0].id);
    }
  }, [phases, activePhase]);

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
    setActivePhase(phaseId);
    phaseRefs.current[phaseId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (!isAdmin) {
    return (
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-meta)",
        color: "var(--session-ink-ghost)",
        letterSpacing: "1px",
        padding: "80px 24px",
        textAlign: "center",
      }}>
        Not authorized.
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--session-linen)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Sticky header ─────────────────────────────────────── */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--session-linen)",
        borderBottom: "1px solid var(--session-ink-hairline)",
        padding: "20px 40px 16px",
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-walnut-meta)",
              marginBottom: 6,
            }}>
              System Prompt Reference
            </div>
            <h1 style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "26px",
              fontWeight: 400,
              fontStyle: "italic",
              color: "var(--session-ink)",
              margin: 0,
              letterSpacing: "-0.3px",
            }}>
              Jove Prompt Architecture
            </h1>
          </div>
          <a
            href="/admin"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              letterSpacing: "1.5px",
              textDecoration: "none",
              textTransform: "uppercase",
              padding: "6px 12px",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 4,
            }}
          >
            ← Admin
          </a>
        </div>

        {/* Controls row */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}>
          {/* Persona */}
          <ControlGroup label="Persona">
            {PERSONA_OPTIONS.map((p) => {
              const active = personaModes.includes(p.id);
              return (
                <ToggleChip
                  key={p.id}
                  active={active}
                  onClick={() => handlePersonaToggle(p.id)}
                  accentVar="--session-walnut"
                >
                  {p.label}
                </ToggleChip>
              );
            })}
          </ControlGroup>

          {/* Conv mode */}
          <ControlGroup label="Mode">
            {CONV_MODE_OPTIONS.map((cm) => {
              const active = convMode === cm.id;
              return (
                <ToggleChip
                  key={cm.id}
                  active={active}
                  onClick={() => handleConvModeChange(cm.id)}
                  accentVar="--session-persona"
                >
                  {cm.label}
                </ToggleChip>
              );
            })}
          </ControlGroup>

          {/* Phase nav */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            {(phases ?? []).map((p, i) => (
              <button
                key={p.id}
                onClick={() => scrollToPhase(p.id)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  color: activePhase === p.id
                    ? "var(--session-ink)"
                    : "var(--session-ink-ghost)",
                  background: activePhase === p.id
                    ? "var(--session-walnut-surface)"
                    : "transparent",
                  border: "none",
                  borderRadius: 4,
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontWeight: activePhase === p.id ? 500 : 400,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <main
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 40px 120px",
        }}
      >
        {loading && !phases && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-ink-ghost)",
            textAlign: "center",
            marginTop: 80,
            letterSpacing: "1px",
          }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-error)",
            textAlign: "center",
            marginTop: 80,
          }}>
            Error: {error}
          </div>
        )}
        {phases &&
          phases.map((phase) => (
            <PhaseBlock
              key={phase.id}
              phase={phase}
              allPhases={phases}
              ref={(el) => {
                phaseRefs.current[phase.id] = el;
              }}
            />
          ))}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Control group + toggle chip
// ---------------------------------------------------------------------------

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "2px",
        textTransform: "uppercase",
        color: "var(--session-ink-ghost)",
        marginRight: 4,
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  accentVar,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accentVar: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: active ? 500 : 400,
        color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
        background: active ? `var(${accentVar}-surface, var(--session-walnut-surface))` : "transparent",
        border: `1px solid ${active ? `var(${accentVar}-border, var(--session-walnut-border))` : "var(--session-ink-hairline)"}`,
        borderRadius: 4,
        padding: "4px 12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Phase block
// ---------------------------------------------------------------------------

const PhaseBlock = forwardRef<
  HTMLDivElement,
  { phase: PhaseData; allPhases: PhaseData[] }
>(function PhaseBlock({ phase, allPhases }, ref) {
  const absentSections = useMemo(
    () => computeAbsentSections(phase, allPhases),
    [phase, allPhases],
  );

  return (
    <div ref={ref} style={{ marginTop: 48, scrollMarginTop: 160 }}>
      {/* Phase heading */}
      <div style={{
        borderBottom: "1px solid var(--session-ink-hairline)",
        paddingBottom: 12,
        marginBottom: 24,
      }}>
        <h2 style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "20px",
          fontWeight: 400,
          color: "var(--session-ink)",
          margin: 0,
          letterSpacing: "-0.2px",
        }}>
          {phase.label}
        </h2>
        <p style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink-faded)",
          margin: "6px 0 0",
          lineHeight: 1.5,
        }}>
          {phase.description}
        </p>
      </div>

      {/* Sections */}
      {phase.sections.map((section) => (
        <SectionRow key={section.id} section={section} />
      ))}

      {/* Absent sections */}
      {absentSections.length > 0 && (
        <div style={{ marginTop: 20, marginBottom: 8 }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
            marginBottom: 10,
            paddingTop: 12,
            borderTop: "1px dashed var(--session-ink-hairline)",
          }}>
            Not active in this phase
          </div>
          {absentSections.map((abs) => (
            <AbsentRow key={abs.id} section={abs} />
          ))}
        </div>
      )}

      {/* Phase footer */}
      <PhaseFooter phase={phase} />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Section row — manuscript layout with margin annotations
// ---------------------------------------------------------------------------

function SectionRow({ section }: { section: PromptSection }) {
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 5;

  return (
    <>
      <div style={{
        display: "flex",
        gap: 0,
        marginBottom: 1,
      }}>
        {/* Tier indicator — thin vertical rule */}
        <div style={{
          width: 3,
          flexShrink: 0,
          background: tierColor(section.tier),
          borderRadius: "2px 0 0 2px",
        }} />

        {/* ── Main column ─────────────────────────────────────── */}
        <div style={{
          flex: "1 1 62%",
          padding: "14px 20px 14px 16px",
          minWidth: 0,
          background: "var(--session-walnut-surface-soft)",
        }}>
          {/* Section header */}
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: tierColor(section.tier),
              fontWeight: 600,
            }}>
              {section.label}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
            }}>
              {TIER_LABELS[section.tier]}
            </span>
          </div>

          {/* Prompt text */}
          <div style={{ position: "relative" }}>
            <pre style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.65,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              maxHeight: expanded || !needsTruncation ? "none" : "5.5em",
              overflow: "hidden",
            }}>
              {section.text}
            </pre>

            {needsTruncation && !expanded && (
              <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 48,
                background: "linear-gradient(transparent, var(--session-linen))",
                pointerEvents: "none",
              }} />
            )}
          </div>

          {needsTruncation && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.5px",
                color: "var(--session-walnut-meta)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 0 0",
              }}
            >
              {expanded ? "▴ Collapse" : "▾ Show full text"}
            </button>
          )}
        </div>

        {/* ── Margin column ───────────────────────────────────── */}
        <div style={{
          flex: "0 0 280px",
          padding: "14px 16px",
          borderLeft: "1px solid var(--session-ink-hairline)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {/* Token count + condition */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--session-ink-faded)",
              fontWeight: 500,
            }}>
              {section.tokens.toLocaleString()} tok
            </span>
            <ConditionPill condition={section.condition} />
          </div>

          {/* Source reference */}
          <button
            onClick={() => setInfoOpen(true)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textAlign: "left",
              textDecoration: "underline",
              textDecorationColor: "var(--session-ink-hairline)",
              textUnderlineOffset: "3px",
            }}
          >
            {section.source.file}
          </button>

          {/* Alternatives */}
          {section.alternatives.length > 0 && (
            <div>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
                marginBottom: 5,
              }}>
                Alternatives
              </div>
              {section.alternatives.map((alt, i) => (
                <div key={i} style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--session-ink-faded)",
                  lineHeight: 1.4,
                  marginBottom: 3,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}>
                  <span>{alt.label}</span>
                  {alt.tokens > 0 && (
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: "var(--session-ink-ghost)",
                      flexShrink: 0,
                    }}>
                      {alt.tokens.toLocaleString()}t
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {infoOpen && (
        <InfoModal section={section} onClose={() => setInfoOpen(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Absent section row — ghosted entry for sections not in this phase
// ---------------------------------------------------------------------------

function AbsentRow({ section }: { section: AbsentSection }) {
  return (
    <div style={{
      display: "flex",
      gap: 0,
      marginBottom: 1,
      opacity: 0.45,
    }}>
      <div style={{
        width: 3,
        flexShrink: 0,
        background: tierColor(section.tier),
        borderRadius: "2px 0 0 2px",
      }} />
      <div style={{
        flex: 1,
        padding: "10px 20px 10px 16px",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "1px dashed var(--session-ink-hairline)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: tierColor(section.tier),
          }}>
            {section.label}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--session-ink-ghost)",
          }}>
            {TIER_LABELS[section.tier]}
          </span>
        </div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          color: "var(--session-ink-ghost)",
          fontStyle: "italic",
          textAlign: "right",
          flexShrink: 0,
        }}>
          Active in: {section.presentIn.join(", ")}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition pill
// ---------------------------------------------------------------------------

function ConditionPill({ condition }: { condition: { type: ConditionType; label: string } }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "9px",
      letterSpacing: "0.5px",
      color: conditionColor(condition.type),
      border: `1px solid ${conditionBorder(condition.type)}`,
      borderRadius: 3,
      padding: "1px 6px",
    }}>
      {condition.label}
    </span>
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--session-linen)",
          borderRadius: 8,
          border: "1px solid var(--session-walnut-border)",
          maxWidth: 760,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}>
            <div>
              <h3 style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "18px",
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--session-ink)",
                margin: 0,
              }}>
                {section.label}
              </h3>
              <div style={{
                display: "flex",
                gap: 16,
                marginTop: 8,
                alignItems: "center",
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--session-ink-faded)",
                }}>
                  {section.source.file}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--session-ink-ghost)",
                }}>
                  → {section.source.symbol}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "16px",
                color: "var(--session-ink-ghost)",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Metadata row */}
          <div style={{
            display: "flex",
            gap: 10,
            marginTop: 12,
            alignItems: "center",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--session-ink-faded)",
              fontWeight: 500,
            }}>
              {section.tokens.toLocaleString()} tokens
            </span>
            <ConditionPill condition={section.condition} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: tierColor(section.tier),
              border: `1px solid ${tierColor(section.tier)}`,
              borderRadius: 3,
              padding: "1px 6px",
              opacity: 0.7,
            }}>
              {TIER_LABELS[section.tier]}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>
          <pre style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.7,
            color: "var(--session-ink-soft)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}>
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
    <div style={{
      marginTop: 20,
      padding: "16px 20px",
      borderTop: "1px solid var(--session-ink-hairline)",
      borderBottom: "1px solid var(--session-ink-hairline)",
    }}>
      <div style={{
        display: "flex",
        gap: 24,
        alignItems: "baseline",
        flexWrap: "wrap",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--session-ink)",
          fontWeight: 500,
        }}>
          {phase.totalTokens.toLocaleString()} tokens
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--session-ink-faded)",
        }}>
          {phase.sections.length} sections
        </span>
        {phase.deltaTokens !== null && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: phase.deltaTokens > 0
              ? "var(--session-persona)"
              : "var(--session-error)",
          }}>
            {phase.deltaTokens > 0 ? "+" : ""}
            {phase.deltaTokens.toLocaleString()} tokens
          </span>
        )}
        {phase.deltaBlocks !== null && phase.deltaBlocks !== 0 && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-faded)",
          }}>
            {phase.deltaBlocks > 0 ? "+" : ""}
            {phase.deltaBlocks} sections
          </span>
        )}
      </div>
      {phase.changes.length > 0 && (
        <div style={{
          marginTop: 10,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}>
          {phase.changes.map((c, i) => (
            <span key={i} style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: c.startsWith("+")
                ? "var(--session-persona)"
                : c.startsWith("−")
                  ? "var(--session-error-text)"
                  : "var(--session-ink-faded)",
              lineHeight: 1.5,
            }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color helpers — using design tokens, not hardcoded values
// ---------------------------------------------------------------------------

function tierColor(tier: Tier): string {
  switch (tier) {
    case "intro":
      return "var(--session-ink-faded)";
    case "1":
      return "var(--session-walnut)";
    case "2":
      return "var(--session-walnut-meta)";
    case "3":
      return "var(--session-persona)";
    case "dynamic":
      return "var(--session-error-text)";
  }
}

function conditionColor(type: ConditionType): string {
  switch (type) {
    case "always":
      return "var(--session-ink-ghost)";
    case "persona":
      return "var(--session-walnut)";
    case "state":
      return "var(--session-persona)";
    case "conv-mode":
      return "var(--session-ink-faded)";
    case "dynamic":
      return "var(--session-error-text)";
  }
}

function conditionBorder(type: ConditionType): string {
  switch (type) {
    case "always":
      return "var(--session-ink-hairline)";
    case "persona":
      return "var(--session-walnut-border)";
    case "state":
      return "var(--session-persona-border)";
    case "conv-mode":
      return "var(--session-ink-hairline)";
    case "dynamic":
      return "var(--session-error-border-soft)";
  }
}
