"use client";

import { useEffect, useState } from "react";
import { PERSONA_NAME } from "@/lib/persona/config";
import { renderMarkdown } from "@/lib/utils/format";
import type { AdminData, AdminMessage } from "@/lib/hooks/useAdminData";
import { formatAdminDate, adminMetaStyle, adminEmptyStyle } from "./admin-shared";
import ExtractionPanel, { type ExtractionSnapshot } from "./ExtractionPanel";
import AdminManualView from "./AdminManualView";

type ProfileTab = "sessions" | "manual" | "feedback";

export default function UserProfilePane({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<ProfileTab>("sessions");
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(
    new Set()
  );

  const {
    selectedUser,
    userConversations,
    userManual,
    selectedConversation,
    conversationMessages,
    extractionState,
    profileLoading,
    userFeedback,
    userFeedbackLoaded,
    loadConversationMessages,
    closeConversation,
    loadUserFeedback,
  } = data;

  useEffect(() => {
    if (tab === "feedback" && !userFeedbackLoaded) loadUserFeedback();
  }, [tab, userFeedbackLoaded, loadUserFeedback]);

  // When the selected user changes, reset to the sessions tab.
  useEffect(() => {
    setTab("sessions");
    setExpandedCheckpoints(new Set());
    setShowAllLogs(false);
  }, [selectedUser?.id]);

  if (!selectedUser) {
    return (
      <div
        style={{
          ...adminEmptyStyle,
          padding: "80px 24px",
        }}
      >
        Select a user from the list
      </div>
    );
  }

  const label = selectedUser.display_name || selectedUser.email || "Guest";

  function toggleCheckpointMeta(id: string) {
    setExpandedCheckpoints((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "16px",
            fontWeight: 500,
            color: "var(--session-ink)",
          }}
        >
          {label}
        </div>
        <div style={adminMetaStyle}>
          {selectedUser.conversation_count} session
          {selectedUser.conversation_count !== 1 ? "s" : ""} ·{" "}
          {selectedUser.component_count} component
          {selectedUser.component_count !== 1 ? "s" : ""}
          {selectedUser.last_active
            ? ` · last active ${formatAdminDate(selectedUser.last_active)}`
            : ""}
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "10px 20px",
          borderBottom: "1px solid var(--session-ink-hairline)",
          flexShrink: 0,
        }}
      >
        {(["sessions", "manual", "feedback"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "sessions") closeConversation();
            }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color:
                tab === t
                  ? "var(--session-error)"
                  : "var(--session-ink-ghost)",
              background: "none",
              border: "none",
              borderBottom:
                tab === t
                  ? "1px solid var(--session-error)"
                  : "1px solid transparent",
              padding: "6px 4px",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 40px" }}>
        {profileLoading && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--session-ink-ghost)",
              padding: "40px 0",
              textAlign: "center",
              letterSpacing: "1px",
            }}
          >
            Loading...
          </div>
        )}

        {tab === "sessions" && !profileLoading && !selectedConversation && (
          <SessionsList
            conversations={userConversations}
            onOpen={loadConversationMessages}
          />
        )}

        {tab === "sessions" && selectedConversation && !profileLoading && (
          <MessageThread
            messages={conversationMessages}
            extractionState={extractionState}
            showAllLogs={showAllLogs}
            setShowAllLogs={setShowAllLogs}
            expandedCheckpoints={expandedCheckpoints}
            toggleCheckpointMeta={toggleCheckpointMeta}
            onBack={closeConversation}
          />
        )}

        {tab === "manual" && !profileLoading && (
          <AdminManualView components={userManual} />
        )}

        {tab === "feedback" && !profileLoading && (
          <UserFeedbackList
            items={userFeedback.filter(
              (f) => f.user_email === selectedUser.email
            )}
          />
        )}
      </div>
    </div>
  );
}

function SessionsList({
  conversations,
  onOpen,
}: {
  conversations: AdminData["userConversations"];
  onOpen: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return <div style={adminEmptyStyle}>No conversations</div>;
  }
  return (
    <div>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onOpen(conv.id)}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink)",
            padding: "14px 0",
            borderBottom: "1px solid var(--session-ink-hairline)",
            cursor: "pointer",
            background: "none",
            border: "none",
            width: "100%",
            textAlign: "left" as const,
            display: "block",
          }}
        >
          <div
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {conv.summary || "Untitled session"}
          </div>
          <div style={adminMetaStyle}>
            {conv.message_count} message{conv.message_count !== 1 ? "s" : ""} ·{" "}
            {conv.status} · {formatAdminDate(conv.updated_at)}
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageThread({
  messages,
  extractionState,
  showAllLogs,
  setShowAllLogs,
  expandedCheckpoints,
  toggleCheckpointMeta,
  onBack,
}: {
  messages: AdminMessage[];
  extractionState: Record<string, unknown> | null;
  showAllLogs: boolean;
  setShowAllLogs: (v: boolean) => void;
  expandedCheckpoints: Set<string>;
  toggleCheckpointMeta: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 0 8px",
        }}
      >
        <button
          onClick={onBack}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "1px",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          ← BACK TO SESSIONS
        </button>
        <button
          onClick={() => setShowAllLogs(!showAllLogs)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: showAllLogs
              ? "var(--session-error)"
              : "var(--session-ink-ghost)",
            background: "none",
            border: showAllLogs
              ? "1px solid var(--session-error-ghost)"
              : "1px solid var(--session-ink-hairline)",
            borderRadius: 4,
            padding: "5px 8px",
            cursor: "pointer",
          }}
        >
          {showAllLogs ? "Hide logs" : "Show all logs"}
        </button>
      </div>

      {messages.map((msg) => {
        if (msg.role === "system") return null;
        const isCheckpoint = msg.is_checkpoint && msg.checkpoint_meta;
        const cpMeta = msg.checkpoint_meta as {
          layer?: number;
          name?: string;
          status?: string;
        } | null;

        if (isCheckpoint && msg.role === "assistant") {
          return (
            <div
              key={msg.id}
              style={{
                background:
                  "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
                border: "1px solid var(--session-persona-border)",
                borderRadius: 8,
                padding: "16px 16px 14px",
                margin: "12px 0",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "7px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "var(--session-persona-soft)",
                  marginBottom: 8,
                }}
              >
                ENTRY · LAYER {cpMeta?.layer ?? ""}
                {cpMeta?.status ? ` · ${cpMeta.status.toUpperCase()}` : ""}
              </div>
              {cpMeta?.name && (
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "17px",
                    color: "var(--session-ink)",
                    lineHeight: 1.3,
                    marginBottom: 8,
                  }}
                >
                  {cpMeta.name}
                </div>
              )}
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "14px",
                  lineHeight: 1.75,
                  color: "var(--session-ink-soft)",
                  whiteSpace: "pre-line",
                }}
              >
                {msg.content}
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => toggleCheckpointMeta(msg.id)}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--session-ink-ghost)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  {showAllLogs || expandedCheckpoints.has(msg.id)
                    ? "▾ checkpoint_meta"
                    : "▸ checkpoint_meta"}
                </button>
                {(showAllLogs || expandedCheckpoints.has(msg.id)) && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: "var(--session-ink-faded)",
                      marginTop: 4,
                      padding: 8,
                      background: "var(--session-persona-tint)",
                      borderRadius: 6,
                      whiteSpace: "pre-wrap",
                      overflow: "auto",
                    }}
                  >
                    {JSON.stringify(msg.checkpoint_meta, null, 2)}
                  </div>
                )}
              </div>
              {msg.extraction_snapshot && (
                <ExtractionPanel
                  snapshot={msg.extraction_snapshot as ExtractionSnapshot}
                  forceExpanded={showAllLogs}
                />
              )}
            </div>
          );
        }

        if (msg.role === "user") {
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--session-ink)",
                  lineHeight: 1.55,
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            style={{
              background: "var(--session-persona-tint)",
              borderRadius: 4,
              padding: "14px 16px",
              margin: "8px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "7px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
                marginBottom: 8,
              }}
            >
              {PERSONA_NAME.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "14px",
                lineHeight: 1.75,
                color: "var(--session-ink-faded)",
              }}
            >
              {renderMarkdown(msg.content)}
            </div>
            {msg.extraction_snapshot && (
              <ExtractionPanel
                snapshot={msg.extraction_snapshot as ExtractionSnapshot}
                forceExpanded={showAllLogs}
              />
            )}
          </div>
        );
      })}

      {extractionState && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              marginBottom: 8,
            }}
          >
            EXTRACTION STATE
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--session-ink-faded)",
              padding: 12,
              background: "var(--session-persona-tint)",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              overflow: "auto",
              maxHeight: 400,
            }}
          >
            {JSON.stringify(extractionState, null, 2)}
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div style={adminEmptyStyle}>No messages</div>
      )}
    </div>
  );
}

function UserFeedbackList({
  items,
}: {
  items: AdminData["userFeedback"];
}) {
  if (items.length === 0) {
    return <div style={adminEmptyStyle}>No feedback from this user</div>;
  }
  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            padding: "14px 0",
            borderBottom: "1px solid var(--session-ink-hairline)",
          }}
        >
          <div style={adminMetaStyle}>
            {formatAdminDate(item.created_at)}
            {item.session_id ? ` · ${item.session_id.slice(0, 8)}` : ""}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink)",
              lineHeight: 1.55,
              marginTop: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {item.message}
          </div>
        </div>
      ))}
    </div>
  );
}
