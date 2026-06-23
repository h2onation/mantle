"use client";

import { useState } from "react";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ManualEntry, ExplorationContext } from "@/lib/types";
import type { ConversationMode } from "@/lib/persona/config";
import { useHomeModel } from "@/components/home/useHomeModel";
import LayerIndex from "@/components/home/LayerIndex";

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

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

const IC_BOOKMARK = "M4.5 2.5h9v13l-4.5-3-4.5 3z";
const IC_CHAT = "M3 4.5h12v8H8l-3.5 2.8V12.5H3z";
const IC_LIST = "M6.5 5h8M6.5 9h8M6.5 13h8M3.5 5h.01M3.5 9h.01M3.5 13h.01";
const IC_UPLOAD = "M9 11.5V3M6 6l3-3 3 3M4 14.5h10";

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

  const ways = [
    {
      key: "situation",
      icon: IC_CHAT,
      title: "Bring a situation",
      desc: "A reaction that surprised you, a conflict that keeps repeating.",
      cue: "Start",
      onClick: () => onStartConversation("situation"),
    },
    {
      key: "guided",
      icon: IC_LIST,
      title: "Guided",
      desc: "Walk through it step by step with Jove.",
      cue: "Begin",
      onClick: () => onStartConversation("guided-intake"),
    },
    {
      key: "upload",
      icon: IC_UPLOAD,
      title: "Upload",
      desc: "Bring something you’ve already written.",
      cue: "Add",
      onClick: () => onStartConversation("upload"),
    },
  ];

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
                <Icon d={IC_BOOKMARK} size={13} />
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

        {/* Ways to begin — three equal entry points. */}
        <p style={{ ...EYEBROW, marginTop: 26 }}>Ways to begin</p>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          {ways.map((w) => (
            <button
              key={w.key}
              onClick={w.onClick}
              onMouseEnter={() => setHovered(w.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxSizing: "border-box",
                padding: "18px 18px 15px",
                borderRadius: 14,
                background:
                  hovered === w.key
                    ? "var(--session-cream-bright)"
                    : "var(--session-cream)",
                border: `1px solid ${
                  hovered === w.key
                    ? "var(--session-walnut-border-soft)"
                    : "var(--session-hair-soft)"
                }`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--session-walnut-tint)",
                  color: "var(--session-walnut)",
                }}
              >
                <Icon d={w.icon} size={18} />
              </span>
              <span
                style={{
                  marginTop: 12,
                  fontFamily: "var(--font-serif), serif",
                  fontSize: 16,
                  color: "var(--session-ink)",
                  lineHeight: 1.2,
                }}
              >
                {w.title}
              </span>
              <span
                style={{
                  flex: 1,
                  marginTop: 4,
                  fontFamily: "var(--font-serif), serif",
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: "var(--session-ink-mid)",
                }}
              >
                {w.desc}
              </span>
              <span
                style={{
                  marginTop: 13,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--session-walnut)",
                }}
              >
                {w.cue} →
              </span>
            </button>
          ))}
        </div>

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
