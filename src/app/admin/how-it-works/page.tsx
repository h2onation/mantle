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
      "Jove's personality is ONE document — the conductor prompt (view and edit it on the Tuning page). Each turn the system ships that document plus two context blocks: the Manual so far (older entries compressed to one line each, this session's entries in full), and session context (returning user, session count, running summary). At the same instant, a separate AI call fires in the background — extraction — which reads the user's message and writes working memory: how deep the conversation is, which phrases are the user's own load-bearing words, what the current thread is. That working memory does two jobs, neither on this turn's reply: it fills the reflection meter (Stage 4) and it briefs the composer at save time (Stage 5).",
    specifics:
      "One background fire-and-forget call: extraction (Sonnet). Its output feeds the meter + the save-time composer — never Jove's own reply.",
    actor: "system",
    deepDives: [
      { label: "Tuning (read + edit both prompts live)", href: "/admin/prompt-architecture" },
      { label: "Jove's extraction of user messages", href: "/admin/extraction-map" },
    ],
  },
  {
    id: 3,
    title: "Jove streams back",
    caption:
      "The assembled prompt plus the conversation history go to Anthropic's Opus model. The response streams back one token at a time. Jove's job on every turn is the conversation itself — it never proposes a save and never writes to the Manual. The one signal it controls: when it judges an insight has genuinely landed (the user recognized the pattern in their own words), it ends that message with a hidden marker the user never sees. That marker is what makes the reflection bar light up.",
    specifics:
      "Streaming via SSE, 2–3 seconds. The hidden ---reflection-ready--- line is the meter's ONLY readiness source — Jove's in-conversation judgment, not a score.",
    actor: "anthropic",
    deepDives: [{ label: "Vendors", href: "/admin/vendors" }],
  },
  {
    id: 4,
    title: "The reflection meter — capture belongs to the user",
    caption:
      "This is the heart of the pull model. A thin bar at the top of the screen fills as the conversation deepens (driven by extraction's depth reading) and colours ready when Jove has signalled the insight landed. Nothing happens unless the user acts: Jove never triggers a save, there is no card pushed into the chat, and an unfilled meter costs nothing. If the user ignores it and keeps talking, the conversation just continues.",
    specifics:
      "Meter fill: extraction depth, recharges after each save. Ready: the landed marker from Stage 3. Web-only surface — text/SMS has no meter (that channel is gated off pending its rebuild).",
    actor: "user",
    deepDives: [],
  },
  {
    id: 5,
    title: "The user taps — compose, review, confirm",
    caption:
      "When the user taps the ready bar, an Opus call composes a draft entry from the whole conversation — reproducing the working version the user already approved in the open, in their words, briefed by extraction's language bank. The draft opens in an editable overlay: the user can change anything or discard it. Confirming writes the entry to their Manual — a plain database step, no model. The entry is theirs at every step: they pulled it, they edited it, they confirmed it.",
    specifics:
      "POST /api/checkpoint/compose (Opus, ~3–4 s) → editable overlay → POST /api/checkpoint/confirm (database write, no model). The composer also generates the compressed summary older-entry context uses.",
    actor: "anthropic",
    deepDives: [],
  },
  {
    id: 6,
    title: "Database writes finish the loop",
    caption:
      "Jove's response gets saved to messages. The extraction call's output gets saved to conversations.extraction_state for next turn. If the user confirmed an entry, a new row appears in manual_entries and the meter recharges. The user is back at the chat input, ready for the next turn — and everything starts again.",
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
    label: "Tuning",
    oneLine: "Both prompts in one place — edit Jove's conductor prompt live, and see the composer's prompt with its editable entry bar.",
    href: "/admin/prompt-architecture",
  },
  {
    label: "Jove's extraction of user messages",
    oneLine: "The working-memory fields the parallel extraction call writes each turn.",
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
        When a user sends a message to Jove, the same loop runs. The instant
        the message arrives, two AI calls fire in parallel: Jove reads its
        prompt (one document — the conductor) and streams a response, while a
        separate extraction call analyzes the message and writes working
        memory. Capture is a <em>pull</em>: Jove never saves anything and
        never proposes a save. When an insight lands, Jove marks the moment
        with a hidden signal that lights the reflection bar — and from there
        every step is the user&rsquo;s: they tap, a third call composes a
        draft in their words, they edit it, they confirm it. Then the
        database catches up and the loop closes. About 2–3 seconds end to
        end for a normal turn.
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
        Six stages. Two AI calls on a normal turn, a third only when the user
        pulls a reflection. Then the user types again and the whole thing fires
        fresh — a new response streamed, new working memory written, a new turn
        saved. The Manual grows one confirmed entry at a time, always by the
        user&rsquo;s hand. The conversation history grows one turn at a time.
        The working memory updates every turn, constantly carrying the
        conversation forward.
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
