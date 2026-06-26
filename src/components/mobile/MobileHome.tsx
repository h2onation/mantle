"use client";

import { useState } from "react";
import TopBar from "@/components/shared/TopBar";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ManualEntry, ExplorationContext } from "@/lib/types";
import type { ConversationMode } from "@/lib/persona/config";
import { useHomeModel } from "@/components/home/useHomeModel";
import LayerIndex from "@/components/home/LayerIndex";
import WaysToBegin from "@/components/home/WaysToBegin";
import { APP_COPY_DEFAULTS, type AppCopy } from "@/lib/persona/app-copy";
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
  // Which entry doors are live (per-mode feature gates). A disabled door
  // renders as "Coming soon". Situation is always true.
  enabledModes: Record<ConversationMode, boolean>;
  // Admin-editable onboarding/Home copy. Defaults to the shipped strings.
  appCopy?: AppCopy;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
}

const RECENT_LIMIT = 5;

const EYEBROW: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--session-walnut-meta)",
};

// Home (Phase 3). Greeting → resume hero → ways to begin (the three doors,
// shared with desktop) → the 5-layer Manual index (tap a layer to go deeper
// with Jove) → recent conversations (reachability) → read the manual. The
// landing decision lives in MainApp.
export default function MobileHome({
  firstName,
  conversations,
  activeConversationId,
  entries,
  onSelectSession,
  onStartConversation,
  onExploreWithPersona,
  onNavigateToManual,
  enabledModes,
  appCopy = APP_COPY_DEFAULTS,
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

        {/* Top slot: resume for returning users; an orienting tile for a
            brand-new user (nothing to resume, no entries yet). */}
        {heroConv ? (
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
        ) : startedCount === 0 ? (
          <section
            aria-label={appCopy.home.welcomeEyebrow}
            style={{
              marginTop: 24,
              padding: "18px 20px 20px",
              borderRadius: 16,
              background: "var(--session-cream-bright)",
              border: "1px solid var(--session-hair)",
              boxShadow: "var(--session-card-shadow, none)",
            }}
          >
            <p style={EYEBROW}>{appCopy.home.welcomeEyebrow}</p>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: "var(--font-serif), serif",
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--session-ink-soft)",
              }}
            >
              {appCopy.home.welcomeBody}
            </p>
          </section>
        ) : null}

        {/* Begin a new conversation — the same three doors desktop shows,
            stacked into one column (shared WaysToBegin). */}
        <WaysToBegin
          variant="mobile"
          onStartConversation={onStartConversation}
          enabledModes={enabledModes}
          appCopy={appCopy}
        />

        {/* Manual index — quiet menu of go-deeper actions. */}
        <LayerIndex
          variant="mobile"
          layers={layers}
          startedCount={startedCount}
          onExploreWithPersona={onExploreWithPersona}
          onNavigateToManual={onNavigateToManual}
          appCopy={appCopy}
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
