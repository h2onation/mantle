"use client";

// Beta Health PR 3: compact view of unread beta feedback inside the
// Health tab. Uses the existing /api/admin/beta-feedback endpoint
// (GET returns { items, unread_count }; PATCH marks one row read)
// via useAdminData — single source of truth with the dedicated
// Feedback tab (BetaFeedbackTab.tsx).
//
// Scope is intentionally narrower than BetaFeedbackTab: shows only
// unread rows, no pagination. When all read, collapses to a clean
// banner. For full history browsing, admin navigates to the
// Feedback section. The existing betaFeedbackUnreadCount badge on
// the Feedback nav entry is the primary nag.

import { useState } from "react";
import { adminEmptyStyle, formatAdminDate } from "./admin-shared";
import type { BetaFeedbackRow } from "./BetaFeedbackTab";

interface FeedbackPanelProps {
  items: BetaFeedbackRow[];
  unreadCount: number;
  loaded: boolean;
  onMarkRead: (id: string) => Promise<void>;
}

export default function FeedbackPanel({
  items,
  unreadCount,
  loaded,
  onMarkRead,
}: FeedbackPanelProps) {
  const [savingId, setSavingId] = useState<string | null>(null);

  const unread = items.filter((r) => !r.is_read);

  async function handleMarkRead(row: BetaFeedbackRow) {
    if (savingId) return;
    setSavingId(row.id);
    try {
      await onMarkRead(row.id);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          Beta feedback
        </div>
      </div>

      {!loaded && <div style={adminEmptyStyle}>Loading…</div>}

      {loaded && unreadCount === 0 && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 8,
            background: "rgba(91, 122, 79, 0.12)",
            border: "1px solid rgba(91, 122, 79, 0.3)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-persona)",
              marginRight: 12,
            }}
          >
            ✓ Clean
          </span>
          No unread feedback.
        </div>
      )}

      {loaded && unreadCount > 0 && (
        <>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 8,
              background: "var(--session-error-banner)",
              border: "1px solid var(--session-error-ghost)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-error)",
              }}
            >
              ⚠ {unreadCount} unread
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {unread.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  padding: "12px 16px",
                  borderBottom:
                    idx < unread.length - 1
                      ? "1px solid var(--session-ink-hairline)"
                      : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--session-ink-ghost)",
                    letterSpacing: "0.5px",
                  }}
                >
                  {row.user_email} · {formatAdminDate(row.created_at)}
                  {row.page_context && (
                    <span> · {row.page_context}</span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {row.feedback_text}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => handleMarkRead(row)}
                    disabled={savingId === row.id}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color:
                        savingId === row.id
                          ? "var(--session-ink-ghost)"
                          : "var(--session-ink-mid)",
                      background: "none",
                      border: "1px solid var(--session-ink-hairline)",
                      borderRadius: 4,
                      padding: "4px 10px",
                      cursor: savingId === row.id ? "default" : "pointer",
                    }}
                  >
                    {savingId === row.id ? "Marking…" : "Mark read"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
