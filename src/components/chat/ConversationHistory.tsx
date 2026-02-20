"use client";

import { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string;
}

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  activeConversationId: string | null;
  supabase: SupabaseClient;
}

export default function ConversationHistory({
  open,
  onClose,
  onSelect,
  onNewConversation,
  activeConversationId,
  supabase,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: convs } = await supabase
        .from("conversations")
        .select("id, created_at, updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });

      if (!convs) {
        setLoading(false);
        return;
      }

      // Load first user message for each conversation as preview
      const withPreviews: Conversation[] = await Promise.all(
        convs.map(async (conv) => {
          const { data: firstMsg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .eq("role", "user")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          const preview = firstMsg
            ? firstMsg.content.slice(0, 50) + (firstMsg.content.length > 50 ? "..." : "")
            : "Calibration";

          return {
            id: conv.id,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            preview,
          };
        })
      );

      setConversations(withPreviews);
      setLoading(false);
    }

    load();
  }, [open, supabase]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.15)",
            zIndex: 99,
          }}
          onClick={onClose}
        />
      )}

      {/* Slide-out panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: open ? 0 : "-340px",
          width: "320px",
          height: "100vh",
          backgroundColor: "var(--color-bg-primary)",
          borderRight: "1px solid var(--color-border)",
          boxShadow: open ? "4px 0 20px rgba(0, 0, 0, 0.08)" : "none",
          transition: "left 0.25s ease",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--color-text-primary)",
            }}
          >
            Conversations
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            &times;
          </button>
        </div>

        {/* New conversation button */}
        <div style={{ padding: "12px 20px 4px" }}>
          <button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "var(--color-accent)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            + New Conversation
          </button>
        </div>

        {/* Conversation list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {loading ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              Loading...
            </p>
          ) : conversations.length === 0 ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelect(conv.id);
                    onClose();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px",
                    marginBottom: "4px",
                    backgroundColor: isActive
                      ? "rgba(92, 107, 94, 0.08)"
                      : "transparent",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {formatDate(conv.created_at)}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--color-accent)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--color-text-primary)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.preview}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
