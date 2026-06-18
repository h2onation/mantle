"use client";

import { useState } from "react";
import TopBar from "@/components/shared/TopBar";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ManualEntry, ExplorationContext } from "@/lib/types";
import type { ConversationMode } from "@/lib/persona/config";
import { useHomeModel } from "@/components/home/useHomeModel";
import LayerIndex from "@/components/home/LayerIndex";
import { formatShortDate } from "@/lib/utils/format";

interface MobileHomeProps {
  firstName?: string | null;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  entries: ManualEntry[];
  onSelectSession: (id: string) => void;
  onStartConversation: (mode: ConversationMode) => void;
  onExploreWithPersona: (context: ExplorationContext) => void;
  onNavigateToManual: () => void;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
}

const RECENT_LIMIT = 5;

// Secondary ways to begin, kept reachable from Home. "situation" is the
// primary button above these; Guided intake + Upload would otherwise be
// orphaned for returning users (they used to live only in the session
// entry-cards, which returning users never see).
const SECONDARY_STARTS: { mode: ConversationMode; label: string }[] = [
  { mode: "guided-intake", label: "Let Jove lead with questions" },
  { mode: "upload", label: "Bring something you’ve written" },
];

const EYEBROW: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--session-walnut-meta)",
};

// Home (Phase 3). Greeting → resume hero → bring a situation → the 5-layer
// Manual index (tap a layer to go deeper with Jove) → recent conversations
// (reachability) → read the manual. The landing decision lives in MainApp.
export default function MobileHome({
  firstName,
  conversations,
  activeConversationId,
  entries,
  onSelectSession,
  onStartConversation,
  onExploreWithPersona,
  onNavigateToManual,
  showTopBar = true,
}: MobileHomeProps) {
  const [showAll, setShowAll] = useState(false);
  const { greeting, dateLine, heroConv, heroSnippet, layers, startedCount } =
    useHomeModel({ firstName, conversations, activeConversationId, entries });

  const others = conversations.filter((c) => c.id !== heroConv?.id);
  const recent = showAll ? others : others.slice(0, RECENT_LIMIT);
  const hiddenCount = others.length - RECENT_LIMIT;

  return (
    <main style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {showTopBar && <TopBar />}

      <div
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 22px calc(32px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display), var(--font-serif), serif",
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: "-0.5px",
            color: "var(--session-ink)",
            lineHeight: 1.1,
          }}
        >
          {greeting}
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-ink-faded)",
          }}
        >
          {dateLine}
        </p>

        {/* Resume hero — only when there's a thread to pick up. */}
        {heroConv && (
          <section
            aria-label="Pick up where you left off"
            style={{
              marginTop: 24,
              padding: "18px 20px 20px",
              borderRadius: 16,
              background: "var(--session-cream-bright)",
              border: "1px solid var(--session-hair)",
              boxShadow: "var(--session-card-shadow, none)",
            }}
          >
            <p style={EYEBROW}>Pick up where you left off</p>
            <p
              style={{
                margin: "10px 0 16px",
                fontFamily: "var(--font-serif), serif",
                fontStyle: "italic",
                fontSize: 17,
                lineHeight: 1.45,
                color: "var(--session-ink)",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {heroSnippet}
            </p>
            <button
              onClick={() => onSelectSession(heroConv.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 12,
                background: "var(--session-walnut)",
                color: "var(--session-cream-bright)",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.2px",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Continue this thread <span aria-hidden="true">→</span>
            </button>
          </section>
        )}

        {/* Begin a new conversation — "Bring a situation" is primary; Guided
            intake + Upload are quiet secondary links below it. */}
        <section
          aria-label="Start a conversation"
          style={{
            marginTop: 12,
            padding: "18px 20px 20px",
            borderRadius: 16,
            background: "var(--session-cream)",
            border: "1px solid var(--session-hair-soft)",
          }}
        >
          <p style={EYEBROW}>Something on your mind</p>
          <p
            style={{
              margin: "10px 0 16px",
              fontFamily: "var(--font-serif), serif",
              fontSize: 16,
              lineHeight: 1.45,
              color: "var(--session-ink-soft)",
            }}
          >
            A conflict that keeps repeating, a reaction that surprised you, a win you can&rsquo;t explain.
          </p>
          <button
            onClick={() => onStartConversation("situation")}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 16px",
              borderRadius: 12,
              background: "var(--session-cream-bright)",
              border: "1px solid var(--session-walnut-border)",
              color: "var(--session-walnut)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.2px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Bring a situation <span aria-hidden="true">→</span>
          </button>

          {/* Secondary starts — Guided intake + Upload. */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 6,
              borderTop: "1px solid var(--session-hair-soft)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {SECONDARY_STARTS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => onStartConversation(opt.mode)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "11px 0",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif), serif",
                    fontSize: 14,
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.3,
                  }}
                >
                  {opt.label}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--session-walnut)",
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Manual index — quiet menu of go-deeper actions. */}
        <LayerIndex
          variant="mobile"
          layers={layers}
          startedCount={startedCount}
          onExploreWithPersona={onExploreWithPersona}
          onNavigateToManual={onNavigateToManual}
        />

        {/* Recent conversations — reachability for older threads. */}
        {recent.length > 0 && (
          <section aria-label="Recent conversations" style={{ marginTop: 28 }}>
            <p style={EYEBROW}>Recent</p>
            <div style={{ marginTop: 4 }}>
              {recent.map((conv) => {
                const isText = conv.is_text_channel === true;
                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectSession(conv.id)}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--session-hair-soft)",
                      padding: "12px 4px",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-serif), serif",
                        fontSize: 15,
                        color: "var(--session-ink-soft)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.title || conv.preview || "Untitled session"}
                    </span>
                    {isText && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "1.6px",
                          color: "var(--session-walnut-meta)",
                          flexShrink: 0,
                        }}
                      >
                        TEXT
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "1.4px",
                        color: "var(--session-ink-ghost)",
                        flexShrink: 0,
                      }}
                    >
                      {formatShortDate(conv.updated_at)}
                    </span>
                  </button>
                );
              })}
            </div>
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  padding: "12px 4px",
                  fontFamily: "var(--font-serif), serif",
                  fontSize: 14,
                  color: "var(--session-ink-mid)",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Show all ({others.length})
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
