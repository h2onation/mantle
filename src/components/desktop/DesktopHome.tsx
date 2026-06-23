"use client";

import { useState } from "react";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ManualEntry, ExplorationContext } from "@/lib/types";
import type { ConversationMode } from "@/lib/persona/config";
import { useHomeModel } from "@/components/home/useHomeModel";
import LayerIndex from "@/components/home/LayerIndex";
import WaysToBegin from "@/components/home/WaysToBegin";
import { LineIcon, IC_BOOKMARK } from "@/components/home/LineIcon";

// Desktop Home (≥1030px). Same shared substance as MobileHome — the
// useHomeModel hook and the LayerIndex component — arranged for the wider
// canvas: a slim resume ribbon, a three-equal-card "ways to begin" triptych,
// then the 5-layer index. No recents list: the persistent sidebar owns
// session history on desktop.

interface DesktopHomeProps {
  firstName?: string | null;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  entries: ManualEntry[];
  onSelectSession: (id: string) => void;
  onStartConversation: (mode: ConversationMode) => void;
  onExploreWithPersona: (context: ExplorationContext) => void;
  onNavigateToManual: () => void;
}

const EYEBROW: React.CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--session-walnut-meta)",
};

export default function DesktopHome({
  firstName,
  conversations,
  activeConversationId,
  entries,
  onSelectSession,
  onStartConversation,
  onExploreWithPersona,
  onNavigateToManual,
}: DesktopHomeProps) {
  const { greeting, dateLine, heroConv, heroSnippet, layers, startedCount } =
    useHomeModel({ firstName, conversations, activeConversationId, entries });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <main style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        className="mw-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "40px 40px 64px" }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display), var(--font-serif), serif",
            fontSize: 38,
            fontWeight: 400,
            letterSpacing: "-0.5px",
            color: "var(--session-ink)",
            lineHeight: 1.08,
          }}
        >
          {greeting}
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-ink-faded)",
          }}
        >
          {dateLine}
        </p>

        {/* Top slot: resume ribbon for returning users; an orienting tile for
            a brand-new user (nothing to resume, no entries yet). */}
        {heroConv ? (
          <section
            aria-label="Pick up where you left off"
            style={{
              marginTop: 26,
              padding: "15px 18px 15px 20px",
              borderRadius: 14,
              background: "var(--session-cream-bright)",
              border: "1px solid var(--session-hair)",
              boxShadow: "var(--session-card-shadow, none)",
              display: "flex",
              alignItems: "center",
              gap: 22,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={EYEBROW}>
                <LineIcon d={IC_BOOKMARK} size={13} />
                Pick up where you left off
              </span>
              <span
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  marginTop: 7,
                  fontFamily: "var(--font-serif), serif",
                  fontStyle: "italic",
                  fontSize: 15.5,
                  lineHeight: 1.4,
                  color: "var(--session-ink)",
                }}
              >
                {heroSnippet}
              </span>
            </span>
            <button
              onClick={() => onSelectSession(heroConv.id)}
              onMouseEnter={() => setHovered("ribbon")}
              onMouseLeave={() => setHovered(null)}
              style={{
                all: "unset",
                cursor: "pointer",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 12,
                background:
                  hovered === "ribbon"
                    ? "var(--session-walnut-meta-strong)"
                    : "var(--session-walnut)",
                color: "var(--session-cream-bright)",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.2px",
              }}
            >
              Continue <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : startedCount === 0 ? (
          <section
            aria-label="Welcome"
            style={{
              marginTop: 26,
              padding: "16px 20px",
              borderRadius: 14,
              background: "var(--session-cream-bright)",
              border: "1px solid var(--session-hair)",
              boxShadow: "var(--session-card-shadow, none)",
            }}
          >
            <span style={EYEBROW}>Welcome</span>
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: "var(--font-serif), serif",
                fontSize: 15.5,
                lineHeight: 1.5,
                color: "var(--session-ink-soft)",
              }}
            >
              Start a conversation below — what you confirm becomes your Manual,
              the five layers of how you operate. Nothing&rsquo;s saved unless
              you say so.
            </p>
          </section>
        ) : null}

        <WaysToBegin
          variant="desktop"
          onStartConversation={onStartConversation}
        />

        <LayerIndex
          variant="desktop"
          layers={layers}
          startedCount={startedCount}
          onExploreWithPersona={onExploreWithPersona}
          onNavigateToManual={onNavigateToManual}
        />
      </div>
    </main>
  );
}
