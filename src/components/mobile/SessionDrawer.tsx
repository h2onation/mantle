"use client";

import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import { formatShortDate } from "@/lib/utils/format";

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export default function SessionDrawer({
  open,
  onClose,
  conversations,
  activeConversationId,
  onSelectSession,
  onNewSession,
}: SessionDrawerProps) {
  async function handleNewSession() {
    onClose();
    await onNewSession();
  }

  async function handleSelectSession(convId: string) {
    onClose();
    await onSelectSession(convId);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "80vw",
          maxWidth: "320px",
          backgroundColor: "var(--color-surface)",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 48px)",
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px 16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-text-ghost)",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            SESSIONS
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-ghost)" strokeWidth="1.5">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* New session button */}
        <div style={{ padding: "0 20px 16px" }}>
          <button
            onClick={handleNewSession}
            style={{
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-accent)",
              background: "none",
              border: "1px solid var(--color-accent-ghost)",
              borderRadius: "8px",
              padding: "12px 16px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            New session
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--color-divider)", margin: "0 20px" }} />

        {/* Session list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
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
                  borderLeft: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                  borderBottom: "1px solid var(--color-divider)",
                  padding: "14px 20px 14px 18px",
                  cursor: "pointer",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: isActive ? "var(--color-text)" : "var(--color-text-dim)",
                    lineHeight: 1.4,
                    margin: "0 0 6px 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {conv.title || conv.preview || "Untitled session"}
                </p>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-text-ghost)",
                      letterSpacing: "1px",
                    }}
                  >
                    {formatShortDate(conv.updated_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-text-ghost)",
                      letterSpacing: "1px",
                    }}
                  >
                    {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            );
          })}

          {conversations.length === 0 && (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-ghost)",
                padding: "20px",
                textAlign: "center",
              }}
            >
              No sessions yet
            </p>
          )}
        </div>
      </div>
    </>
  );
}
