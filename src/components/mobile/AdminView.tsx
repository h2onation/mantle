"use client";

import { useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

interface AdminUser {
  id: string;
  display_name: string | null;
  email: string;
  conversation_count: number;
  component_count: number;
}

interface AdminConversation {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface AdminMessage {
  id: string;
  role: string;
  content: string;
  is_checkpoint: boolean;
  checkpoint_meta: Record<string, unknown> | null;
  processing_text: string | null;
  created_at: string;
}

type AdminViewState = "hidden" | "users" | "conversations" | "messages";

export default function AdminView() {
  const isAdmin = useIsAdmin();

  const [adminView, setAdminView] = useState<AdminViewState>("hidden");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminConversations, setAdminConversations] = useState<AdminConversation[]>([]);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [adminExtractionState, setAdminExtractionState] = useState<Record<string, unknown> | null>(null);
  const [adminSelectedUser, setAdminSelectedUser] = useState<AdminUser | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(new Set());

  if (!isAdmin) return null;

  async function loadAdminUsers() {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setAdminUsers(data.users || []);
      setAdminView("users");
    } catch (err) {
      console.error("[admin] Failed to load users:", err);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAdminConversations(user: AdminUser) {
    setAdminLoading(true);
    setAdminSelectedUser(user);
    try {
      const res = await fetch("/api/admin/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setAdminConversations(data.conversations || []);
      setAdminView("conversations");
    } catch (err) {
      console.error("[admin] Failed to load conversations:", err);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAdminMessages(conversationId: string) {
    setAdminLoading(true);
    setExpandedCheckpoints(new Set());
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setAdminMessages(data.messages || []);
      setAdminExtractionState(data.extractionState || null);
      setAdminView("messages");
    } catch (err) {
      console.error("[admin] Failed to load messages:", err);
    } finally {
      setAdminLoading(false);
    }
  }

  function toggleCheckpointMeta(msgId: string) {
    setExpandedCheckpoints((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }

  const backButtonStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    color: "var(--session-ink-ghost)",
    cursor: "pointer",
    marginBottom: 12,
    letterSpacing: "1px",
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left" as const,
    WebkitTapHighlightColor: "transparent",
  };

  const listItemStyle = {
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
    WebkitTapHighlightColor: "transparent",
  };

  const metaStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    color: "var(--session-ink-ghost)",
    marginTop: 4,
    letterSpacing: "0.5px",
  };

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section header */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--color-error)",
          marginBottom: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--session-ink-hairline)",
        }}
      >
        ADMIN
      </div>

      {/* Entry point */}
      {adminView === "hidden" && (
        <button
          onClick={loadAdminUsers}
          disabled={adminLoading}
          style={{
            ...listItemStyle,
            color: "var(--color-error)",
            borderBottom: "none",
            padding: "18px 0",
            opacity: adminLoading ? 0.5 : 1,
          }}
        >
          {adminLoading ? "Loading..." : "View user conversations"}
        </button>
      )}

      {/* User list */}
      {adminView === "users" && (
        <div>
          <button
            onClick={() => setAdminView("hidden")}
            style={backButtonStyle}
          >
            ← BACK
          </button>
          {adminUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => loadAdminConversations(user)}
              style={listItemStyle}
            >
              <div>{user.display_name || user.email || "Anonymous"}</div>
              <div style={metaStyle}>
                {user.conversation_count} session{user.conversation_count !== 1 ? "s" : ""} · {user.component_count} component{user.component_count !== 1 ? "s" : ""}
              </div>
            </button>
          ))}
          {adminUsers.length === 0 && !adminLoading && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink-ghost)",
                padding: "14px 0",
              }}
            >
              No users found
            </div>
          )}
        </div>
      )}

      {/* Conversation list */}
      {adminView === "conversations" && adminSelectedUser && (
        <div>
          <button
            onClick={() => setAdminView("users")}
            style={backButtonStyle}
          >
            ← BACK TO USERS
          </button>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink-faded)",
              marginBottom: 12,
            }}
          >
            {adminSelectedUser.display_name || adminSelectedUser.email || "Anonymous"}
          </div>
          {adminConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadAdminMessages(conv.id)}
              style={listItemStyle}
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
              <div style={metaStyle}>
                {conv.message_count} message{conv.message_count !== 1 ? "s" : ""} · {conv.status}
              </div>
            </button>
          ))}
          {adminConversations.length === 0 && !adminLoading && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink-ghost)",
                padding: "14px 0",
              }}
            >
              No conversations
            </div>
          )}
        </div>
      )}

      {/* Message thread */}
      {adminView === "messages" && (
        <div>
          <button
            onClick={() => setAdminView("conversations")}
            style={backButtonStyle}
          >
            ← BACK TO SESSIONS
          </button>

          {/* Read-only banner */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--color-error)",
              textAlign: "center",
              padding: "8px 0",
              marginBottom: 16,
              borderTop: "1px solid var(--color-error-ghost)",
              borderBottom: "1px solid var(--color-error-ghost)",
              background: "var(--color-admin-banner-bg)",
            }}
          >
            READ ONLY — ADMIN VIEW
          </div>

          {/* Messages */}
          {adminMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: msg.role === "user" ? "var(--session-ink)" : "var(--session-ink-faded)",
                padding: "10px 0",
                borderBottom: "1px solid var(--session-ink-hairline)",
                opacity: msg.role === "system" ? 0.4 : 1,
              }}
            >
              {/* Role label */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: msg.role === "user"
                    ? "var(--session-sage)"
                    : "var(--session-ink-ghost)",
                  marginBottom: 6,
                }}
              >
                {msg.role.toUpperCase()}
                {msg.is_checkpoint && " · CHECKPOINT"}
              </div>

              {/* Content */}
              <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>

              {/* Checkpoint meta (collapsible) */}
              {msg.checkpoint_meta && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => toggleCheckpointMeta(msg.id)}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      color: "var(--session-ink-ghost)",
                      letterSpacing: "0.5px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {expandedCheckpoints.has(msg.id) ? "▾ checkpoint_meta" : "▸ checkpoint_meta"}
                  </button>
                  {expandedCheckpoints.has(msg.id) && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "var(--session-ink-faded)",
                        marginTop: 4,
                        padding: 8,
                        background: "var(--session-sage-tint)",
                        borderRadius: 6,
                        whiteSpace: "pre-wrap",
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(msg.checkpoint_meta, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Extraction state viewer */}
          {adminExtractionState && (
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
                  background: "var(--session-sage-tint)",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                  maxHeight: 400,
                }}
              >
                {JSON.stringify(adminExtractionState, null, 2)}
              </div>
            </div>
          )}

          {adminMessages.length === 0 && !adminLoading && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink-ghost)",
                padding: "14px 0",
              }}
            >
              No messages
            </div>
          )}
        </div>
      )}
    </div>
  );
}
