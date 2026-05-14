"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
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

const PHASE_LABELS: Record<string, string> = {
  "phase-1": "1",
  "phase-2": "2",
  "phase-3": "3",
  "phase-4": "4",
};

// ---------------------------------------------------------------------------
// Absent section — sections present in other phases but not this one
// ---------------------------------------------------------------------------

interface AbsentSection {
  id: string;
  label: string;
  tier: Tier;
  tokens: number;
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
          tokens: section.tokens,
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
// Admin nav items (mirrors admin/page.tsx SECTIONS + links)
// ---------------------------------------------------------------------------

const NAV_ITEMS: { id: string; label: string; href: string }[] = [
  { id: "users", label: "Users", href: "/admin?section=users" },
  { id: "beta", label: "Beta", href: "/admin?section=beta" },
  { id: "feedback", label: "Feedback", href: "/admin?section=feedback" },
  { id: "health", label: "Health", href: "/admin?section=health" },
  { id: "docs", label: "Docs", href: "/admin/docs" },
  {
    id: "prompt-architecture",
    label: "Prompt Architecture",
    href: "/admin/prompt-architecture",
  },
];

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
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

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

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
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
      {/* ── Admin banner ─────────────────────────────────────── */}
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

      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* ── Admin nav rail ────────────────────────────────────── */}
        <nav
          style={{
            width: 180,
            borderRight: "1px solid var(--session-ink-hairline)",
            padding: "20px 12px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              color: "var(--session-ink-ghost)",
              padding: "4px 12px 10px",
            }}
          >
            ADMIN
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: "block",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color:
                  item.id === "prompt-architecture"
                    ? "var(--session-ink)"
                    : "var(--session-ink-ghost)",
                background:
                  item.id === "prompt-architecture"
                    ? "rgba(255,255,255,0.6)"
                    : "none",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                textDecoration: "none",
                fontWeight: item.id === "prompt-architecture" ? 500 : 400,
              }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ flex: 1 }} />
          <a
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "1px",
              padding: "8px 12px",
              textDecoration: "none",
            }}
          >
            ← EXIT ADMIN
          </a>
        </nav>

        {/* ── Main content area ──────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* ── Controls bar ─────────────────────────────────────── */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "16px 28px",
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              alignItems: "center",
              flexShrink: 0,
              background: "var(--session-linen)",
            }}
          >
            <ControlGroup label="Persona">
              {PERSONA_OPTIONS.map((p) => (
                <ToggleChip
                  key={p.id}
                  active={personaModes.includes(p.id)}
                  onClick={() => handlePersonaToggle(p.id)}
                >
                  {p.label}
                </ToggleChip>
              ))}
            </ControlGroup>

            <div
              style={{
                width: 1,
                height: 20,
                background: "var(--session-ink-hairline)",
              }}
            />

            <ControlGroup label="Mode">
              {CONV_MODE_OPTIONS.map((cm) => (
                <ToggleChip
                  key={cm.id}
                  active={convMode === cm.id}
                  onClick={() => handleConvModeChange(cm.id)}
                >
                  {cm.label}
                </ToggleChip>
              ))}
            </ControlGroup>

            {/* Phase quick-jump */}
            {phases && (
              <>
                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: "var(--session-ink-hairline)",
                    marginLeft: "auto",
                  }}
                />
                <div style={{ display: "flex", gap: 3 }}>
                  {phases.map((p) => {
                    const isOpen = expandedPhases.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePhase(p.id)}
                        title={p.label}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: isOpen
                            ? "var(--session-linen)"
                            : "var(--session-ink-ghost)",
                          background: isOpen
                            ? "var(--session-walnut)"
                            : "transparent",
                          border: `1px solid ${isOpen ? "var(--session-walnut)" : "var(--session-ink-hairline)"}`,
                          borderRadius: 4,
                          padding: "3px 9px",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {PHASE_LABELS[p.id] ?? p.id}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Scrollable phase list ────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 28px 80px",
            }}
          >
            {loading && !phases && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  textAlign: "center",
                  marginTop: 80,
                  letterSpacing: "1px",
                }}
              >
                Loading…
              </div>
            )}
            {error && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-error)",
                  textAlign: "center",
                  marginTop: 80,
                }}
              >
                Error: {error}
              </div>
            )}
            {phases &&
              phases.map((phase, i) => (
                <PhaseAccordion
                  key={phase.id}
                  phase={phase}
                  phaseIndex={i}
                  allPhases={phases}
                  expanded={expandedPhases.has(phase.id)}
                  onToggle={() => togglePhase(phase.id)}
                />
              ))}
          </div>
        </div>
      </div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginRight: 2,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
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
        background: active ? "var(--session-walnut-surface)" : "transparent",
        border: `1px solid ${active ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
        borderRadius: 4,
        padding: "3px 10px",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Phase accordion — collapsed by default, expands to two-column layout
// ---------------------------------------------------------------------------

function PhaseAccordion({
  phase,
  phaseIndex,
  allPhases,
  expanded,
  onToggle,
}: {
  phase: PhaseData;
  phaseIndex: number;
  allPhases: PhaseData[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const absentSections = useMemo(
    () => computeAbsentSections(phase, allPhases),
    [phase, allPhases],
  );

  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${expanded ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
        borderRadius: 8,
        overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* ── Collapsed header row ─────────────────────────────── */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "14px 20px",
          background: expanded
            ? "var(--session-walnut-surface)"
            : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.2s ease",
        }}
      >
        {/* Phase number badge */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 600,
            color: expanded
              ? "var(--session-linen)"
              : "var(--session-ink-ghost)",
            background: expanded
              ? "var(--session-walnut)"
              : "var(--session-ink-hairline)",
            width: 24,
            height: 24,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
        >
          {phaseIndex + 1}
        </span>

        {/* Label + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "15px",
              fontWeight: 400,
              color: "var(--session-ink)",
              letterSpacing: "-0.2px",
            }}
          >
            {phase.label.replace(/^Phase \d+ — /, "")}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              color: "var(--session-ink-ghost)",
              marginTop: 2,
            }}
          >
            {phase.description}
          </div>
        </div>

        {/* Summary stats */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--session-ink-faded)",
            }}
          >
            {phase.totalTokens.toLocaleString()} tok
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
          {phase.deltaTokens !== null && phase.deltaTokens !== 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color:
                  phase.deltaTokens > 0
                    ? "var(--session-persona)"
                    : "var(--session-error-text)",
              }}
            >
              {phase.deltaTokens > 0 ? "+" : ""}
              {phase.deltaTokens.toLocaleString()}
            </span>
          )}
        </div>

        {/* Chevron */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
            color: "var(--session-ink-ghost)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* ── Expanded content: two-column layout ──────────────── */}
      {expanded && (
        <div
          style={{
            display: "flex",
            borderTop: "1px solid var(--session-ink-hairline)",
            minHeight: 300,
          }}
        >
          {/* LEFT: Variable components (absent from this phase) */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: "1px solid var(--session-ink-hairline)",
              background: "var(--session-walnut-surface-soft)",
              overflowY: "auto",
              maxHeight: "70vh",
            }}
          >
            <div
              style={{
                padding: "14px 16px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
                borderBottom: "1px solid var(--session-ink-hairline)",
              }}
            >
              Available Components
            </div>
            {absentSections.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--session-ink-ghost)",
                  fontStyle: "italic",
                }}
              >
                All components active in this phase
              </div>
            ) : (
              absentSections.map((abs) => (
                <SlotCard key={abs.id} section={abs} />
              ))
            )}

            {/* Alternatives for active persona/mode-dependent sections */}
            {phase.sections.some((s) => s.alternatives.length > 0) && (
              <>
                <div
                  style={{
                    padding: "14px 16px 8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--session-ink-ghost)",
                    borderTop: "1px solid var(--session-ink-hairline)",
                    borderBottom: "1px solid var(--session-ink-hairline)",
                    marginTop: 0,
                  }}
                >
                  Swap Alternatives
                </div>
                {phase.sections
                  .filter((s) => s.alternatives.length > 0)
                  .map((s) =>
                    s.alternatives.map((alt, i) => (
                      <div
                        key={`${s.id}-alt-${i}`}
                        style={{
                          padding: "10px 16px",
                          borderBottom:
                            "1px solid var(--session-ink-hairline)",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            color: "var(--session-ink-faded)",
                            marginBottom: 2,
                          }}
                        >
                          {alt.label}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            color: "var(--session-ink-ghost)",
                          }}
                        >
                          {alt.tokens.toLocaleString()} tok · replaces{" "}
                          {s.label}
                        </div>
                      </div>
                    )),
                  )}
              </>
            )}
          </div>

          {/* RIGHT: Active prompt */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: "70vh",
              minWidth: 0,
            }}
          >
            <div
              style={{
                padding: "14px 20px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
                borderBottom: "1px solid var(--session-ink-hairline)",
                position: "sticky",
                top: 0,
                background: "var(--session-linen)",
                zIndex: 2,
              }}
            >
              Active Prompt · {phase.totalTokens.toLocaleString()} tokens
            </div>
            {phase.sections.map((section) => (
              <PromptBlock key={section.id} section={section} />
            ))}

            {/* Phase footer */}
            {phase.changes.length > 0 && (
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--session-ink-hairline)",
                  background: "var(--session-walnut-surface-soft)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--session-ink-ghost)",
                    marginBottom: 8,
                  }}
                >
                  Changes from previous phase
                </div>
                {phase.changes.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: c.startsWith("+")
                        ? "var(--session-persona)"
                        : c.startsWith("−")
                          ? "var(--session-error-text)"
                          : "var(--session-ink-faded)",
                      lineHeight: 1.6,
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot card — an available/absent component in the left column
// ---------------------------------------------------------------------------

function SlotCard({ section }: { section: AbsentSection }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--session-ink-hairline)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 3,
            height: 14,
            borderRadius: 1,
            background: tierColor(section.tier),
            opacity: 0.5,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink-faded)",
            fontWeight: 500,
          }}
        >
          {section.label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--session-ink-ghost)",
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          {section.tokens.toLocaleString()}t
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11px",
          color: "var(--session-ink-ghost)",
          lineHeight: 1.4,
          paddingLeft: 11,
        }}
      >
        <ConditionPill condition={section.condition} />
        <span style={{ marginLeft: 6 }}>
          Active in: {section.presentIn.join(", ")}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt block — a single section card in the active prompt column
// ---------------------------------------------------------------------------

function PromptBlock({ section }: { section: PromptSection }) {
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 6;

  return (
    <>
      <div
        style={{
          padding: "0 20px",
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}
      >
        {/* Section header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 0 8px",
          }}
        >
          {/* Tier color dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: tierColor(section.tier),
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--session-ink)",
              fontWeight: 600,
            }}
          >
            {section.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
            }}
          >
            {TIER_LABELS[section.tier]}
          </span>

          <div style={{ flex: 1 }} />

          {/* Token + condition */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
            }}
          >
            {section.tokens.toLocaleString()} tok
          </span>
          <ConditionPill condition={section.condition} />

          {/* Info button */}
          <button
            onClick={() => setInfoOpen(true)}
            title="View full text + source"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--session-ink-ghost)",
              background: "none",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 4,
              padding: "1px 6px",
              cursor: "pointer",
            }}
          >
            i
          </button>
        </div>

        {/* Prompt text */}
        <div style={{ position: "relative", paddingBottom: 10 }}>
          <pre
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              lineHeight: 1.65,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              maxHeight:
                expanded || !needsTruncation ? "none" : "6.2em",
              overflow: "hidden",
            }}
          >
            {section.text}
          </pre>

          {needsTruncation && !expanded && (
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 0,
                right: 0,
                height: 40,
                background:
                  "linear-gradient(transparent, var(--session-linen))",
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
              color: "var(--session-walnut)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 0 10px",
            }}
          >
            {expanded ? "▴ Collapse" : "▾ Show full text"}
          </button>
        )}
      </div>

      {infoOpen && (
        <InfoModal section={section} onClose={() => setInfoOpen(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Condition pill
// ---------------------------------------------------------------------------

function ConditionPill({
  condition,
}: {
  condition: { type: ConditionType; label: string };
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.5px",
        color: conditionColor(condition.type),
        border: `1px solid ${conditionBorder(condition.type)}`,
        borderRadius: 3,
        padding: "1px 6px",
        whiteSpace: "nowrap",
      }}
    >
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
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--session-ink-hairline)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: "18px",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "var(--session-ink)",
                  margin: 0,
                }}
              >
                {section.label}
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--session-ink-faded)",
                  }}
                >
                  {section.source.file}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--session-ink-ghost)",
                  }}
                >
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

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--session-ink-faded)",
                fontWeight: 500,
              }}
            >
              {section.tokens.toLocaleString()} tokens
            </span>
            <ConditionPill condition={section.condition} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: tierColor(section.tier),
                border: `1px solid ${tierColor(section.tier)}`,
                borderRadius: 3,
                padding: "1px 6px",
                opacity: 0.7,
              }}
            >
              {TIER_LABELS[section.tier]}
            </span>
          </div>
        </div>

        {/* Body */}
        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}
        >
          <pre
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.7,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
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
// Color helpers
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
