"use client";

import { useMemo, useState } from "react";
import {
  adminEmptyStyle,
  formatAdminDate,
  paginate,
} from "./admin-shared";
import Pagination from "./Pagination";
import type { BetaFeedbackRow } from "./BetaFeedbackTab";
import type { AdminFeedbackItem } from "@/lib/hooks/useAdminData";

type SourceFilter = "all" | "beta" | "in-app";
type ReadFilter = "all" | "unread" | "read";
type SortOrder = "newest" | "oldest";

interface UnifiedRow {
  id: string;
  source: "beta" | "in-app";
  user_email: string;
  text: string;
  created_at: string;
  page_context: string | null;
  is_read: boolean | null;
}

interface Props {
  betaFeedback: BetaFeedbackRow[];
  userFeedback: AdminFeedbackItem[];
  onMarkRead: (id: string) => Promise<void>;
  onDeleteBeta: (id: string) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

const PER_PAGE = 15;

const SOURCE_OPTIONS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "beta", label: "Beta" },
  { id: "in-app", label: "In-app" },
];

const READ_OPTIONS: { id: ReadFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
];

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
];

export default function FeedbackSection({
  betaFeedback,
  userFeedback,
  onMarkRead,
  onDeleteBeta,
  onDeleteUser,
}: Props) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<UnifiedRow[]>(() => {
    const beta: UnifiedRow[] = betaFeedback.map((r) => ({
      id: `beta:${r.id}`,
      source: "beta",
      user_email: r.user_email,
      text: r.feedback_text,
      created_at: r.created_at,
      page_context: r.page_context,
      is_read: r.is_read,
    }));
    const inApp: UnifiedRow[] = userFeedback.map((r) => ({
      id: `in-app:${r.id}`,
      source: "in-app",
      user_email: r.user_email,
      text: r.message,
      created_at: r.created_at,
      page_context: null,
      is_read: null,
    }));
    return [...beta, ...inApp];
  }, [betaFeedback, userFeedback]);

  const filtered = useMemo(() => {
    let out = rows;
    if (source !== "all") out = out.filter((r) => r.source === source);
    if (readFilter !== "all") {
      out = out.filter((r) => {
        if (r.is_read === null) return readFilter === "read";
        return readFilter === "read" ? r.is_read : !r.is_read;
      });
    }
    out = [...out].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });
    return out;
  }, [rows, source, readFilter, sort]);

  const visible = paginate(filtered, page, PER_PAGE);

  async function handleMarkRead(row: UnifiedRow) {
    if (row.source !== "beta") return;
    setBusyId(row.id);
    setError(null);
    try {
      await onMarkRead(stripPrefix(row.id));
    } catch {
      setError("Failed to mark read.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: UnifiedRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const realId = stripPrefix(row.id);
      if (row.source === "beta") await onDeleteBeta(realId);
      else await onDeleteUser(realId);
      setPendingDelete(null);
    } catch {
      setError("Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  const totalLabel = `${filtered.length} of ${rows.length}`;

  return (
    <div>
      {/* ── Filter / sort bar ────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "center",
          padding: "4px 0 16px",
          borderBottom: "1px solid var(--session-ink-hairline)",
          marginBottom: 16,
        }}
      >
        <FilterGroup label="Source">
          {SOURCE_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              active={source === o.id}
              onClick={() => {
                setSource(o.id);
                setPage(0);
              }}
            >
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Status">
          {READ_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              active={readFilter === o.id}
              onClick={() => {
                setReadFilter(o.id);
                setPage(0);
              }}
            >
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Sort">
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              active={sort === o.id}
              onClick={() => {
                setSort(o.id);
                setPage(0);
              }}
            >
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-ink-ghost)",
            letterSpacing: "1px",
          }}
        >
          {totalLabel}
        </span>
      </div>

      {error && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-error)",
            padding: "8px 0",
            letterSpacing: "1px",
          }}
        >
          {error}
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={adminEmptyStyle}>No feedback matches these filters</div>
      ) : (
        <>
          {visible.map((row) => {
            const unread = row.is_read === false;
            const isPending = pendingDelete === row.id;
            const isBusy = busyId === row.id;
            return (
              <div
                key={row.id}
                style={{
                  padding: "14px 0 14px 16px",
                  borderBottom: "1px solid var(--session-ink-hairline)",
                  position: "relative",
                }}
              >
                {unread && (
                  <span
                    aria-label="unread"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 21,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--session-error)",
                    }}
                  />
                )}

                {/* Meta row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <SourcePill source={row.source} />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: "var(--session-ink-ghost)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {row.user_email} · {formatAdminDate(row.created_at)}
                    {row.page_context ? ` · ${row.page_context}` : ""}
                  </span>
                </div>

                {/* Body */}
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink)",
                    lineHeight: 1.55,
                    marginTop: 6,
                    whiteSpace: "pre-wrap",
                    fontWeight: unread ? 600 : 400,
                    opacity: unread ? 1 : 0.85,
                  }}
                >
                  {row.text}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {unread && (
                    <button
                      onClick={() => handleMarkRead(row)}
                      disabled={isBusy}
                      style={ghostBtn}
                    >
                      {isBusy ? "Saving…" : "Mark read"}
                    </button>
                  )}

                  {!isPending && (
                    <button
                      onClick={() => {
                        setPendingDelete(row.id);
                        setError(null);
                      }}
                      disabled={isBusy}
                      style={{
                        ...ghostBtn,
                        marginLeft: "auto",
                      }}
                    >
                      Delete
                    </button>
                  )}
                  {isPending && !isBusy && (
                    <>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          color: "var(--session-ink-ghost)",
                          letterSpacing: "1px",
                        }}
                      >
                        Delete?
                      </span>
                      <button
                        onClick={() => handleDelete(row)}
                        style={{
                          ...ghostBtn,
                          color: "var(--session-cream)",
                          background: "var(--session-error)",
                          border: "none",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        style={ghostBtn}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {isPending && isBusy && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "1px",
                      }}
                    >
                      Deleting…
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={filtered.length}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function stripPrefix(id: string): string {
  const idx = id.indexOf(":");
  return idx >= 0 ? id.slice(idx + 1) : id;
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginRight: 4,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: active ? 500 : 400,
        color: active ? "var(--session-ink)" : "var(--session-ink-ghost)",
        background: active ? "var(--session-walnut-surface)" : "transparent",
        border: `1px solid ${
          active
            ? "var(--session-walnut-border)"
            : "var(--session-ink-hairline)"
        }`,
        borderRadius: 4,
        padding: "3px 10px",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

function SourcePill({ source }: { source: "beta" | "in-app" }) {
  const isBeta = source === "beta";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: isBeta ? "var(--session-walnut)" : "var(--session-persona)",
        background: isBeta
          ? "var(--session-walnut-surface)"
          : "var(--session-persona-muted)",
        border: `1px solid ${
          isBeta
            ? "var(--session-walnut-border)"
            : "var(--session-persona-border)"
        }`,
        borderRadius: 3,
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {isBeta ? "Beta" : "In-app"}
    </span>
  );
}

const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-ink-mid)",
  background: "none",
  border: "1px solid var(--session-ink-hairline)",
  borderRadius: 4,
  padding: "5px 10px",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};
