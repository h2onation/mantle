"use client";

import { useEffect, useRef } from "react";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { MobileView } from "@/components/layout/MobileLayout";
import { formatShortDate } from "@/lib/utils/format";

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  activeView: MobileView;
  manualEntryCount: number;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onNavigateToManual: () => void;
  onNavigateToSettings: () => void;
  onNavigateToCrisis: () => void;
}

export default function SessionDrawer({
  open,
  onClose,
  conversations,
  activeConversationId,
  activeView,
  manualEntryCount,
  onSelectSession,
  onNewSession,
  onNavigateToManual,
  onNavigateToSettings,
  onNavigateToCrisis,
}: SessionDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // a11y: Escape closes, focus moves to close button on open. The drawer
  // claims aria-modal=true so it has to honor keyboard expectations.
  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleNewSession() {
    onClose();
    await onNewSession();
  }

  async function handleSelectSession(convId: string) {
    onClose();
    await onSelectSession(convId);
  }

  function handleNavigateToManual() {
    onClose();
    onNavigateToManual();
  }

  function handleNavigateToSettings() {
    onClose();
    onNavigateToSettings();
  }

  function handleNavigateToCrisis() {
    onClose();
    onNavigateToCrisis();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "var(--session-backdrop-heavy)",
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Drawer panel */}
      <div
        id="session-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-drawer-heading"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "86%",
          maxWidth: 360,
          background: "var(--session-drawer-bg)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          borderRight: "1px solid var(--session-walnut-border)",
          boxShadow: "12px 0 60px rgba(0,0,0,0.55)",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 16px)",
        }}
      >
        {/* Drawer header — wordmark + close */}
        <div
          style={{
            padding: "18px 22px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--session-walnut-border-soft)",
          }}
        >
          <span
            id="session-drawer-heading"
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: "-0.5px",
              color: "var(--session-ink)",
              lineHeight: 1,
            }}
          >
            mywalnut<span style={{ color: "var(--session-walnut)" }}>.</span>
          </span>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--session-button-inset)",
              border: "1px solid var(--session-walnut-border-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--session-ink)",
              fontSize: 14,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Primary actions — New session + Read my Manual, equal weight.
            Two pills stacked so they share visual register. New session is
            the action; Manual is the destination. Both walnut-surface +
            walnut-border, same padding, same type scale. */}
        <div style={{ margin: "16px 18px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryPill
            icon="❦"
            label="My Manual"
            iconColor="var(--session-walnut)"
            count={
              manualEntryCount > 0
                ? `${manualEntryCount} ${manualEntryCount === 1 ? "entry" : "entries"}`
                : null
            }
            isActive={activeView === "manual"}
            onClick={handleNavigateToManual}
          />
          <PrimaryPill
            icon="+"
            label="New session"
            iconColor="var(--session-walnut)"
            isActive={false}
            onClick={handleNewSession}
          />
        </div>

        {/* Sessions label */}
        <div style={{ padding: "8px 22px 4px" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-walnut-meta)",
            }}
          >
            Sessions
          </p>
        </div>

        {/* Session list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 4px",
          }}
        >
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isText = conv.is_text_channel === true;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectSession(conv.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderLeft: isActive
                    ? "2px solid var(--session-walnut)"
                    : "2px solid transparent",
                  borderBottom: "1px solid var(--session-walnut-border-soft)",
                  padding: "12px 14px",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 14,
                    color: isActive ? "var(--session-ink)" : "var(--session-ink-soft)",
                    lineHeight: 1.4,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
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
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "1.4px",
                      color: "var(--session-ink-ghost)",
                    }}
                  >
                    {formatShortDate(conv.updated_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "1.4px",
                      color: "var(--session-ink-ghost)",
                    }}
                  >
                    {conv.message_count} msgs
                  </span>
                </div>
              </button>
            );
          })}

          {conversations.length === 0 && (
            <p
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 13,
                color: "var(--session-ink-mid)",
                padding: "20px",
                textAlign: "center",
              }}
            >
              No sessions yet
            </p>
          )}
        </div>

        {/* Secondary nav — Settings only. Manual lives at the top as a
            primary pill. */}
        <div
          style={{
            borderTop: "1px solid var(--session-walnut-border-soft)",
            padding: "10px 22px 4px",
          }}
        >
          <NavRow
            icon="✷"
            label="Settings"
            isActive={activeView === "settings"}
            onClick={handleNavigateToSettings}
          />
        </div>

        {/* Crisis support — oxblood, footer-anchored. Own destination,
            not a deep-link into Settings — gives the row a real surface
            to land on and matches the user's mental model. */}
        <div
          style={{
            borderTop: "1px solid var(--session-walnut-border-soft)",
            padding: "14px 22px calc(22px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            onClick={handleNavigateToCrisis}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              padding: "8px 0",
              borderLeft: activeView === "crisis"
                ? "2px solid var(--session-error-text)"
                : "2px solid transparent",
              paddingLeft: 8,
              marginLeft: -8,
              WebkitTapHighlightColor: "transparent",
            }}
            aria-label="Open crisis support resources"
          >
            <span
              style={{
                width: 18,
                textAlign: "center",
                color: "var(--session-error-text)",
                fontSize: 14,
              }}
            >
              ◌
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                color: "var(--session-error-text)",
              }}
            >
              Crisis support
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

// Primary action pill — paired use at the top of the drawer for the two
// most-tapped entry points (start fresh, open Manual). Walnut surface +
// border, mono caps-friendly typography. Active state lifts the surface
// to walnut-surface-strong tone and adds a walnut left rail.
function PrimaryPill({
  icon,
  iconColor,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: string;
  iconColor: string;
  label: string;
  count?: string | null;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "14px 16px",
        borderRadius: 10,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-walnut-border)",
        boxShadow: isActive ? "var(--session-card-shadow, none)" : "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        WebkitTapHighlightColor: "transparent",
        position: "relative",
      }}
    >
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -1,
            top: 6,
            bottom: 6,
            width: 2,
            background: "var(--session-walnut)",
            borderRadius: 2,
          }}
        />
      )}
      <span style={{ color: iconColor, fontSize: 16, lineHeight: 1, width: 16, textAlign: "center" }}>
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 15,
          color: "var(--session-ink)",
          textAlign: "left",
        }}
      >
        {label}
      </span>
      {count && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function NavRow({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: string;
  label: string;
  count?: string | null;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "12px 0 12px 8px",
        marginLeft: -8,
        borderLeft: isActive
          ? "2px solid var(--session-walnut)"
          : "2px solid transparent",
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          textAlign: "center",
          color: "var(--session-walnut)",
          fontSize: 14,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 15,
          color: isActive ? "var(--session-ink)" : "var(--session-ink-soft)",
          textAlign: "left",
        }}
      >
        {label}
      </span>
      {count && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
