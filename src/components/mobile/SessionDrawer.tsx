"use client";

import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import { formatShortDate } from "@/lib/utils/format";

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  manualEntryCount: number;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onNavigateToManual: () => void;
  onNavigateToSettings: () => void;
  onOpenFeedback: () => void;
}

export default function SessionDrawer({
  open,
  onClose,
  conversations,
  activeConversationId,
  manualEntryCount,
  onSelectSession,
  onNewSession,
  onNavigateToManual,
  onNavigateToSettings,
  onOpenFeedback,
}: SessionDrawerProps) {
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

  function handleOpenFeedback() {
    onClose();
    onOpenFeedback();
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
          background: "rgba(20,22,28,0.92)",
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
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.30)",
              border: "1px solid rgba(255,255,255,0.10)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.85)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* New session pill */}
        <button
          onClick={handleNewSession}
          style={{
            all: "unset",
            cursor: "pointer",
            margin: "16px 18px 8px",
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--session-walnut-surface)",
            border: "1px solid var(--session-walnut-border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--session-walnut)", fontSize: 16, lineHeight: 1 }}>+</span>
          <span
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 15,
              color: "var(--session-ink)",
            }}
          >
            New session
          </span>
        </button>

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

        {/* Primary nav rows — Manual, Settings, Feedback */}
        <div
          style={{
            borderTop: "1px solid var(--session-walnut-border-soft)",
            padding: "10px 22px 4px",
          }}
        >
          <NavRow
            icon="❦"
            label="Read my Manual"
            count={
              manualEntryCount > 0
                ? `${manualEntryCount} ${manualEntryCount === 1 ? "entry" : "entries"}`
                : null
            }
            onClick={handleNavigateToManual}
          />
          <NavRow icon="✷" label="Settings" onClick={handleNavigateToSettings} />
          <NavRow icon="✎" label="Beta feedback" onClick={handleOpenFeedback} />
        </div>

        {/* Crisis support — oxblood, footer-anchored */}
        <div
          style={{
            borderTop: "1px solid var(--session-walnut-border-soft)",
            padding: "14px 22px calc(22px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            onClick={handleNavigateToSettings}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
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

function NavRow({
  icon,
  label,
  count,
  onClick,
}: {
  icon: string;
  label: string;
  count?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "12px 0",
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
