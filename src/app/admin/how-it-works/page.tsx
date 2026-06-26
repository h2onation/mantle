"use client";

import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// How Jove works — parent page for the three technical deep-dives. Single
// scroll page (no stepper). Walks one full turn from user input to database
// writes, links out to the deep-dives at each step.
//
// This is the "start here" for a newcomer. The deep-dives are the depth.
// ---------------------------------------------------------------------------

interface Stage {
  id: number;
  title: string;
  caption: string;
  specifics: string;
  actor: "user" | "system" | "anthropic" | "database";
  deepDives: { label: string; href: string }[];
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: "Someone sends a message",
    caption:
      "The user types into the chat. The app writes the message to the database, opens a new conversation if this is their first turn, and triggers everything downstream. From here on, the next 2–3 seconds belong to the system.",
    specifics: "Saved to messages. Triggers the rest of the loop within ~200 ms.",
    actor: "user",
    deepDives: [],
  },
  {
    id: 2,
    title: "The prompt gets assembled — and extraction fires alongside it",
    caption:
      "Jove doesn't see one fixed prompt. Every turn, a recipe gets built fresh: the voice (a short character + hard limits + entry mechanics — rebuilt June 2026 from the earlier rule-pile), the conversation mode, plus conditional blocks that only fire when relevant (returning user, clinical material, and so on). At the same instant, a separate AI call fires in the background — extraction — which reads the user's message and writes working memory (what's underneath the surface topic, which phrases are load-bearing, where the conversation is); that working memory feeds the next turn's prompt (a one-turn lag you never feel).",
    specifics:
      "~7,000 tokens assembled. One background fire-and-forget call: extraction (Sonnet — feeds next turn).",
    actor: "system",
    deepDives: [
      { label: "Jove's prompt architecture", href: "/admin/prompt-architecture" },
      { label: "Jove's extraction of user messages", href: "/admin/extraction-map" },
    ],
  },
  {
    id: 3,
    title: "Jove streams back",
    caption:
      "The assembled prompt plus the conversation history go to Anthropic's Opus model. The response streams back to the user one token at a time, so the page feels alive instead of pausing for a full reply.",
    specifics: "Streaming via SSE. Total response time: 2–3 seconds for a normal turn.",
    actor: "anthropic",
    deepDives: [{ label: "Vendors", href: "/admin/vendors" }],
  },
  {
    id: 4,
    title: "After Jove streams, the checkpoint path runs",
    caption:
      "After Jove finishes streaming, a deterministic check — a regex, not a model — reads the response and decides whether this turn was a checkpoint, a moment where Jove proposed a Manual entry. If it is, an Opus call composes the proposed entry right then, at proposal time, and the user sees a card showing it. Confirming the card writes the entry to their Manual — a plain database step, no model. Most turns aren't checkpoints, but the detector runs every time.",
    specifics:
      "Detector: a deterministic regex (no model call). Composer: Opus, ~3–4 seconds, at proposal time — checkpoint turns only. The on-confirm write is a non-model database step (Stage 5).",
    actor: "anthropic",
    deepDives: [
      { label: "Jove's prompt architecture — sibling calls", href: "/admin/prompt-architecture" },
    ],
  },
  {
    id: 5,
    title: "Database writes finish the loop",
    caption:
      "Jove's response gets saved to messages. The extraction call's output gets saved to conversations.extraction_state for next turn. If a checkpoint was confirmed, a new row appears in manual_entries. The user is back at the chat input, ready for the next turn — and everything starts again.",
    specifics:
      "Writes: messages, conversations.extraction_state, optionally manual_entries.",
    actor: "database",
    deepDives: [{ label: "Database schema", href: "/admin/schema-map" }],
  },
];

const ACTOR_LABEL: Record<Stage["actor"], string> = {
  user: "User",
  system: "System (parallel)",
  anthropic: "Anthropic",
  database: "Database",
};

const ACTOR_ACCENT: Record<Stage["actor"], { bg: string; border: string; fg: string }> = {
  user: {
    bg: "var(--session-walnut-surface)",
    border: "var(--session-walnut-border)",
    fg: "var(--session-walnut-meta-strong)",
  },
  system: {
    bg: "var(--session-walnut-surface-soft)",
    border: "var(--session-walnut-border-soft)",
    fg: "var(--session-walnut-meta)",
  },
  anthropic: {
    bg: "var(--session-persona-muted)",
    border: "var(--session-persona-border)",
    fg: "var(--session-persona)",
  },
  database: {
    bg: "var(--session-walnut-surface)",
    border: "var(--session-walnut-border)",
    fg: "var(--session-walnut-meta-strong)",
  },
};

const QUICK_LINKS: { label: string; oneLine: string; href: string }[] = [
  {
    label: "Jove's prompt architecture",
    oneLine: "Every layer of Jove's per-turn prompt. Click into any band for source.",
    href: "/admin/prompt-architecture",
  },
  {
    label: "Jove's extraction of user messages",
    oneLine: "The 21 fields the parallel extraction call writes each turn.",
    href: "/admin/extraction-map",
  },
  {
    label: "Database schema",
    oneLine: "Every table the app touches, the spine, the cascades.",
    href: "/admin/schema-map",
  },
];

export default function HowItWorksPage() {
  const isAdmin = useIsAdmin();

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
        <AdminNavRail activeId="how-it-works" />

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
              overflowY: "auto",
              padding: "32px 32px 80px",
            }}
          >
            <div
              style={{
                maxWidth: 820,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <Premise />

              {STAGES.map((stage, idx) => (
                <div
                  key={stage.id}
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  <StageCard stage={stage} />
                  {idx < STAGES.length - 1 && <FlowArrow />}
                </div>
              ))}

              <ClosingNote />
              <QuickNavigator />
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
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Start here
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 28,
          fontWeight: 400,
          fontStyle: "italic",
          color: "var(--session-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        How Jove works
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Premise
// ---------------------------------------------------------------------------

function Premise() {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 16.5,
          lineHeight: 1.65,
          color: "var(--session-ink)",
        }}
      >
        When a user sends a message to Jove, the same five-step loop runs.
        The instant the message arrives, two AI calls fire in parallel: Jove
        reads its assembled prompt and streams a response, while a separate
        extraction call analyzes the message and writes Jove&rsquo;s working
        memory for the next turn. As Jove finishes streaming, a
        deterministic check — a regex, not a model — decides whether the
        response was a Manual-entry proposal. If yes and the user accepts, a
        third call composes the polished entry. Then the database catches up
        and the loop closes. About 2–3 seconds end to end.
      </p>
      <p
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        Each step is below, in order. Deep-dive links open the detailed view
        for that step.
      </p>
      <p
        style={{
          margin: "16px 0 0",
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          fontStyle: "italic",
          color: "var(--session-ink-ghost)",
          letterSpacing: "0.3px",
          lineHeight: 1.55,
        }}
      >
        This page is the per-turn loop only. Onboarding, billing, signup, and
        group-chat flows live on other pages.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage card
// ---------------------------------------------------------------------------

function StageCard({ stage }: { stage: Stage }) {
  const accent = ACTOR_ACCENT[stage.actor];
  return (
    <article
      style={{
        padding: "20px 22px",
        borderRadius: 10,
        background: accent.bg,
        border: `1px solid ${accent.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 26,
              fontStyle: "italic",
              fontWeight: 400,
              color: accent.fg,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {stage.id}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "1.5px",
              color: accent.fg,
              textTransform: "uppercase",
            }}
          >
            Stage {stage.id} · {ACTOR_LABEL[stage.actor]}
          </span>
        </div>
      </div>

      <h2
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 21,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1.3,
          color: "var(--session-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        {stage.title}
      </h2>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15.5,
          lineHeight: 1.65,
          color: "var(--session-ink-soft)",
        }}
      >
        {stage.caption}
      </p>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--session-walnut-border-soft)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--session-ink-soft)",
            letterSpacing: "0.2px",
          }}
        >
          {stage.specifics}
        </code>
        {stage.deepDives.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {stage.deepDives.map((dd) => (
              <a
                key={dd.label}
                href={dd.href}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  letterSpacing: "0.3px",
                  color: "var(--session-ink)",
                  textDecoration: "underline",
                  textDecorationColor: "var(--session-walnut-border)",
                  textUnderlineOffset: 3,
                }}
              >
                {dd.label} →
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Arrow between stages
// ---------------------------------------------------------------------------

function FlowArrow() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        color: "var(--session-walnut-meta)",
        fontFamily: "var(--font-mono)",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          width: 1,
          height: 18,
          background: "var(--session-walnut-border)",
        }}
      />
      <span style={{ fontSize: 14, lineHeight: 1 }}>↓</span>
      <span
        style={{
          width: 1,
          height: 18,
          background: "var(--session-walnut-border)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Closing note
// ---------------------------------------------------------------------------

function ClosingNote() {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "18px 22px",
        borderRadius: 10,
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-walnut-border-soft)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        The loop closes
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15.5,
          lineHeight: 1.65,
          color: "var(--session-ink-soft)",
          fontStyle: "italic",
        }}
      >
        Five stages. Three AI calls. Two to three seconds. Then the user types
        again and the whole thing fires fresh — a new prompt assembled, a new
        extraction call written, a new response streamed, a new turn saved. The
        Manual grows one confirmed entry at a time. The conversation history
        grows one turn at a time. The working memory updates every turn,
        constantly carrying the conversation forward.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick navigator
// ---------------------------------------------------------------------------

function QuickNavigator() {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Want to go deeper?
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {QUICK_LINKS.map((q) => (
          <a
            key={q.label}
            href={q.href}
            style={{
              display: "block",
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--session-walnut-surface-soft)",
              border: "1px solid var(--session-walnut-border-soft)",
              textDecoration: "none",
              color: "var(--session-ink)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14.5,
                fontWeight: 500,
                color: "var(--session-ink)",
                marginBottom: 4,
              }}
            >
              {q.label} →
            </div>
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--session-ink-soft)",
                lineHeight: 1.45,
              }}
            >
              {q.oneLine}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
