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
  { id: "adhd", label: "ADHD" },
  { id: "dyslexic", label: "Dyslexic" },
  { id: "general", label: "General" },
];

const CONV_MODE_OPTIONS: { id: ConvMode; label: string }[] = [
  { id: "situation", label: "Situation" },
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
  const [personaModes, setPersonaModes] = useState<PersonaMode[]>(["general"]);
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
    const neurotypes: PersonaMode[] = ["autistic", "adhd", "dyslexic"];
    if (mode === "general") {
      next = ["general"];
    } else if (personaModes.includes(mode)) {
      next = personaModes.filter((m) => m !== mode);
      if (next.length === 0) next = ["general"];
    } else {
      next = [...personaModes.filter((m) => neurotypes.includes(m)), mode];
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
  const [open, setOpen] = useState(true);
  const theme = THEMES[1];
  const promptText = sections.map((s) => s.text).join("\n\n");

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={1}
        title="Foundation"
        subtitle="Always present. Constitutional rules, behavioral guardrails, and conversation mechanics that never change regardless of persona, mode, or user state."
        stats={`${tokens.toLocaleString()} tokens`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && <PromptBlock text={promptText} theme={theme} />}
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
  const theme = THEMES[2];

  // Collect alternatives from the first section that has them
  const alts = sections.find((s) => s.alternatives.length > 0)?.alternatives ?? [];

  const activeLabel = personaModes
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join(" + ");

  const promptText = sections.map((s) => s.text).join("\n\n");

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={2}
        title="Voice"
        subtitle={`Currently: ${activeLabel}. These sections define how Jove speaks — tone, rules, examples, conversational patterns. Swap personas above to see how each voice module differs.`}
        stats={`${tokens.toLocaleString()} tokens`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div style={{
          border: `1px solid ${theme.border}`,
          borderTop: "none", borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: theme.surfaceTint,
        }}>
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
          <PromptBlock text={promptText} theme={theme} inset />
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
  const theme = THEMES[3];

  return (
    <div style={{ marginBottom: 28 }}>
      <LayerHeader
        number={3}
        title="Lifecycle"
        subtitle="Conditional blocks that appear or disappear based on where the user is in their journey. Each block lists which phases include it."
        stats={`${tokens.toLocaleString()} tokens (when all active)`}
        theme={theme}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div style={{
          border: `1px solid ${theme.border}`,
          borderTop: "none", borderRadius: "0 0 10px 10px",
          overflow: "hidden",
          background: theme.surfaceTint,
        }}>
          {blocks.map((block, i) => (
            <LifecycleBlockCard
              key={block.section.id}
              block={block}
              last={i === blocks.length - 1}
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
}: {
  number: 1 | 2 | 3;
  title: string;
  subtitle: string;
  stats: string;
  theme: LayerTheme;
  open: boolean;
  onToggle: () => void;
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
// PromptBlock — renders the actual prompt text as one continuous block.
// ---------------------------------------------------------------------------

function PromptBlock({ text, theme, inset }: { text: string; theme: LayerTheme; inset?: boolean }) {
  return (
    <div style={{
      ...(inset ? {} : {
        border: `1px solid ${theme.border}`,
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
      }),
      background: theme.surfaceTint,
      padding: "20px 24px",
    }}>
      <pre style={{
        fontFamily: "var(--font-sans)", fontSize: "14px",
        lineHeight: 1.65, color: "var(--session-ink-soft)",
        whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
      }}>
        {text}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle block — conditional prompt fragment with phase indicators.
// Always shows full text; each block represents a chunk that may or may
// not be injected depending on user state.
// ---------------------------------------------------------------------------

function LifecycleBlockCard({ block, last, theme }: { block: LifecycleBlock; last: boolean; theme: LayerTheme }) {
  const { section, presentInPhases } = block;

  return (
    <div style={{
      padding: "18px 22px 22px",
      borderBottom: last ? "none" : `1px solid ${theme.borderSoft}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap",
      }}>
        <ConditionPill condition={section.condition} />
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
      <pre style={{
        fontFamily: "var(--font-sans)", fontSize: "14px",
        lineHeight: 1.65, color: "var(--session-ink-soft)",
        whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
      }}>
        {section.text}
      </pre>
    </div>
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

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

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
