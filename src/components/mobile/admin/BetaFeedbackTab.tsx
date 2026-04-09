"use client";

import { useState } from "react";
import {
  adminMetaStyle,
  adminEmptyStyle,
  formatAdminDate,
  paginate,
} from "./admin-shared";
import Pagination from "./Pagination";

export interface BetaFeedbackRow {
  id: string;
  user_email: string;
  page_context: string | null;
  feedback_text: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  items: BetaFeedbackRow[];
  onMarkRead: (id: string) => Promise<void>;
}

const PER_PAGE = 10;

export default function BetaFeedbackTab({ items, onMarkRead }: Props) {
  const [page, setPage] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const visible = paginate(items, page, PER_PAGE);

  async function handleClick(row: BetaFeedbackRow) {
    if (row.is_read || savingId === row.id) return;
    setSavingId(row.id);
    try {
      await onMarkRead(row.id);
    } finally {
      setSavingId(null);
    }
  }

  if (items.length === 0) {
    return <div style={adminEmptyStyle}>No feedback yet</div>;
  }

  return (
    <div>
      {visible.map((row) => {
        const unread = !row.is_read;
        return (
          <button
            key={row.id}
            onClick={() => handleClick(row)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              padding: "14px 0 14px 14px",
              borderBottom: "1px solid var(--session-ink-hairline)",
              cursor: unread ? "pointer" : "default",
              position: "relative",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Unread dot */}
            {unread && (
              <span
                aria-label="unread"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 22,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--session-error)",
                }}
              />
            )}

            <div style={adminMetaStyle}>
              {row.user_email} · {formatAdminDate(row.created_at)}
              {row.page_context && <span> · {row.page_context}</span>}
            </div>

            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink)",
                lineHeight: 1.55,
                marginTop: 6,
                whiteSpace: "pre-wrap",
                fontWeight: unread ? 600 : 400,
                opacity: unread ? 1 : 0.7,
              }}
            >
              {row.feedback_text}
            </div>

            {savingId === row.id && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--session-ink-ghost)",
                  marginTop: 4,
                  letterSpacing: "1px",
                }}
              >
                Marking read…
              </div>
            )}
          </button>
        );
      })}

      <Pagination
        page={page}
        perPage={PER_PAGE}
        total={items.length}
        onChange={setPage}
      />
    </div>
  );
}
