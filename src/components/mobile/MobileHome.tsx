"use client";

import { useState } from "react";
import TopBar from "@/components/shared/TopBar";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import { formatShortDate } from "@/lib/utils/format";

interface MobileHomeProps {
  firstName?: string | null;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  onSelectSession: (id: string) => void;
  onBringSituation: () => void;
  onNavigateToManual: () => void;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
}

const RECENT_LIMIT = 6;

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const tod = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${tod}${name ? `, ${name}` : ""}.`;
}

// Interim Home (Phase 2). Greeting + "bring a situation" + the recent-
// conversations list that used to live in the drawer, so nothing is lost
// when the drawer is retired. Phase 3 layers on the resume hero + the
// 5-layer Manual index and makes Home the landing.
export default function MobileHome({
  firstName,
  conversations,
  activeConversationId,
  onSelectSession,
  onBringSituation,
  onNavigateToManual,
  showTopBar = true,
}: MobileHomeProps) {
  const [showAll, setShowAll] = useState(false);
  const realName = firstName && firstName !== "User" ? firstName : null;
  const recent = showAll ? conversations : conversations.slice(0, RECENT_LIMIT);
  const hiddenCount = conversations.length - RECENT_LIMIT;

  return (
    <main style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {showTopBar && <TopBar />}

      <div
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 22px calc(32px + env(safe-area-inset-bottom, 0px))",
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
          {greeting(realName)}
        </h1>

        <button
          onClick={onBringSituation}
          style={{
            all: "unset",
            cursor: "pointer",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
            margin: "24px 0 8px",
            padding: "18px 20px",
            borderRadius: 14,
            background: "var(--session-walnut)",
            color: "var(--session-cream-bright)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.2px",
            }}
          >
            Bring a situation
          </span>
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
            →
          </span>
        </button>

        {recent.length > 0 && (
          <>
            <p
              style={{
                margin: "28px 0 4px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
              }}
            >
              Continue where you left off
            </p>
            <div>
              {recent.map((conv) => {
                const isActive = conv.id === activeConversationId;
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
                      borderLeft: isActive
                        ? "2px solid var(--session-walnut)"
                        : "2px solid transparent",
                      borderBottom: "1px solid var(--session-hair-soft)",
                      padding: "12px",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-serif), serif",
                        fontSize: 15,
                        color: isActive
                          ? "var(--session-ink)"
                          : "var(--session-ink-soft)",
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
                  padding: "12px",
                  fontFamily: "var(--font-serif), serif",
                  fontSize: 14,
                  color: "var(--session-ink-mid)",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Show all ({conversations.length})
              </button>
            )}
          </>
        )}

        <button
          onClick={onNavigateToManual}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Read your manual <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
