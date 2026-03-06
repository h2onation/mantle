"use client";

import { useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { buildLayers } from "./manual/layer-definitions";
import PopulatedLayer from "./manual/PopulatedLayer";
import EmptyLayer from "./manual/EmptyLayer";
import { renderMarkdown } from "@/lib/utils/format";
import type { ManualComponent } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  display_name: string | null;
  email: string;
  conversation_count: number;
  component_count: number;
  is_anonymous: boolean;
  created_at: string;
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

type AdminViewState = "hidden" | "users" | "profile";

// ── Helpers ──────────────────────────────────────────────────────────

function formatAdminDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const mm = m < 10 ? `0${m}` : m;
  return `${months[d.getMonth()]} ${d.getDate()}, ${h12}:${mm} ${ampm}`;
}

function adminUserLabel(user: AdminUser): string {
  return user.email
    ? (user.display_name || user.email)
    : `Guest — ${formatAdminDate(user.created_at)}`;
}

// ── Component ────────────────────────────────────────────────────────

export default function AdminView() {
  const isAdmin = useIsAdmin();

  // Core state
  const [adminView, setAdminView] = useState<AdminViewState>("hidden");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Profile overlay state
  const [profileTab, setProfileTab] = useState<"sessions" | "manual">("sessions");
  const [userConversations, setUserConversations] = useState<AdminConversation[]>([]);
  const [userManual, setUserManual] = useState<ManualComponent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AdminMessage[]>([]);
  const [extractionState, setExtractionState] = useState<Record<string, unknown> | null>(null);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(new Set());

  if (!isAdmin) return null;

  // ── Data fetching ────────────────────────────────────────────────

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

  async function openUserProfile(user: AdminUser) {
    setSelectedUser(user);
    setProfileTab("sessions");
    setSelectedConversation(null);
    setConversationMessages([]);
    setExtractionState(null);
    setExpandedCheckpoints(new Set());
    setAdminView("profile");
    setAdminLoading(true);

    try {
      const [convRes, manualRes] = await Promise.all([
        fetch("/api/admin/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        }),
        fetch("/api/admin/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        }),
      ]);

      if (convRes.ok) {
        const convData = await convRes.json();
        setUserConversations(convData.conversations || []);
      }
      if (manualRes.ok) {
        const manualData = await manualRes.json();
        setUserManual(manualData.components || []);
      }
    } catch (err) {
      console.error("[admin] Failed to load user profile:", err);
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    setSelectedConversation(conversationId);
    setExpandedCheckpoints(new Set());
    setAdminLoading(true);

    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversationMessages(data.messages || []);
      setExtractionState(data.extractionState || null);
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

  function closeProfile() {
    setAdminView("users");
    setSelectedUser(null);
    setSelectedConversation(null);
    setConversationMessages([]);
    setExtractionState(null);
    setUserConversations([]);
    setUserManual([]);
  }

  // ── Shared styles ────────────────────────────────────────────────

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

  // ── Inline settings (hidden + users) ─────────────────────────────

  return (
    <div>
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
          {adminLoading ? "Loading..." : "Debug audit"}
        </button>
      )}

      {/* User list */}
      {adminView === "users" && (
        <div>
          <button
            onClick={() => { setSearchQuery(""); setAdminView("hidden"); }}
            style={{
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
            }}
          >
            ← BACK
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or date..."
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink)",
              background: "var(--color-surface)",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 6,
              padding: "8px 10px",
              width: "100%",
              marginBottom: 10,
              outline: "none",
              boxSizing: "border-box" as const,
            }}
          />
          {(() => {
            const query = searchQuery.toLowerCase().trim();
            const filteredUsers = query
              ? adminUsers.filter((u) => {
                  const label = adminUserLabel(u).toLowerCase();
                  const email = (u.email || "").toLowerCase();
                  return label.includes(query) || email.includes(query);
                })
              : adminUsers;
            return (
              <>
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => openUserProfile(user)}
                    style={listItemStyle}
                  >
                    <div>{adminUserLabel(user)}</div>
                    <div style={metaStyle}>
                      {user.conversation_count} session{user.conversation_count !== 1 ? "s" : ""} · {user.component_count} component{user.component_count !== 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
                {filteredUsers.length === 0 && !adminLoading && (
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink-ghost)",
                      padding: "14px 0",
                    }}
                  >
                    {query ? "No matching users" : "No users found"}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Full-screen profile overlay ─────────────────────────── */}
      {adminView === "profile" && selectedUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "var(--session-linen)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={closeProfile}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "1px",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                minWidth: 60,
                textAlign: "left",
              }}
            >
              ← BACK
            </button>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: "var(--session-ink-faded)",
                textAlign: "center",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: "0 8px",
              }}
            >
              {adminUserLabel(selectedUser)}
            </div>
            <button
              onClick={() => { setAdminView("hidden"); setSelectedUser(null); }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--color-error)",
                letterSpacing: "1px",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                minWidth: 60,
                textAlign: "right",
              }}
            >
              CLOSE
            </button>
          </div>

          {/* Admin banner */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--color-error)",
              textAlign: "center",
              padding: "8px 0",
              borderTop: "1px solid var(--color-error-ghost)",
              borderBottom: "1px solid var(--color-error-ghost)",
              background: "var(--color-admin-banner-bg)",
              flexShrink: 0,
            }}
          >
            READ ONLY — ADMIN VIEW
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 32,
              padding: "12px 0",
              flexShrink: 0,
            }}
          >
            {(["sessions", "manual"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setProfileTab(tab);
                  if (tab === "sessions") {
                    setSelectedConversation(null);
                    setConversationMessages([]);
                    setExtractionState(null);
                  }
                }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: profileTab === tab ? "var(--color-error)" : "var(--session-ink-ghost)",
                  background: "none",
                  border: "none",
                  borderBottom: profileTab === tab ? "1px solid var(--color-error)" : "1px solid transparent",
                  padding: "6px 4px",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 16px 40px",
            }}
          >
            {adminLoading && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--session-ink-ghost)",
                  textAlign: "center",
                  padding: "40px 0",
                  letterSpacing: "1px",
                }}
              >
                Loading...
              </div>
            )}

            {/* ── Sessions tab ──────────────────────────────────── */}
            {profileTab === "sessions" && !adminLoading && (
              <>
                {/* Conversation list (no conversation selected) */}
                {!selectedConversation && (
                  <div>
                    {userConversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => loadMessages(conv.id)}
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
                          {conv.message_count} message{conv.message_count !== 1 ? "s" : ""} · {conv.status} · {formatAdminDate(conv.updated_at)}
                        </div>
                      </button>
                    ))}
                    {userConversations.length === 0 && (
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: "var(--session-ink-ghost)",
                          padding: "40px 0",
                          textAlign: "center",
                        }}
                      >
                        No conversations
                      </div>
                    )}
                  </div>
                )}

                {/* Message thread (conversation selected) */}
                {selectedConversation && (
                  <div>
                    <button
                      onClick={() => {
                        setSelectedConversation(null);
                        setConversationMessages([]);
                        setExtractionState(null);
                      }}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "1px",
                        background: "none",
                        border: "none",
                        padding: "12px 0",
                        cursor: "pointer",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      ← BACK TO SESSIONS
                    </button>

                    {/* Messages */}
                    {conversationMessages.map((msg) => {
                      // Hide system messages
                      if (msg.role === "system") return null;

                      const isCheckpoint = msg.is_checkpoint && msg.checkpoint_meta;
                      const cpMeta = msg.checkpoint_meta as { layer?: number; type?: string; name?: string; status?: string } | null;
                      const isPattern = cpMeta?.type === "pattern";

                      // Checkpoint card
                      if (isCheckpoint && msg.role === "assistant") {
                        return (
                          <div
                            key={msg.id}
                            style={{
                              background: isPattern
                                ? "var(--session-navy-bg)"
                                : "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
                              border: isPattern
                                ? "1px solid var(--session-navy-border)"
                                : "1px solid var(--session-sage-border)",
                              borderRadius: 8,
                              padding: "16px 16px 14px",
                              margin: "12px 0",
                            }}
                          >
                            {/* Checkpoint label */}
                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "7px",
                                letterSpacing: "2px",
                                textTransform: "uppercase",
                                color: isPattern ? "var(--session-navy-label)" : "var(--session-sage-soft)",
                                marginBottom: 8,
                              }}
                            >
                              {isPattern ? "PATTERN" : "COMPONENT"} · LAYER {cpMeta?.layer ?? ""}
                              {cpMeta?.status ? ` · ${cpMeta.status.toUpperCase()}` : ""}
                            </div>

                            {/* Name (if present) */}
                            {cpMeta?.name && (
                              <div
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: "17px",
                                  fontWeight: 400,
                                  color: isPattern ? "var(--session-navy-label)" : "var(--session-ink)",
                                  lineHeight: 1.3,
                                  marginBottom: 8,
                                }}
                              >
                                {cpMeta.name}
                              </div>
                            )}

                            {/* Content */}
                            <div
                              style={{
                                fontFamily: isPattern ? "var(--font-sans)" : "var(--font-serif)",
                                fontSize: isPattern ? "13px" : "14px",
                                lineHeight: isPattern ? 1.65 : 1.75,
                                color: isPattern ? "var(--session-ink-faded)" : "var(--session-ink-soft)",
                                whiteSpace: "pre-line",
                              }}
                            >
                              {msg.content}
                            </div>

                            {/* Collapsible checkpoint_meta */}
                            <div style={{ marginTop: 10 }}>
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
                                    background: isPattern ? "rgba(45, 55, 80, 0.06)" : "var(--session-sage-tint)",
                                    borderRadius: 6,
                                    whiteSpace: "pre-wrap",
                                    overflow: "auto",
                                  }}
                                >
                                  {JSON.stringify(msg.checkpoint_meta, null, 2)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // User message
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

                      // Assistant message (non-checkpoint)
                      return (
                        <div
                          key={msg.id}
                          style={{
                            background: "var(--session-sage-tint)",
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
                            SAGE
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
                        </div>
                      );
                    })}

                    {/* Extraction state */}
                    {extractionState && (
                      <div style={{ marginTop: 24 }}>
                        <button
                          onClick={() => setExtractionState(
                            extractionState ? extractionState : null
                          )}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "8px",
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: "var(--session-ink-ghost)",
                            marginBottom: 8,
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "default",
                          }}
                        >
                          EXTRACTION STATE
                        </button>
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
                          {JSON.stringify(extractionState, null, 2)}
                        </div>
                      </div>
                    )}

                    {conversationMessages.length === 0 && !adminLoading && (
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          color: "var(--session-ink-ghost)",
                          padding: "40px 0",
                          textAlign: "center",
                        }}
                      >
                        No messages
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Manual tab ────────────────────────────────────── */}
            {profileTab === "manual" && !adminLoading && (
              <AdminManualView components={userManual} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Read-only manual view (uses real components with readOnly) ───────

function AdminManualView({ components }: { components: ManualComponent[] }) {
  const layers = buildLayers(components);
  const populatedLayers = layers.filter((l) => l.component !== null || l.patterns.length > 0);
  const emptyLayers = layers.filter((l) => l.component === null && l.patterns.length === 0);
  const isEmpty = populatedLayers.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink-ghost)",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        No manual entries yet
      </div>
    );
  }

  return (
    <div>
      {/* Populated layers */}
      {populatedLayers.map((layer) => (
        <PopulatedLayer key={layer.id} layer={layer} readOnly />
      ))}

      {/* Empty layers */}
      {emptyLayers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              margin: "16px 0 8px",
            }}
          >
            UPCOMING
          </div>
          {emptyLayers.map((layer) => (
            <EmptyLayer key={layer.id} layer={layer} readOnly />
          ))}
        </>
      )}
    </div>
  );
}
