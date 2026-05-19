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
  Tier,
} from "@/lib/admin/prompt-sections";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import type { ConversationMode } from "@/lib/persona/config";

// ---------------------------------------------------------------------------
// Jove's turn — four-column recipe view.
//
// Column A — Spine: always-conditioned sections (intro, Tier 1, voice base
//   pieces, always-on Tier 3 mechanics). Same words, every turn.
// Column B — Persona shape: persona-conditioned Tier 2 sections. Stacks
//   when multiple persona tags are active.
// Column C — Turn-by-turn: state / conv-mode / dynamic-conditioned blocks.
//   These slide in and out based on where the user is in the conversation.
// Column D — Alongside: what's sent with the prompt but isn't part of the
//   assembly — conversation history, sliding window, current message, and
//   the cache_control marker boundary.
//
// Cache zones are surfaced per-card via a small "cached" / "rebuilt" badge.
// Sibling AI calls (extraction, classifier, composer) appear in a footer
// strip — they run alongside Jove each turn but aren't part of Jove's prompt.
// ---------------------------------------------------------------------------

type ConvMode = ConversationMode;

const PERSONA_OPTIONS: { id: PersonaMode; label: string }[] = [
  { id: "autistic", label: "Autistic" },
  { id: "audhd", label: "AuDHD" },
  { id: "dyslexic", label: "Dyslexic" },
  { id: "general", label: "General" },
];

const CONV_MODE_OPTIONS: { id: ConvMode; label: string }[] = [
  { id: "situation", label: "Situation" },
  { id: "guided-intake", label: "Guided Intake" },
  { id: "upload", label: "Upload" },
];

const PHASE_SHORT: Record<string, string> = {
  "phase-1": "New account",
  "phase-2": "First checkpoint",
  "phase-3": "Returning",
  "phase-4": "Returning + checkpoint",
};

// ---------------------------------------------------------------------------
// Column themes — one per column, picking up the existing token palette.
// ---------------------------------------------------------------------------

interface ColumnTheme {
  band: string;
  border: string;
  borderSoft: string;
  surfaceTint: string;
  surfaceCard: string;
  accent: string;
  numeral: string;
  letter: string; // A/B/C/D
}

const COLUMN_THEMES: Record<"A" | "B" | "C" | "D", ColumnTheme> = {
  A: {
    // Foundation — deep walnut. Stable, identity, the spine.
    band:
      "linear-gradient(180deg, rgba(180,125,75,0.46) 0%, rgba(135,88,52,0.34) 100%)",
    border: "var(--session-walnut-border)",
    borderSoft: "var(--session-walnut-border-soft)",
    surfaceTint: "var(--session-walnut-surface-soft)",
    surfaceCard: "var(--session-walnut-surface)",
    accent: "var(--session-walnut)",
    numeral: "var(--session-walnut-meta)",
    letter: "A",
  },
  B: {
    // Persona — lighter caramel. Layered on top of A.
    band:
      "linear-gradient(180deg, rgba(220,170,120,0.40) 0%, rgba(180,135,90,0.28) 100%)",
    border: "var(--session-walnut-border-soft)",
    borderSoft: "var(--session-walnut-border-soft)",
    surfaceTint: "var(--session-walnut-tint)",
    surfaceCard: "var(--session-walnut-surface-soft)",
    accent: "var(--session-walnut)",
    numeral: "var(--session-walnut-meta-strong, var(--session-walnut-meta))",
    letter: "B",
  },
  C: {
    // Turn-by-turn — sage. Conditional, alive, changes each turn.
    band:
      "linear-gradient(180deg, rgba(156,177,138,0.44) 0%, rgba(94,122,79,0.32) 100%)",
    border: "var(--session-persona-border)",
    borderSoft: "var(--session-persona-border)",
    surfaceTint: "var(--session-persona-tint)",
    surfaceCard: "var(--session-persona-muted)",
    accent: "var(--session-persona)",
    numeral: "var(--session-persona)",
    letter: "C",
  },
  D: {
    // Alongside — neutral linen. Educational, not prompt content.
    band:
      "linear-gradient(180deg, rgba(180,170,150,0.32) 0%, rgba(150,140,120,0.20) 100%)",
    border: "var(--session-ink-hairline)",
    borderSoft: "var(--session-ink-hairline)",
    surfaceTint: "var(--session-linen)",
    surfaceCard: "var(--session-walnut-surface-soft)",
    accent: "var(--session-ink-soft)",
    numeral: "var(--session-ink-faded)",
    letter: "D",
  },
};

// ---------------------------------------------------------------------------
// Categorize sections into the four columns
// ---------------------------------------------------------------------------

interface TurnBlock {
  section: PromptSection;
  presentInPhases: string[];
}

interface CategorizedColumns {
  spine: PromptSection[];
  persona: PromptSection[];
  turnByTurn: TurnBlock[];
  spineTokens: number;
  personaTokens: number;
  turnByTurnTokens: number;
}

const TURN_CONDITION_TYPES = new Set<ConditionType>([
  "state",
  "conv-mode",
  "dynamic",
]);

function categorize(phases: PhaseData[]): CategorizedColumns {
  // Phase 1 is the baseline — it contains spine + persona regardless of state.
  const base = phases[0];

  const spine = base.sections.filter(
    (s) => s.condition.type === "always",
  );
  const persona = base.sections.filter(
    (s) => s.condition.type === "persona",
  );

  // Turn-by-turn: collect every state/conv-mode/dynamic section that appears
  // in any phase, and track which phases each appears in.
  const seen = new Map<string, TurnBlock>();
  for (const phase of phases) {
    for (const section of phase.sections) {
      if (TURN_CONDITION_TYPES.has(section.condition.type)) {
        if (!seen.has(section.id)) {
          seen.set(section.id, { section, presentInPhases: [] });
        }
        seen.get(section.id)!.presentInPhases.push(
          PHASE_SHORT[phase.id] ?? phase.id,
        );
      }
    }
  }

  const turnByTurn = Array.from(seen.values());

  return {
    spine,
    persona,
    turnByTurn,
    spineTokens: spine.reduce((s, x) => s + x.tokens, 0),
    personaTokens: persona.reduce((s, x) => s + x.tokens, 0),
    turnByTurnTokens: turnByTurn.reduce((s, x) => s + x.section.tokens, 0),
  };
}

// ---------------------------------------------------------------------------
// Cache zone derivation — surfaces what actually caches at runtime.
// See buildSystemPromptBlocks() in system-prompt.ts:
//   - tier1Block (intro + TIER_1)     → cached forever
//   - staticContext (all of Tier 2)    → cached, invalidates on persona change
//   - dynamic (Tier 3 + context)       → rebuilt every turn
// ---------------------------------------------------------------------------

type CacheZone = "forever" | "persona-keyed" | "rebuilt";

function tierToCacheZone(tier: Tier): CacheZone {
  if (tier === "intro" || tier === "1") return "forever";
  if (tier === "2") return "persona-keyed";
  return "rebuilt";
}

function cacheZoneLabel(zone: CacheZone): string {
  switch (zone) {
    case "forever":
      return "cached forever";
    case "persona-keyed":
      return "cached (persona-keyed)";
    case "rebuilt":
      return "rebuilt each turn";
  }
}

function cacheZoneColor(zone: CacheZone): string {
  switch (zone) {
    case "forever":
      return "var(--session-persona)";
    case "persona-keyed":
      return "var(--session-walnut)";
    case "rebuilt":
      return "var(--session-ink-faded)";
  }
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
    const neurotypes: PersonaMode[] = ["autistic", "audhd", "dyslexic"];
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
    fetchData(personaModes, convMode === cm ? convMode : cm);
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

  const totalTokens = data
    ? data.spineTokens + data.personaTokens + data.turnByTurnTokens
    : 0;

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
      {/* Admin banner */}
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
          {/* Header / controls */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "18px 28px",
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-spectral, var(--font-serif))",
                  fontSize: "22px",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "var(--session-ink)",
                  letterSpacing: "-0.005em",
                  lineHeight: 1.1,
                }}
              >
                Jove&apos;s turn
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.5px",
                  color: "var(--session-ink-ghost)",
                  marginTop: 2,
                }}
              >
                The recipe — what gets assembled and what runs alongside, every turn
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Persona">
              {PERSONA_OPTIONS.map((p) => (
                <Chip
                  key={p.id}
                  active={personaModes.includes(p.id)}
                  onClick={() => handlePersonaToggle(p.id)}
                >
                  {p.label}
                </Chip>
              ))}
            </ControlGroup>
            <div style={{ width: 1, height: 22, background: "var(--session-ink-hairline)" }} />
            <ControlGroup label="Mode">
              {CONV_MODE_OPTIONS.map((cm) => (
                <Chip
                  key={cm.id}
                  active={convMode === cm.id}
                  onClick={() => handleConvModeChange(cm.id)}
                >
                  {cm.label}
                </Chip>
              ))}
            </ControlGroup>
            {data && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--session-ink-ghost)",
                  marginLeft: "auto",
                  letterSpacing: "0.5px",
                }}
              >
                ~{totalTokens.toLocaleString()} prompt tokens
              </span>
            )}
          </div>

          {/* Cache legend */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "10px 28px",
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
              flexShrink: 0,
              background: "var(--session-walnut-surface-soft)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
              }}
            >
              Cache
            </span>
            <CacheLegendItem zone="forever" />
            <CacheLegendItem zone="persona-keyed" />
            <CacheLegendItem zone="rebuilt" />
          </div>

          {/* Scrollable columns */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 28px 60px",
            }}
          >
            {loading && !phases && <LoadingState />}
            {error && <ErrorState message={error} />}
            {data && (
              <>
                <ColumnsGrid>
                  <ColumnA spine={data.spine} tokens={data.spineTokens} />
                  <ColumnB
                    persona={data.persona}
                    tokens={data.personaTokens}
                    personaModes={personaModes}
                  />
                  <ColumnC
                    blocks={data.turnByTurn}
                    tokens={data.turnByTurnTokens}
                  />
                  <ColumnD />
                </ColumnsGrid>

                {/* Assembly arrow */}
                <AssemblyArrow />

                {/* Sibling AI calls */}
                <SiblingCallsFooter />
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .col-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 1180px) {
          .col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .col-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

function ColumnsGrid({ children }: { children: React.ReactNode }) {
  return <div className="col-grid">{children}</div>;
}

function LoadingState() {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-meta)",
        color: "var(--session-ink-ghost)",
        textAlign: "center",
        marginTop: 60,
      }}
    >
      Loading…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-meta)",
        color: "var(--session-error)",
        textAlign: "center",
        marginTop: 60,
      }}
    >
      Error: {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column header — the band that names each column
// ---------------------------------------------------------------------------

function ColumnHeader({
  theme,
  title,
  blurb,
  count,
  tokens,
}: {
  theme: ColumnTheme;
  title: string;
  blurb: string;
  count: number;
  tokens?: number;
}) {
  return (
    <div
      style={{
        background: theme.band,
        border: `1px solid ${theme.border}`,
        borderRadius: "10px 10px 0 0",
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontStyle: "italic",
            fontSize: "18px",
            fontWeight: 500,
            color: theme.numeral,
            lineHeight: 1,
          }}
        >
          {theme.letter}.
        </span>
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "18px",
            fontWeight: 500,
            color: "var(--session-ink)",
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12.5px",
          color: "var(--session-ink-soft)",
          lineHeight: 1.5,
          marginTop: 6,
        }}
      >
        {blurb}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: "var(--session-ink-ghost)",
          marginTop: 8,
          letterSpacing: "0.5px",
        }}
      >
        {count} {count === 1 ? "block" : "blocks"}
        {tokens != null ? ` · ${tokens.toLocaleString()} tokens` : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column body wrapper — connects to the header band, holds the cards.
// ---------------------------------------------------------------------------

function ColumnBody({
  theme,
  children,
}: {
  theme: ColumnTheme;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        background: theme.surfaceTint,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column A — Spine
// ---------------------------------------------------------------------------

function ColumnA({ spine, tokens }: { spine: PromptSection[]; tokens: number }) {
  const theme = COLUMN_THEMES.A;
  return (
    <div>
      <ColumnHeader
        theme={theme}
        title="Spine"
        blurb="Always present. Same words, every turn, every user. Jove's identity, constitutional rules, and the base voice scaffold."
        count={spine.length}
        tokens={tokens}
      />
      <ColumnBody theme={theme}>
        {spine.map((s) => (
          <SectionCard key={s.id} section={s} theme={theme} />
        ))}
      </ColumnBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column B — Persona shape
// ---------------------------------------------------------------------------

function ColumnB({
  persona,
  tokens,
  personaModes,
}: {
  persona: PromptSection[];
  tokens: number;
  personaModes: PersonaMode[];
}) {
  const theme = COLUMN_THEMES.B;
  const activeLabel = personaModes
    .map((m) => m[0].toUpperCase() + m.slice(1))
    .join(" + ");
  return (
    <div>
      <ColumnHeader
        theme={theme}
        title="Persona shape"
        blurb={`Chosen once per session, layered on top of the spine. Active: ${activeLabel}. Toggle personas above to see how each shifts.`}
        count={persona.length}
        tokens={tokens}
      />
      <ColumnBody theme={theme}>
        {persona.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            theme={theme}
            showAlternatives
          />
        ))}
      </ColumnBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column C — Turn-by-turn
// ---------------------------------------------------------------------------

function ColumnC({
  blocks,
  tokens,
}: {
  blocks: TurnBlock[];
  tokens: number;
}) {
  const theme = COLUMN_THEMES.C;
  return (
    <div>
      <ColumnHeader
        theme={theme}
        title="Turn-by-turn"
        blurb="Slide in and out each turn based on user state, mode, and live data. Sized for the maximum case — typical turns include only some of these."
        count={blocks.length}
        tokens={tokens}
      />
      <ColumnBody theme={theme}>
        {blocks.map((b) => (
          <SectionCard
            key={b.section.id}
            section={b.section}
            theme={theme}
            phases={b.presentInPhases}
          />
        ))}
      </ColumnBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column D — Alongside the prompt (static / educational)
// ---------------------------------------------------------------------------

interface AlongsideItem {
  id: string;
  label: string;
  badge: string;
  blurb: string;
  detail: string;
}

const ALONGSIDE_ITEMS: AlongsideItem[] = [
  {
    id: "history",
    label: "Conversation history",
    badge: "messages array",
    blurb:
      "All prior messages, sent to Claude as the `messages` array alongside the system prompt.",
    detail:
      "Each turn sends the full conversation back. Roles alternate user / assistant. Jove's stream uses the system prompt + this array to produce the next response.",
  },
  {
    id: "sliding-window",
    label: "Sliding window",
    badge: "ADR-023",
    blurb:
      "When the message history exceeds 50, only the first 2 + last 48 are sent. Long sessions stay bounded.",
    detail:
      "applySlidingWindow() in call-persona.ts. Keeping the first two messages preserves the session's opening so Jove doesn't 'forget' how the user arrived. The last 48 carry the working context.",
  },
  {
    id: "synthetic",
    label: "Synthetic user lines",
    badge: "mapSystemMessages",
    blurb:
      "System events (checkpoint confirmed / rejected / refined) are remapped to user-voice lines so Jove sees them naturally in the history.",
    detail:
      "Example: a `[User confirmed the checkpoint]` system message is rewritten to 'I confirmed that checkpoint. That resonates.' before being sent. This keeps the role sequence valid and lets Jove react to the event in-character.",
  },
  {
    id: "current-message",
    label: "Current user message",
    badge: "this turn",
    blurb:
      "The line that just arrived from the user. The last entry in the messages array.",
    detail:
      "Everything else in the prompt is set up to help Jove respond to this one sentence. Web channel streams the response back via SSE; text channel returns it as a single block.",
  },
  {
    id: "cache-marker",
    label: "Cache marker",
    badge: "cache_control",
    blurb:
      "The boundary between cached and rebuilt content lands at the end of Column B's persona section (the `staticContext` block).",
    detail:
      "Anthropic's prompt-cache marker is placed on the static block. Columns A (intro + Tier 1) and B (Tier 2) sit before the marker and cache. Column C and the conversation history sit after and rebuild each turn.",
  },
];

function ColumnD() {
  const theme = COLUMN_THEMES.D;
  return (
    <div>
      <ColumnHeader
        theme={theme}
        title="Alongside"
        blurb="Sent with the prompt every turn but not part of the assembly. This is the rest of what Jove sees."
        count={ALONGSIDE_ITEMS.length}
      />
      <ColumnBody theme={theme}>
        {ALONGSIDE_ITEMS.map((item) => (
          <AlongsideCard key={item.id} item={item} theme={theme} />
        ))}
      </ColumnBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card — collapsible. Shows label, tier, tokens, cache zone,
// condition, source pointer; expands to show the rendered prompt text.
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  theme,
  showAlternatives,
  phases,
}: {
  section: PromptSection;
  theme: ColumnTheme;
  showAlternatives?: boolean;
  phases?: string[];
}) {
  const [open, setOpen] = useState(false);
  const zone = tierToCacheZone(section.tier);
  const tierLabel = section.tier === "intro" ? "Intro" : `Tier ${section.tier}`;

  return (
    <div
      style={{
        background: open ? theme.surfaceCard : "var(--session-linen)",
        border: `1px solid ${theme.borderSoft}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          padding: "10px 12px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--session-ink)",
              lineHeight: 1.3,
              flex: 1,
              minWidth: 0,
              wordWrap: "break-word",
            }}
          >
            {section.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: theme.accent,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              lineHeight: "13px",
              flexShrink: 0,
            }}
          >
            ▾
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 6,
            alignItems: "center",
          }}
        >
          <TierBadge tier={tierLabel} />
          <CacheBadge zone={zone} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.3px",
            }}
          >
            ~{section.tokens.toLocaleString()}t
          </span>
        </div>
        {phases && phases.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
              marginTop: 6,
            }}
          >
            {phases.map((p) => (
              <span
                key={p}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "10.5px",
                  color: theme.accent,
                  background: theme.surfaceCard,
                  border: `1px solid ${theme.borderSoft}`,
                  borderRadius: 3,
                  padding: "1px 6px",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            borderTop: `1px solid ${theme.borderSoft}`,
            padding: "10px 12px 12px",
            background: theme.surfaceTint,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <ConditionPill condition={section.condition} />
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--session-ink-soft)",
                background: "var(--session-walnut-surface-soft)",
                padding: "1px 5px",
                borderRadius: 3,
                wordBreak: "break-all",
              }}
            >
              {section.source.file}
            </code>
          </div>
          <pre
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {section.text}
          </pre>
          {showAlternatives && section.alternatives.length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${theme.borderSoft}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--session-ink-ghost)",
                }}
              >
                Other voices
              </span>
              {section.alternatives.map((alt) => (
                <span
                  key={alt.label}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    color: "var(--session-ink-faded)",
                  }}
                >
                  {alt.label}{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: "var(--session-ink-ghost)",
                    }}
                  >
                    {alt.tokens.toLocaleString()}t
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alongside card — collapsible, static content explaining one item.
// ---------------------------------------------------------------------------

function AlongsideCard({
  item,
  theme,
}: {
  item: AlongsideItem;
  theme: ColumnTheme;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: open ? theme.surfaceCard : "var(--session-linen)",
        border: `1px solid ${theme.borderSoft}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          padding: "10px 12px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--session-ink)",
              lineHeight: 1.3,
              flex: 1,
              minWidth: 0,
              wordWrap: "break-word",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: theme.accent,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              lineHeight: "13px",
              flexShrink: 0,
            }}
          >
            ▾
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 6,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              background: "var(--session-walnut-surface-soft)",
              padding: "1px 6px",
              borderRadius: 3,
              letterSpacing: "0.3px",
            }}
          >
            {item.badge}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-ink-soft)",
            lineHeight: 1.5,
            marginTop: 8,
          }}
        >
          {item.blurb}
        </div>
      </button>
      {open && (
        <div
          style={{
            borderTop: `1px solid ${theme.borderSoft}`,
            padding: "10px 12px 12px",
            background: theme.surfaceTint,
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-ink-soft)",
            lineHeight: 1.6,
          }}
        >
          {item.detail}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assembly arrow — separates the columns from the sibling-calls strip.
// ---------------------------------------------------------------------------

function AssemblyArrow() {
  return (
    <div
      style={{
        textAlign: "center",
        margin: "28px 0 22px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        letterSpacing: "2px",
        color: "var(--session-ink-ghost)",
        textTransform: "uppercase",
      }}
    >
      <div style={{ marginBottom: 4 }}>↓</div>
      <div>A + B + C concatenated · D sent as messages · all to Claude</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sibling AI calls — what runs alongside Jove each turn.
// ---------------------------------------------------------------------------

interface SiblingCall {
  id: string;
  name: string;
  model: string;
  timing: string;
  purpose: string;
  detail: string;
}

const SIBLING_CALLS: SiblingCall[] = [
  {
    id: "extraction",
    name: "Extraction",
    model: "Sonnet",
    timing: "parallel · fire-and-forget",
    purpose:
      "Reads the message, updates the research brief Jove sees on the next turn.",
    detail:
      "Tracks language bank, per-layer signals, depth, mode, and the checkpoint gate. Writes to conversations.extraction_state as JSONB. Never awaited; never blocks Jove's stream.",
  },
  {
    id: "classifier",
    name: "Classifier",
    model: "Haiku",
    timing: "post-stream",
    purpose:
      "Decides whether Jove's response counts as a checkpoint proposal.",
    detail:
      "Runs after Jove finishes streaming. If it flags a checkpoint, the composer call fires next. Otherwise the turn ends.",
  },
  {
    id: "composer",
    name: "Composer",
    model: "Sonnet",
    timing: "after classifier (only when checkpoint detected)",
    purpose:
      "Writes the polished manual entry server-side before the confirmation card appears.",
    detail:
      "Composes from the conversational text plus the language bank. composed_content is always populated before the user sees the confirm card — confirmCheckpoint() then just inserts the row.",
  },
];

function SiblingCallsFooter() {
  return (
    <div
      style={{
        marginTop: 8,
        borderTop: "1px solid var(--session-ink-hairline)",
        paddingTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "16px",
            fontStyle: "italic",
            color: "var(--session-ink)",
          }}
        >
          Sibling calls
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.5px",
          }}
        >
          Other AI work that happens around Jove each turn — not part of Jove&apos;s prompt
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {SIBLING_CALLS.map((c) => (
          <SiblingCallCard key={c.id} call={c} />
        ))}
      </div>
    </div>
  );
}

function SiblingCallCard({ call }: { call: SiblingCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-walnut-border-soft)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          padding: "12px 14px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--session-ink)",
              }}
            >
              {call.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--session-walnut)",
                background: "var(--session-walnut-surface-soft)",
                padding: "1px 6px",
                borderRadius: 3,
                letterSpacing: "0.3px",
              }}
            >
              {call.model}
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-ghost)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              lineHeight: "13px",
            }}
          >
            ▾
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--session-ink-ghost)",
            marginTop: 4,
            letterSpacing: "0.3px",
          }}
        >
          {call.timing}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: "var(--session-ink-soft)",
            lineHeight: 1.5,
            marginTop: 8,
          }}
        >
          {call.purpose}
        </div>
      </button>
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--session-walnut-border-soft)",
            padding: "10px 14px 12px",
            background: "var(--session-walnut-surface-soft)",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-ink-soft)",
            lineHeight: 1.6,
          }}
        >
          {call.detail}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cache legend & badges
// ---------------------------------------------------------------------------

function CacheLegendItem({ zone }: { zone: CacheZone }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 2,
          background: cacheZoneColor(zone),
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11.5px",
          color: "var(--session-ink-soft)",
        }}
      >
        {cacheZoneLabel(zone)}
      </span>
    </div>
  );
}

function CacheBadge({ zone }: { zone: CacheZone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-mono)",
        fontSize: "9.5px",
        color: cacheZoneColor(zone),
        letterSpacing: "0.3px",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 1.5,
          background: cacheZoneColor(zone),
        }}
      />
      {cacheZoneLabel(zone)}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9.5px",
        color: "var(--session-ink-ghost)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 3,
        padding: "1px 5px",
        letterSpacing: "0.5px",
      }}
    >
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared controls
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
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginRight: 4,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
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
        fontSize: "13px",
        fontWeight: active ? 500 : 400,
        color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
        background: active ? "var(--session-walnut-surface)" : "transparent",
        border: `1px solid ${active ? "var(--session-walnut-border)" : "var(--session-ink-hairline)"}`,
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

function ConditionPill({
  condition,
}: {
  condition: { type: ConditionType; label: string };
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
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
