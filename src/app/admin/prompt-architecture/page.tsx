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
// Per-layer themes — each layer gets a distinct gradient band, border and
// surface tint so the three layers are differentiable at a glance, in the
// same visual idiom as the Manual page's layer header bands.
// ---------------------------------------------------------------------------

interface LayerTheme {
  band: string;          // gradient for the header band
  border: string;        // outer border color
  borderSoft: string;    // inner divider
  numeral: string;       // big numeral color
  accent: string;        // text accent (toggle, links)
  surfaceTint: string;   // very faint card-area background
  surfaceCard: string;   // header background when collapsed
}

const THEMES: Record<1 | 2 | 3, LayerTheme> = {
  1: {
    // Foundation — deep walnut warm (matches the Manual band)
    band:
      "linear-gradient(180deg, rgba(180,125,75,0.46) 0%, rgba(135,88,52,0.34) 100%)",
    border: "var(--session-walnut-border)",
    borderSoft: "var(--session-walnut-border-soft)",
    numeral: "var(--session-walnut-meta)",
    accent: "var(--session-walnut)",
    surfaceTint: "var(--session-walnut-surface-soft)",
    surfaceCard: "var(--session-walnut-surface)",
  },
  2: {
    // Voice — lighter caramel band, distinct from Foundation but still warm
    band:
      "linear-gradient(180deg, rgba(220,170,120,0.40) 0%, rgba(180,135,90,0.28) 100%)",
    border: "var(--session-walnut-border-soft)",
    borderSoft: "var(--session-walnut-border-soft)",
    numeral: "var(--session-walnut-meta-strong, var(--session-walnut-meta))",
    accent: "var(--session-walnut)",
    surfaceTint: "var(--session-walnut-tint)",
    surfaceCard: "var(--session-walnut-surface-soft)",
  },
  3: {
    // Lifecycle — sage, signals "conditional" via color shift
    band:
      "linear-gradient(180deg, rgba(156,177,138,0.44) 0%, rgba(94,122,79,0.32) 100%)",
    border: "var(--session-persona-border)",
    borderSoft: "var(--session-persona-border)",
    numeral: "var(--session-persona)",
    accent: "var(--session-persona)",
    surfaceTint: "var(--session-persona-tint)",
    surfaceCard: "var(--session-persona-muted)",
  },
};

const LAYER_ROMAN = ["", "I", "II", "III"] as const;


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
            padding: "18px 32px", display: "flex", flexWrap: "wrap",
            gap: 18, alignItems: "center", flexShrink: 0,
          }}>
            <div style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "22px", fontWeight: 400, fontStyle: "italic",
              color: "var(--session-ink)", marginRight: 8,
              letterSpacing: "-0.005em",
            }}>
              Jove&apos;s prompt architecture
            </div>
            <div style={{ width: 1, height: 22, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Persona">
              {PERSONA_OPTIONS.map((p) => (
                <Chip key={p.id} active={personaModes.includes(p.id)}
                  onClick={() => handlePersonaToggle(p.id)}>{p.label}</Chip>
              ))}
            </ControlGroup>
            <div style={{ width: 1, height: 22, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Mode">
              {CONV_MODE_OPTIONS.map((cm) => (
                <Chip key={cm.id} active={convMode === cm.id}
                  onClick={() => handleConvModeChange(cm.id)}>{cm.label}</Chip>
              ))}
            </ControlGroup>
            {data && (
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "12px",
                color: "var(--session-ink-ghost)", marginLeft: "auto",
                letterSpacing: "0.5px",
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
  const theme = THEMES[1];

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={1}
        title="Foundation"
        subtitle="Always present. Constitutional rules, behavioral guardrails, and conversation mechanics that never change regardless of persona, mode, or user state."
        stats={`${sections.length} sections · ${tokens.toLocaleString()} tokens`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: `1px solid ${theme.border}`,
          borderTop: "none", borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: theme.surfaceTint,
        }}>
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} last={i === sections.length - 1} forceExpanded={expandAll} theme={theme} />
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
  const theme = THEMES[2];

  // Collect alternatives from the first section that has them
  const alts = sections.find((s) => s.alternatives.length > 0)?.alternatives ?? [];

  const activeLabel = personaModes
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join(" + ");

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={2}
        title="Voice"
        subtitle={`Currently: ${activeLabel}. These sections define how Jove speaks — tone, rules, examples, conversational patterns. Swap personas above to see how each voice module differs.`}
        stats={`${sections.length} sections · ${tokens.toLocaleString()} tokens`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: `1px solid ${theme.border}`,
          borderTop: "none", borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: theme.surfaceTint,
        }}>
          {/* Alternatives bar */}
          {alts.length > 0 && (
            <div style={{
              padding: "12px 22px",
              background: theme.surfaceCard,
              borderBottom: `1px solid ${theme.borderSoft}`,
              display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "11px",
                letterSpacing: "2px", textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
              }}>
                Other voices
              </span>
              {alts.map((alt) => (
                <span key={alt.label} style={{
                  fontFamily: "var(--font-sans)", fontSize: "13px",
                  color: "var(--session-ink-faded)",
                }}>
                  {alt.label}{" "}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "11px",
                    color: "var(--session-ink-ghost)",
                    marginLeft: 2,
                  }}>
                    {alt.tokens.toLocaleString()}t
                  </span>
                </span>
              ))}
            </div>
          )}
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} last={i === sections.length - 1} forceExpanded={expandAll} theme={theme} />
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
  const theme = THEMES[3];

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={3}
        title="Lifecycle"
        subtitle="Conditional blocks that appear or disappear based on where the user is in their journey. Each block lists which phases include it."
        stats={`${blocks.length} blocks · ${tokens.toLocaleString()} tokens (when all active)`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
        expandAll={expandAll}
        onToggleExpandAll={() => setExpandAll(!expandAll)}
      />
      {open && (
        <div style={{
          border: `1px solid ${theme.border}`,
          borderTop: "none", borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: theme.surfaceTint,
        }}>
          {blocks.map((block, i) => (
            <LifecycleCard
              key={block.section.id}
              block={block}
              last={i === blocks.length - 1}
              forceExpanded={expandAll}
              theme={theme}
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
  theme,
  open,
  onToggle,
  expandAll,
  onToggleExpandAll,
}: {
  number: 1 | 2 | 3;
  title: string;
  subtitle: string;
  stats: string;
  theme: LayerTheme;
  open: boolean;
  onToggle: () => void;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", gap: 18, alignItems: "flex-start",
        width: "100%", padding: "20px 24px 18px",
        background: theme.band,
        border: `1px solid ${theme.border}`,
        borderBottom: open ? `1px solid ${theme.border}` : `1px solid ${theme.border}`,
        borderRadius: open ? "10px 10px 0 0" : 10,
        cursor: "pointer", textAlign: "left",
        transition: "border-radius 0.15s ease",
        boxShadow: open ? "inset 0 -1px 0 rgba(0,0,0,0.04)" : "none",
      }}
    >
      {/* Layer numeral — Roman, serif, color-coded */}
      <span style={{
        fontFamily: "var(--font-spectral, var(--font-serif))",
        fontStyle: "italic",
        fontSize: "20px", fontWeight: 500,
        color: theme.numeral, lineHeight: "26px", flexShrink: 0,
        minWidth: 22, textAlign: "left",
      }}>
        {LAYER_ROMAN[number]}.
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "22px", fontWeight: 500, color: "var(--session-ink)",
            letterSpacing: "-0.005em", lineHeight: 1.15,
          }}>
            {title}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "12px",
            letterSpacing: "0.5px",
            color: "var(--session-ink-faded)",
          }}>
            {stats}
          </span>
          {open && onToggleExpandAll && (
            <span
              onClick={(e) => { e.stopPropagation(); onToggleExpandAll(); }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: "11px",
                letterSpacing: "1px", textTransform: "uppercase",
                color: theme.accent, cursor: "pointer",
                marginLeft: 4, padding: "2px 8px",
                border: `1px solid ${theme.borderSoft}`,
                borderRadius: 3,
              }}
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: "14px",
          color: "var(--session-ink-soft)", lineHeight: 1.55, marginTop: 6,
          maxWidth: 720,
        }}>
          {subtitle}
        </div>
      </div>

      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "16px",
        color: theme.accent, flexShrink: 0, lineHeight: "26px",
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

function SectionCard({ section, last, forceExpanded, theme }: { section: PromptSection; last: boolean; forceExpanded?: boolean; theme: LayerTheme }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const [infoOpen, setInfoOpen] = useState(false);
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 5;

  return (
    <>
      <div style={{
        padding: "16px 22px",
        borderBottom: last ? "none" : `1px solid ${theme.borderSoft}`,
      }}>
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: tierColor(section.tier), flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "12.5px",
            letterSpacing: "0.5px",
            color: "var(--session-ink)", fontWeight: 500,
          }}>
            {section.label}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11.5px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.3px",
          }}>
            {section.tokens.toLocaleString()} tok
          </span>
          <button onClick={() => setInfoOpen(true)} title="View full text + source" style={{
            fontFamily: "var(--font-spectral, var(--font-serif))", fontSize: "12px",
            fontStyle: "italic", fontWeight: 500,
            color: theme.accent, background: "none",
            border: `1px solid ${theme.borderSoft}`,
            borderRadius: "50%", width: 20, height: 20, lineHeight: "16px",
            padding: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            i
          </button>
        </div>

        {/* Preview text */}
        <div style={{ position: "relative" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "14px",
            lineHeight: 1.65, color: "var(--session-ink-soft)",
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
            maxHeight: isExpanded || !needsTruncation ? "none" : "5.5em",
            overflow: "hidden",
          }}>
            {section.text}
          </pre>
          {needsTruncation && !isExpanded && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 36,
              background: `linear-gradient(transparent, ${theme.surfaceTint})`,
              pointerEvents: "none",
            }} />
          )}
        </div>
        {needsTruncation && !forceExpanded && (
          <button onClick={() => setExpanded(!expanded)} style={{
            fontFamily: "var(--font-mono)", fontSize: "11.5px",
            letterSpacing: "0.5px",
            color: theme.accent, background: "none",
            border: "none", cursor: "pointer", padding: "8px 0 0",
          }}>
            {expanded ? "▴ Collapse" : "▾ Show full text"}
          </button>
        )}
      </div>
      {infoOpen && <InfoModal section={section} onClose={() => setInfoOpen(false)} theme={theme} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle card — conditional block with phase indicators
// ---------------------------------------------------------------------------

function LifecycleCard({ block, last, forceExpanded, theme }: { block: LifecycleBlock; last: boolean; forceExpanded?: boolean; theme: LayerTheme }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const [infoOpen, setInfoOpen] = useState(false);
  const { section, presentInPhases } = block;
  const lines = section.text.split("\n");
  const needsTruncation = lines.length > 5;

  return (
    <>
      <div style={{
        padding: "16px 22px",
        borderBottom: last ? "none" : `1px solid ${theme.borderSoft}`,
      }}>
        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: tierColor(section.tier), flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "12.5px",
            letterSpacing: "0.5px",
            color: "var(--session-ink)", fontWeight: 500,
          }}>
            {section.label}
          </span>
          <ConditionPill condition={section.condition} />
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11.5px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.3px",
          }}>
            {section.tokens.toLocaleString()} tok
          </span>
          <button onClick={() => setInfoOpen(true)} title="View full text + source" style={{
            fontFamily: "var(--font-spectral, var(--font-serif))", fontSize: "12px",
            fontStyle: "italic", fontWeight: 500,
            color: theme.accent, background: "none",
            border: `1px solid ${theme.borderSoft}`,
            borderRadius: "50%", width: 20, height: 20, lineHeight: "16px",
            padding: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            i
          </button>
        </div>

        {/* Phase indicators */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 12, paddingLeft: 17,
          alignItems: "center", flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "11px",
            letterSpacing: "1px", textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}>
            Active in
          </span>
          {presentInPhases.map((p) => (
            <span key={p} style={{
              fontFamily: "var(--font-sans)", fontSize: "12px",
              color: theme.accent,
              background: theme.surfaceCard,
              border: `1px solid ${theme.borderSoft}`,
              borderRadius: 3, padding: "2px 8px",
            }}>
              {p}
            </span>
          ))}
        </div>

        {/* Preview text */}
        <div style={{ position: "relative" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "14px",
            lineHeight: 1.65, color: "var(--session-ink-soft)",
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
            maxHeight: isExpanded || !needsTruncation ? "none" : "5.5em",
            overflow: "hidden",
          }}>
            {section.text}
          </pre>
          {needsTruncation && !isExpanded && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 36,
              background: `linear-gradient(transparent, ${theme.surfaceTint})`,
              pointerEvents: "none",
            }} />
          )}
        </div>
        {needsTruncation && !forceExpanded && (
          <button onClick={() => setExpanded(!expanded)} style={{
            fontFamily: "var(--font-mono)", fontSize: "11.5px",
            letterSpacing: "0.5px",
            color: theme.accent, background: "none",
            border: "none", cursor: "pointer", padding: "8px 0 0",
          }}>
            {expanded ? "▴ Collapse" : "▾ Show full text"}
          </button>
        )}
      </div>
      {infoOpen && <InfoModal section={section} onClose={() => setInfoOpen(false)} theme={theme} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "11px",
        letterSpacing: "2px", textTransform: "uppercase",
        color: "var(--session-ink-ghost)", marginRight: 4,
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
      fontFamily: "var(--font-sans)", fontSize: "13px",
      fontWeight: active ? 500 : 400,
      color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
      background: active ? "var(--session-walnut-surface)" : "transparent",
      border: `1px solid ${active ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
      borderRadius: 4, padding: "4px 12px", cursor: "pointer",
      transition: "all 0.15s ease",
    }}>
      {children}
    </button>
  );
}

function ConditionPill({ condition }: { condition: { type: ConditionType; label: string } }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: "0.5px",
      color: conditionColor(condition.type),
      border: `1px solid ${conditionBorder(condition.type)}`,
      borderRadius: 3, padding: "2px 7px", whiteSpace: "nowrap",
    }}>
      {condition.label}
    </span>
  );
}

function InfoModal({ section, onClose, theme }: { section: PromptSection; onClose: () => void; theme?: LayerTheme }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accentBorder = theme?.border ?? "var(--session-walnut-border)";
  const accentBand = theme?.band ?? "var(--session-walnut-surface-soft)";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--session-linen)", borderRadius: 10,
        border: `1px solid ${accentBorder}`,
        maxWidth: 760, width: "100%", maxHeight: "82vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
      }}>
        <div style={{
          padding: "20px 26px 16px",
          background: accentBand,
          borderBottom: `1px solid ${accentBorder}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "20px", fontWeight: 500, fontStyle: "italic",
                color: "var(--session-ink)", margin: 0,
                letterSpacing: "-0.005em",
              }}>
                {section.label}
              </h3>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "12px",
                color: "var(--session-ink-faded)", marginTop: 8,
                letterSpacing: "0.3px",
              }}>
                {section.source.file} → {section.source.symbol}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", fontSize: "18px",
              color: "var(--session-ink-ghost)", cursor: "pointer", padding: "4px 8px",
              lineHeight: 1,
            }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "12px",
              color: "var(--session-ink-faded)", fontWeight: 500,
              letterSpacing: "0.3px",
            }}>
              {section.tokens.toLocaleString()} tokens
            </span>
            <ConditionPill condition={section.condition} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 30px" }}>
          <pre style={{
            fontFamily: "var(--font-sans)", fontSize: "15px", lineHeight: 1.75,
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
