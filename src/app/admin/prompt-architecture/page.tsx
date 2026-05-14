"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import type {
  PhaseData,
  PromptSection,
  Tier,
  ConditionType,
} from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import type { ConversationMode } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ConvMode = ConversationMode;

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

// Sections that belong to the voice module (persona-dependent)
const VOICE_SECTION_IDS = new Set([
  "tier2-voice",
  "voice-rules",
  "example-register",
  "landing",
  "deepening",
]);

// Sections that are conditional on state, conv-mode, or dynamic injection
const LIFECYCLE_SECTION_IDS = new Set([
  "first-message",
  "guided-intake",
  "upload-mode",
  "returning-user",
  "checkpoints",
  "first-checkpoint",
  "post-rejection",
  "readiness-gate",
  "confirmed-manual",
  "session-context",
  "extraction-brief",
]);

const PHASE_SHORT: Record<string, string> = {
  "phase-1": "New account",
  "phase-2": "First checkpoint",
  "phase-3": "Returning",
  "phase-4": "Returning + checkpoint",
};


// ---------------------------------------------------------------------------
// Categorize sections into the three layers
// ---------------------------------------------------------------------------

interface CategorizedSections {
  foundation: PromptSection[];
  voice: PromptSection[];
  lifecycle: LifecycleBlock[];
  foundationTokens: number;
  voiceTokens: number;
  lifecycleTokens: number;
}

interface LifecycleBlock {
  section: PromptSection;
  presentInPhases: string[];
}

function categorize(phases: PhaseData[]): CategorizedSections {
  // Use phase-1 for foundation and voice (they're the same in all phases)
  const base = phases[0];
  const foundation = base.sections.filter(
    (s) => !VOICE_SECTION_IDS.has(s.id) && !LIFECYCLE_SECTION_IDS.has(s.id),
  );
  const voice = base.sections.filter((s) => VOICE_SECTION_IDS.has(s.id));

  // For lifecycle, collect ALL unique conditional sections across all phases
  const seen = new Map<string, LifecycleBlock>();
  for (const phase of phases) {
    for (const section of phase.sections) {
      if (LIFECYCLE_SECTION_IDS.has(section.id)) {
        if (!seen.has(section.id)) {
          seen.set(section.id, {
            section,
            presentInPhases: [],
          });
        }
        seen.get(section.id)!.presentInPhases.push(
          PHASE_SHORT[phase.id] ?? phase.id,
        );
      }
    }
  }

  const lifecycle = Array.from(seen.values());

  return {
    foundation,
    voice,
    lifecycle,
    foundationTokens: foundation.reduce((s, x) => s + x.tokens, 0),
    voiceTokens: voice.reduce((s, x) => s + x.tokens, 0),
    lifecycleTokens: lifecycle.reduce((s, x) => s + x.section.tokens, 0),
  };
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

  const data = useMemo(() => (phases ? categorize(phases) : null), [phases]);

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

  if (!isAdmin) {
    return (
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)",
        color: "var(--session-ink-ghost)", letterSpacing: "1px",
        padding: "80px 24px", textAlign: "center",
      }}>
        Not authorized.
      </div>
    );
  }

  const totalTokens = data
    ? data.foundationTokens + data.voiceTokens + data.lifecycleTokens
    : 0;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--session-linen)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Admin banner */}
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)",
        letterSpacing: "2px", textTransform: "uppercase",
        color: "var(--session-error)", textAlign: "center",
        padding: "6px 0", borderBottom: "1px solid var(--session-error-ghost)",
        background: "var(--session-error-banner)", flexShrink: 0,
      }}>
        Read Only — Admin
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="prompt-architecture" />

        {/* Main content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          minWidth: 0, overflow: "hidden",
        }}>
          {/* Controls */}
          <div style={{
            borderBottom: "1px solid var(--session-ink-hairline)",
            padding: "14px 32px", display: "flex", flexWrap: "wrap",
            gap: 16, alignItems: "center", flexShrink: 0,
          }}>
            <div style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "18px", fontWeight: 400, fontStyle: "italic",
              color: "var(--session-ink)", marginRight: 8,
            }}>
              Jove&apos;s prompt architecture
            </div>
            <div style={{ width: 1, height: 20, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Persona">
              {PERSONA_OPTIONS.map((p) => (
                <Chip key={p.id} active={personaModes.includes(p.id)}
                  onClick={() => handlePersonaToggle(p.id)}>{p.label}</Chip>
              ))}
            </ControlGroup>
            <div style={{ width: 1, height: 20, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Mode">
              {CONV_MODE_OPTIONS.map((cm) => (
                <Chip key={cm.id} active={convMode === cm.id}
                  onClick={() => handleConvModeChange(cm.id)}>{cm.label}</Chip>
              ))}
            </ControlGroup>
            {data && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "11px",
                color: "var(--session-ink-ghost)", marginLeft: "auto",
              }}>
                ~{totalTokens.toLocaleString()} tokens total
              </span>
            )}
          </div>

          {/* Scrollable layers */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 80px" }}>
            {loading && !phases && (
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)",
                color: "var(--session-ink-ghost)", textAlign: "center", marginTop: 60,
              }}>
                Loading…
              </div>
            )}
            {error && (
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--size-meta)",
                color: "var(--session-error)", textAlign: "center", marginTop: 60,
              }}>
                Error: {error}
              </div>
            )}
            {data && (
              <>
                <FoundationLayer sections={data.foundation} tokens={data.foundationTokens} />
                <VoiceLayer
                  sections={data.voice}
                  tokens={data.voiceTokens}
                  personaModes={personaModes}
                />
                <LifecycleLayer blocks={data.lifecycle} tokens={data.lifecycleTokens} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LAYER 1: Foundation — always present, never changes
// ---------------------------------------------------------------------------

function FoundationLayer({ sections, tokens }: { sections: PromptSection[]; tokens: number }) {
  const [open, setOpen] = useState(false);
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div style={{ marginBottom: 24 }}>
      <LayerHeader
        number={1}
        title="Foundation"
        subtitle="Always present. Constitutional rules, behavioral guardrails, and conversation mechanics that never change regardless of persona, mode, or user state."
        stats={`${sections.length} sections · ${tokens.toLocaleString()} tokens`}
        color="var(--session-walnut)"
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: "1px solid var(--session-ink-hairline)",
          borderTop: "none", borderRadius: "0 0 8px 8px",
          overflow: "hidden",
        }}>
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} last={i === sections.length - 1} forceExpanded={expandAll} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LAYER 2: Voice — persona-dependent swap module
// ---------------------------------------------------------------------------

function VoiceLayer({
  sections,
  tokens,
  personaModes,
}: {
  sections: PromptSection[];
  tokens: number;
  personaModes: PersonaMode[];
}) {
  const [open, setOpen] = useState(true);
  const [expandAll, setExpandAll] = useState(false);

  // Collect alternatives from the first section that has them
  const alts = sections.find((s) => s.alternatives.length > 0)?.alternatives ?? [];

  const activeLabel = personaModes
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join(" + ");

  return (
    <div style={{ marginBottom: 24 }}>
      <LayerHeader
        number={2}
        title="Voice"
        subtitle={`Currently: ${activeLabel}. These sections define how Jove speaks — tone, rules, examples, conversational patterns. Swap personas above to see how each voice module differs.`}
        stats={`${sections.length} sections · ${tokens.toLocaleString()} tokens`}
        color="var(--session-walnut-meta)"
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: "1px solid var(--session-ink-hairline)",
          borderTop: "none", borderRadius: "0 0 8px 8px",
          overflow: "hidden",
        }}>
          {/* Alternatives bar */}
          {alts.length > 0 && (
            <div style={{
              padding: "10px 20px",
              background: "var(--session-walnut-surface-soft)",
              borderBottom: "1px solid var(--session-ink-hairline)",
              display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "10px",
                letterSpacing: "1.5px", textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
              }}>
                Other voices
              </span>
              {alts.map((alt) => (
                <span key={alt.label} style={{
                  fontFamily: "var(--font-sans)", fontSize: "12px",
                  color: "var(--session-ink-faded)",
                }}>
                  {alt.label}{" "}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: "var(--session-ink-ghost)",
                  }}>
                    {alt.tokens.toLocaleString()}t
                  </span>
                </span>
              ))}
            </div>
          )}
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} last={i === sections.length - 1} forceExpanded={expandAll} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LAYER 3: Lifecycle — conditional blocks based on user journey
// ---------------------------------------------------------------------------

function LifecycleLayer({ blocks, tokens }: { blocks: LifecycleBlock[]; tokens: number }) {
  const [open, setOpen] = useState(true);
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div style={{ marginBottom: 24 }}>
      <LayerHeader
        number={3}
        title="Lifecycle"
        subtitle="Conditional blocks that appear or disappear based on where the user is in their journey. Each block lists which phases include it."
        stats={`${blocks.length} blocks · ${tokens.toLocaleString()} tokens (when all active)`}
        color="var(--session-persona)"
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: "1px solid var(--session-ink-hairline)",
          borderTop: "none", borderRadius: "0 0 8px 8px",
          overflow: "hidden",
        }}>
          {blocks.map((block, i) => (
            <LifecycleCard
              key={block.section.id}
              block={block}
              last={i === blocks.length - 1}
              forceExpanded={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer header
// ---------------------------------------------------------------------------

function LayerHeader({
  number,
  title,
  subtitle,
  stats,
  color,
  open,
  onToggle,
  expandAll,
  onToggleExpandAll,
}: {
  number: number;
  title: string;
  subtitle: string;
  stats: string;
  color: string;
  open: boolean;
  onToggle: () => void;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", gap: 16, alignItems: "flex-start",
        width: "100%", padding: "18px 20px",
        background: open ? "var(--session-walnut-surface)" : "transparent",
        border: `1px solid ${open ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
        borderRadius: open ? "8px 8px 0 0" : 8,
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s ease",
      }}
    >
      {/* Layer number */}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700,
        color, lineHeight: "22px", flexShrink: 0,
      }}>
        {number}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "17px", fontWeight: 400, color: "var(--session-ink)",
          }}>
            {title}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            color: "var(--session-ink-ghost)",
          }}>
            {stats}
          </span>
          {open && onToggleExpandAll && (
            <span
              onClick={(e) => { e.stopPropagation(); onToggleExpandAll(); }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: "10px",
                color: "var(--session-walnut)", cursor: "pointer",
                marginLeft: 4,
              }}
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "12.5px",
          color: "var(--session-ink-faded)", lineHeight: 1.5, marginTop: 4,
          maxWidth: 640,
        }}>
          {subtitle}
        </div>
      </div>

      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "14px",
        color: "var(--session-ink-ghost)", flexShrink: 0, lineHeight: "22px",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}>
        ▾
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section card — a single prompt block (used in Foundation + Voice layers)
// ---------------------------------------------------------------------------

function SectionCard({ section, last, forceExpanded }: { section: PromptSection; last: boolean; forceExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const [infoOpen, setInfoOpen] = useState(false);
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 5;

  return (
    <>
      <div style={{
        padding: "12px 20px",
        borderBottom: last ? "none" : "1px solid var(--session-ink-hairline)",
      }}>
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: tierColor(section.tier), flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            letterSpacing: "0.5px", textTransform: "uppercase",
            color: "var(--session-ink)", fontWeight: 500,
          }}>
            {section.label}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-ink-ghost)",
          }}>
            {section.tokens.toLocaleString()} tok
          </span>
          <button onClick={() => setInfoOpen(true)} title="View full text + source" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-ink-ghost)", background: "none",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 3, padding: "0 5px", cursor: "pointer",
          }}>
            i
          </button>
        </div>

        {/* Preview text */}
        <div style={{ position: "relative" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "12.5px",
            lineHeight: 1.6, color: "var(--session-ink-faded)",
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
            maxHeight: isExpanded || !needsTruncation ? "none" : "4.8em",
            overflow: "hidden",
          }}>
            {section.text}
          </pre>
          {needsTruncation && !isExpanded && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 32,
              background: "linear-gradient(transparent, var(--session-linen))",
              pointerEvents: "none",
            }} />
          )}
        </div>
        {needsTruncation && !forceExpanded && (
          <button onClick={() => setExpanded(!expanded)} style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-walnut)", background: "none",
            border: "none", cursor: "pointer", padding: "4px 0 0",
          }}>
            {expanded ? "▴ Collapse" : "▾ Show full text"}
          </button>
        )}
      </div>
      {infoOpen && <InfoModal section={section} onClose={() => setInfoOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle card — conditional block with phase indicators
// ---------------------------------------------------------------------------

function LifecycleCard({ block, last, forceExpanded }: { block: LifecycleBlock; last: boolean; forceExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const [infoOpen, setInfoOpen] = useState(false);
  const { section, presentInPhases } = block;
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 5;

  return (
    <>
      <div style={{
        padding: "12px 20px",
        borderBottom: last ? "none" : "1px solid var(--session-ink-hairline)",
      }}>
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: tierColor(section.tier), flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            letterSpacing: "0.5px", textTransform: "uppercase",
            color: "var(--session-ink)", fontWeight: 500,
          }}>
            {section.label}
          </span>
          <ConditionPill condition={section.condition} />
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-ink-ghost)",
          }}>
            {section.tokens.toLocaleString()} tok
          </span>
          <button onClick={() => setInfoOpen(true)} title="View full text + source" style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-ink-ghost)", background: "none",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 3, padding: "0 5px", cursor: "pointer",
          }}>
            i
          </button>
        </div>

        {/* Phase indicators */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 8, paddingLeft: 14,
          alignItems: "center",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-ink-ghost)",
          }}>
            Active in:
          </span>
          {presentInPhases.map((p) => (
            <span key={p} style={{
              fontFamily: "var(--font-sans)", fontSize: "11px",
              color: "var(--session-persona)",
              background: "var(--session-persona-surface, rgba(100,130,100,0.1))",
              borderRadius: 3, padding: "1px 7px",
            }}>
              {p}
            </span>
          ))}
        </div>

        {/* Preview text */}
        <div style={{ position: "relative" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "12.5px",
            lineHeight: 1.6, color: "var(--session-ink-faded)",
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
            maxHeight: isExpanded || !needsTruncation ? "none" : "4.8em",
            overflow: "hidden",
          }}>
            {section.text}
          </pre>
          {needsTruncation && !isExpanded && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 32,
              background: "linear-gradient(transparent, var(--session-linen))",
              pointerEvents: "none",
            }} />
          )}
        </div>
        {needsTruncation && !forceExpanded && (
          <button onClick={() => setExpanded(!expanded)} style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "var(--session-walnut)", background: "none",
            border: "none", cursor: "pointer", padding: "4px 0 0",
          }}>
            {expanded ? "▴ Collapse" : "▾ Show full text"}
          </button>
        )}
      </div>
      {infoOpen && <InfoModal section={section} onClose={() => setInfoOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "10px",
        letterSpacing: "2px", textTransform: "uppercase",
        color: "var(--session-ink-ghost)", marginRight: 2,
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--font-sans)", fontSize: "12px",
      fontWeight: active ? 500 : 400,
      color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
      background: active ? "var(--session-walnut-surface)" : "transparent",
      border: `1px solid ${active ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
      borderRadius: 4, padding: "3px 10px", cursor: "pointer",
      transition: "all 0.15s ease",
    }}>
      {children}
    </button>
  );
}

function ConditionPill({ condition }: { condition: { type: ConditionType; label: string } }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.5px",
      color: conditionColor(condition.type),
      border: `1px solid ${conditionBorder(condition.type)}`,
      borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap",
    }}>
      {condition.label}
    </span>
  );
}

function InfoModal({ section, onClose }: { section: PromptSection; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--session-linen)", borderRadius: 8,
        border: "1px solid var(--session-walnut-border)",
        maxWidth: 720, width: "100%", maxHeight: "80vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 24px 14px",
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "17px", fontWeight: 400, fontStyle: "italic",
                color: "var(--session-ink)", margin: 0,
              }}>
                {section.label}
              </h3>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "11px",
                color: "var(--session-ink-ghost)", marginTop: 6,
              }}>
                {section.source.file} → {section.source.symbol}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: "16px",
              color: "var(--session-ink-ghost)", cursor: "pointer", padding: "4px 8px",
            }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              color: "var(--session-ink-faded)", fontWeight: 500,
            }}>
              {section.tokens.toLocaleString()} tokens
            </span>
            <ConditionPill condition={section.condition} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.7,
            color: "var(--session-ink-soft)", whiteSpace: "pre-wrap",
            wordBreak: "break-word", margin: 0,
          }}>
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
    case "intro": return "var(--session-ink-faded)";
    case "1": return "var(--session-walnut)";
    case "2": return "var(--session-walnut-meta)";
    case "3": return "var(--session-persona)";
    case "dynamic": return "var(--session-error-text)";
  }
}

function conditionColor(type: ConditionType): string {
  switch (type) {
    case "always": return "var(--session-ink-ghost)";
    case "persona": return "var(--session-walnut)";
    case "state": return "var(--session-persona)";
    case "conv-mode": return "var(--session-ink-faded)";
    case "dynamic": return "var(--session-error-text)";
  }
}

function conditionBorder(type: ConditionType): string {
  switch (type) {
    case "always": return "var(--session-ink-hairline)";
    case "persona": return "var(--session-walnut-border)";
    case "state": return "var(--session-persona-border)";
    case "conv-mode": return "var(--session-ink-hairline)";
    case "dynamic": return "var(--session-error-border-soft)";
  }
}
