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
  extraction_snapshot: Record<string, unknown> | null;
}

interface ExtractionGate {
  concrete_examples: number;
  has_mechanism: boolean;
  has_charged_language: boolean;
  has_behavior_driver_link: boolean;
  strongest_layer: number | null;
}

interface ExtractionSnapshot {
  depth?: string;
  mode?: string;
  checkpoint_gate?: ExtractionGate;
  sage_brief?: string;
  [key: string]: unknown;
}

interface AdminFeedbackItem {
  id: string;
  user_email: string;
  message: string;
  session_id: string | null;
  created_at: string;
}

type AdminViewState = "hidden" | "profile";

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

// ── Extraction snapshot panel ────────────────────────────────────────

function ExtractionPanel({ snapshot, forceExpanded }: { snapshot: ExtractionSnapshot; forceExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const isExpanded = forceExpanded || expanded;

  const gate = snapshot.checkpoint_gate;
  const gateMet = gate
    ? gate.concrete_examples >= 2 && gate.has_mechanism && gate.has_charged_language && gate.has_behavior_driver_link
    : false;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          color: "var(--session-ink-ghost)",
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          letterSpacing: "1px",
          textTransform: "uppercase" as const,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {isExpanded ? "▾" : "▸"} EXTRACTION
      </button>

      {isExpanded && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--session-ink-faded)",
            background: "var(--session-linen)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 6,
            padding: 8,
            marginTop: 4,
            lineHeight: 1.6,
          }}
        >
          <div>Depth: {snapshot.depth || "none"} | Mode: {snapshot.mode || "none"}</div>
          {gate && (
            <>
              <div>
                Gate: {gate.concrete_examples} examples, mechanism: {gate.has_mechanism ? "y" : "n"}, charged: {gate.has_charged_language ? "y" : "n"}, driver: {gate.has_behavior_driver_link ? "y" : "n"}
              </div>
              <div>
                Gate met: {gateMet ? "yes" : "no"} | Strongest: L{gate.strongest_layer ?? "?"}
              </div>
            </>
          )}
          {snapshot.sage_brief && (
            <div style={{ marginTop: 2 }}>
              Brief: {snapshot.sage_brief.substring(0, 200)}{snapshot.sage_brief.length > 200 ? "..." : ""}
            </div>
          )}

          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--session-ink-ghost)",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              marginTop: 6,
              letterSpacing: "0.5px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {showRaw ? "▾ RAW JSON" : "▸ RAW JSON"}
          </button>
          {showRaw && (
            <div
              style={{
                marginTop: 4,
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: 300,
                fontSize: "9px",
              }}
            >
              {JSON.stringify(snapshot, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function AdminView() {
  const isAdmin = useIsAdmin();

  // Core state
  const [adminView, setAdminView] = useState<AdminViewState>("hidden");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Profile overlay state
  const [profileTab, setProfileTab] = useState<"sessions" | "manual" | "feedback">("sessions");
  const [userConversations, setUserConversations] = useState<AdminConversation[]>([]);
  const [userManual, setUserManual] = useState<ManualComponent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AdminMessage[]>([]);
  const [extractionState, setExtractionState] = useState<Record<string, unknown> | null>(null);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState<Set<string>>(new Set());
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([]);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  if (!isAdmin) return null;

  // ── Data fetching ────────────────────────────────────────────────

  async function loadAdminUsers() {
    setAdminLoading(true);
    try {
      // Load users and global feedback in parallel
      const [usersRes, feedbackRes] = await Promise.all([
        fetch("/api/admin/users"),
        !feedbackLoaded ? fetch("/api/admin/feedback") : Promise.resolve(null),
      ]);

      if (feedbackRes && feedbackRes.ok) {
        const fbData = await feedbackRes.json();
        setFeedbackItems(fbData.feedback || []);
        setFeedbackLoaded(true);
      }

      if (!usersRes.ok) {
        setAdminLoading(false);
        return;
      }
      const data = await usersRes.json();
      const users: AdminUser[] = data.users || [];
      setAdminUsers(users);
      if (users.length > 0) {
        // Auto-open first user — openUserProfile manages its own loading state
        openUserProfile(users[0]);
      } else {
        setAdminLoading(false);
      }
    } catch (err) {
      console.error("[admin] Failed to load users:", err);
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
    setShowUserPicker(false);
    setPickerSearch("");
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
    setShowAllLogs(false);
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

  async function loadFeedback() {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      if (!res.ok) return;
      const data = await res.json();
      setFeedbackItems(data.feedback || []);
      setFeedbackLoaded(true);
    } catch (err) {
      console.error("[admin] Failed to load feedback:", err);
    } finally {
      setAdminLoading(false);
    }
  }

  function closeProfile() {
    setAdminView("hidden");
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
            color: "var(--session-error)",
            borderBottom: "none",
            padding: "18px 0",
            opacity: adminLoading ? 0.5 : 1,
          }}
        >
          {adminLoading ? "Loading..." : "Debug audit"}
        </button>
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
            <div style={{ flex: 1 }} />
            <button
              onClick={() => { setAdminView("hidden"); setSelectedUser(null); }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--session-error)",
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

          {/* User picker dropdown — hidden on feedback tab */}
          {showUserPicker && profileTab !== "feedback" && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setShowUserPicker(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 310,
                }}
              />
              {/* Panel */}
              <div
                style={{
                  position: "relative",
                  zIndex: 320,
                  background: "var(--session-linen)",
                  borderBottom: "1px solid var(--session-ink-hairline)",
                  padding: "8px 16px 12px",
                  maxHeight: "60vh",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search users..."
                  autoFocus
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink)",
                    background: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    width: "100%",
                    marginBottom: 8,
                    outline: "none",
                    boxSizing: "border-box" as const,
                  }}
                />
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {(() => {
                    const pq = pickerSearch.toLowerCase().trim();
                    const filtered = pq
                      ? adminUsers.filter((u) => {
                          const label = adminUserLabel(u).toLowerCase();
                          const email = (u.email || "").toLowerCase();
                          return label.includes(pq) || email.includes(pq);
                        })
                      : adminUsers;
                    return (
                      <>
                        {filtered.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setShowUserPicker(false);
                              setPickerSearch("");
                              openUserProfile(user);
                            }}
                            style={{
                              ...listItemStyle,
                              opacity: user.id === selectedUser?.id ? 0.4 : 1,
                            }}
                          >
                            <div>{adminUserLabel(user)}</div>
                            <div style={metaStyle}>
                              {user.conversation_count} session{user.conversation_count !== 1 ? "s" : ""} · {user.component_count} component{user.component_count !== 1 ? "s" : ""}
                            </div>
                          </button>
                        ))}
                        {filtered.length === 0 && (
                          <div
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "13px",
                              color: "var(--session-ink-ghost)",
                              padding: "14px 0",
                            }}
                          >
                            {pq ? "No matching users" : "No users found"}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {/* Admin banner */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-error)",
              textAlign: "center",
              padding: "8px 0",
              borderTop: "1px solid var(--session-error-ghost)",
              borderBottom: "1px solid var(--session-error-ghost)",
              background: "var(--session-error-banner)",
              flexShrink: 0,
            }}
          >
            READ ONLY — ADMIN VIEW
          </div>

          {/* ── Viewing user selector (hidden on feedback tab) ── */}
          {profileTab !== "feedback" && <div
            style={{
              padding: "10px 16px 6px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-ink-ghost)",
                marginBottom: 6,
              }}
            >
              VIEWING USER
            </div>
            <button
              onClick={() => { setShowUserPicker((v) => !v); setPickerSearch(""); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink)",
                background: "rgba(255, 255, 255, 0.6)",
                border: "1px solid var(--session-ink-hairline)",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                boxSizing: "border-box" as const,
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  textAlign: "left",
                }}
              >
                {adminUserLabel(selectedUser)}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--session-ink-ghost)",
                  marginLeft: 8,
                  flexShrink: 0,
                }}
              >
                {showUserPicker ? "▲" : "▼"}
              </span>
            </button>
          </div>}

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
            {(["sessions", "manual", "feedback"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setProfileTab(tab);
                  if (tab === "sessions") {
                    setSelectedConversation(null);
                    setConversationMessages([]);
                    setExtractionState(null);
                  }
                  if (tab === "feedback") {
                    setShowUserPicker(false);
                    if (!feedbackLoaded) loadFeedback();
                  }
                }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: profileTab === tab ? "var(--session-error)" : "var(--session-ink-ghost)",
                  background: "none",
                  border: "none",
                  borderBottom: profileTab === tab ? "1px solid var(--session-error)" : "1px solid transparent",
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

                    {/* Log toggle */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        paddingBottom: 8,
                      }}
                    >
                      <button
                        onClick={() => setShowAllLogs((v) => !v)}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          color: showAllLogs ? "var(--session-error)" : "var(--session-ink-ghost)",
                          background: "none",
                          border: showAllLogs ? "1px solid var(--session-error-ghost)" : "1px solid var(--session-ink-hairline)",
                          borderRadius: 4,
                          padding: "5px 8px",
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        {showAllLogs ? "Hide logs" : "Show all logs"}
                      </button>
                    </div>

                    {/* Messages */}
                    {conversationMessages.map((msg) => {
                      // Hide system messages
                      if (msg.role === "system") return null;

                      const isCheckpoint = msg.is_checkpoint && msg.checkpoint_meta;
                      const cpMeta = msg.checkpoint_meta as { layer?: number; name?: string; status?: string } | null;

                      // Checkpoint card
                      if (isCheckpoint && msg.role === "assistant") {
                        return (
                          <div
                            key={msg.id}
                            style={{
                              background: "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
                              border: "1px solid var(--session-sage-border)",
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
                                color: "var(--session-sage-soft)",
                                marginBottom: 8,
                              }}
                            >
                              ENTRY · LAYER {cpMeta?.layer ?? ""}
                              {cpMeta?.status ? ` · ${cpMeta.status.toUpperCase()}` : ""}
                            </div>

                            {/* Name (if present) */}
                            {cpMeta?.name && (
                              <div
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: "17px",
                                  fontWeight: 400,
                                  color: "var(--session-ink)",
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
                                fontFamily: "var(--font-serif)",
                                fontSize: "14px",
                                lineHeight: 1.75,
                                color: "var(--session-ink-soft)",
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
                                {(showAllLogs || expandedCheckpoints.has(msg.id)) ? "▾ checkpoint_meta" : "▸ checkpoint_meta"}
                              </button>
                              {(showAllLogs || expandedCheckpoints.has(msg.id)) && (
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

                            {/* Per-turn extraction snapshot */}
                            {msg.extraction_snapshot && (
                              <ExtractionPanel snapshot={msg.extraction_snapshot as ExtractionSnapshot} forceExpanded={showAllLogs} />
                            )}
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

                          {/* Per-turn extraction snapshot */}
                          {msg.extraction_snapshot && (
                            <ExtractionPanel snapshot={msg.extraction_snapshot as ExtractionSnapshot} forceExpanded={showAllLogs} />
                          )}
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

            {/* ── Feedback tab ─────────────────────────────────── */}
            {profileTab === "feedback" && !adminLoading && (
              <div>
                {feedbackItems.length === 0 && (
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink-ghost)",
                      padding: "40px 0",
                      textAlign: "center",
                    }}
                  >
                    No feedback yet
                  </div>
                )}
                {feedbackItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "14px 0",
                      borderBottom: "1px solid var(--session-ink-hairline)",
                    }}
                  >
                    <div style={metaStyle}>
                      {item.user_email || "Guest"} · {formatAdminDate(item.created_at)}
                      {item.session_id && (
                        <span> · {item.session_id.slice(0, 8)}</span>
                      )}
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
  const populatedLayers = layers.filter((l) => l.entries.length > 0);
  const emptyLayers = layers.filter((l) => l.entries.length === 0);
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
