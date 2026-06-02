"use client";

import { useState } from "react";
import {
  adminMetaStyle,
  adminEmptyStyle,
  adminLabelStyle,
  formatAdminDate,
  paginate,
} from "./admin-shared";
import Pagination from "./Pagination";

export type WaitlistStatus = "waiting" | "invited" | "declined";

export interface WaitlistRow {
  id: string;
  email: string;
  source: string | null;
  status: WaitlistStatus;
  seen: boolean;
  notes: string | null;
  created_at: string;
}

interface Props {
  items: WaitlistRow[];
  // Invite = set 'invited' (grants access); Decline = set 'declined' (revokes).
  onChangeStatus: (id: string, status: WaitlistStatus) => Promise<void>;
  onMarkSeen: (id: string) => Promise<void>;
  onAddInvited: (email: string) => Promise<"added" | "already_exists">;
}

const PER_PAGE = 12;

// Default sort puts the queue that needs action first: waiting → invited →
// declined, newest within each group.
const STATUS_RANK: Record<WaitlistStatus, number> = {
  waiting: 0,
  invited: 1,
  declined: 2,
};

type StatusFilter = "all" | WaitlistStatus;
type SortMode = "status" | "newest" | "oldest";

const FILTERS: StatusFilter[] = ["all", "waiting", "invited", "declined"];

export default function WaitlistTab({
  items,
  onChangeStatus,
  onMarkSeen,
  onAddInvited,
}: Props) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("status");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingDecline, setPendingDecline] = useState<string | null>(null);
  const [seenSavingId, setSeenSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-invited-email form.
  const [email, setEmail] = useState("");
  const [formStatus, setFormStatus] = useState<
    "idle" | "saving" | "added" | "already_exists" | "error"
  >("idle");

  // Per-status counts for the filter chips (computed off the full set).
  const counts = items.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { waiting: 0, invited: 0, declined: 0 } as Record<WaitlistStatus, number>
  );

  const query = search.trim().toLowerCase();
  const filtered = items
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .filter((r) => !query || r.email.toLowerCase().includes(query));

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "newest") return b.created_at.localeCompare(a.created_at);
    if (sortMode === "oldest") return a.created_at.localeCompare(b.created_at);
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return rank !== 0 ? rank : b.created_at.localeCompare(a.created_at);
  });

  const visible = paginate(sorted, page, PER_PAGE);

  function resetPage() {
    setPage(0);
  }

  async function handleStatus(id: string, status: WaitlistStatus) {
    setError(null);
    setSavingId(id);
    try {
      await onChangeStatus(id, status);
      setPendingDecline(null);
    } catch {
      setError("Failed to update. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleMarkSeen(id: string) {
    setError(null);
    setSeenSavingId(id);
    try {
      await onMarkSeen(id);
    } catch {
      setError("Failed to mark seen. Try again.");
    } finally {
      setSeenSavingId(null);
    }
  }

  async function handleAddInvited(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setFormStatus("saving");
    try {
      const result = await onAddInvited(trimmed);
      setFormStatus(result);
      if (result === "added") setEmail("");
      setTimeout(() => setFormStatus("idle"), 3000);
    } catch {
      setFormStatus("error");
      setTimeout(() => setFormStatus("idle"), 3000);
    }
  }

  return (
    <div>
      {/* ── Add invited email ─────────────────────────────────── */}
      <div
        style={{
          padding: "4px 0 16px",
          borderBottom: "1px solid var(--session-ink-hairline)",
          marginBottom: 12,
        }}
      >
        <div style={{ ...adminLabelStyle, marginBottom: 10 }}>
          Invite an email directly
        </div>
        <form
          onSubmit={handleAddInvited}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={formStatus === "saving"}
            style={{
              flex: 1,
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink)",
              background: "rgba(255,255,255,0.6)",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 6,
              padding: "8px 10px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={formStatus === "saving" || !email.trim()}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--session-cream)",
              background: "var(--session-persona)",
              border: "none",
              borderRadius: 6,
              padding: "9px 14px",
              cursor:
                formStatus === "saving" || !email.trim() ? "default" : "pointer",
              opacity: formStatus === "saving" || !email.trim() ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {formStatus === "saving" ? "Inviting…" : "Invite"}
          </button>
        </form>
        {formStatus === "added" && (
          <div style={{ ...formMsgStyle, color: "var(--session-persona)" }}>
            Invited. They can sign in now.
          </div>
        )}
        {formStatus === "already_exists" && (
          <div style={{ ...formMsgStyle, color: "var(--session-ink-ghost)" }}>
            Already invited.
          </div>
        )}
        {formStatus === "error" && (
          <div style={{ ...formMsgStyle, color: "var(--session-error)" }}>
            Failed to invite. Try again.
          </div>
        )}
      </div>

      {/* ── Filters / search / sort ───────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        {FILTERS.map((f) => {
          const active = f === statusFilter;
          const label =
            f === "all"
              ? `All (${items.length})`
              : `${f} (${counts[f]})`;
          return (
            <button
              key={f}
              onClick={() => {
                setStatusFilter(f);
                resetPage();
              }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: active ? "var(--session-cream)" : "var(--session-ink-mid)",
                background: active ? "var(--session-walnut)" : "none",
                border: "1px solid var(--session-ink-hairline)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 10px",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {label}
            </button>
          );
        })}

        <input
          type="text"
          placeholder="Search email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          style={{
            flex: 1,
            minWidth: 140,
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-ink)",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 6,
            padding: "6px 10px",
            outline: "none",
          }}
        />

        <select
          value={sortMode}
          onChange={(e) => {
            setSortMode(e.target.value as SortMode);
            resetPage();
          }}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink)",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 4,
            padding: "5px 6px",
          }}
        >
          <option value="status">Sort: status</option>
          <option value="newest">Sort: newest</option>
          <option value="oldest">Sort: oldest</option>
        </select>
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

      {/* ── Rows ──────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div style={adminEmptyStyle}>No signups yet</div>
      ) : sorted.length === 0 ? (
        <div style={adminEmptyStyle}>No matches</div>
      ) : (
        <>
          {visible.map((row) => {
            const isSaving = savingId === row.id;
            const isPendingDecline = pendingDecline === row.id;
            const isSeenSaving = seenSavingId === row.id;
            return (
              <div
                key={row.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--session-ink-hairline)",
                }}
              >
                {/* email + badges */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  {!row.seen && <span style={newPillStyle}>New</span>}
                  <StatusBadge status={row.status} />
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {row.email}
                  </span>
                </div>

                <div style={adminMetaStyle}>
                  {formatAdminDate(row.created_at)}
                  {row.notes ? ` · ${row.notes}` : ""}
                </div>

                {row.source && (
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--session-ink-mid)",
                      marginTop: 6,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {row.source}
                  </div>
                )}

                {/* actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {isSaving && (
                    <span style={ghostNote}>Saving…</span>
                  )}

                  {!isSaving && row.status !== "invited" && (
                    <button
                      onClick={() => handleStatus(row.id, "invited")}
                      style={solidBtn}
                    >
                      Invite
                    </button>
                  )}

                  {!isSaving && row.status !== "declined" && !isPendingDecline && (
                    <button
                      onClick={() => setPendingDecline(row.id)}
                      style={outlineBtn}
                    >
                      Decline
                    </button>
                  )}

                  {!isSaving && isPendingDecline && (
                    <>
                      <span style={ghostNote}>
                        {row.status === "invited" ? "Revoke access?" : "Decline?"}
                      </span>
                      <button
                        onClick={() => handleStatus(row.id, "declined")}
                        style={dangerBtn}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingDecline(null)}
                        style={outlineBtn}
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {!row.seen && (
                    <button
                      onClick={() => handleMarkSeen(row.id)}
                      disabled={isSeenSaving}
                      style={{
                        ...outlineBtn,
                        marginLeft: "auto",
                        cursor: isSeenSaving ? "default" : "pointer",
                        opacity: isSeenSaving ? 0.5 : 1,
                      }}
                    >
                      {isSeenSaving ? "Saving…" : "Mark seen"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={sorted.length}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: WaitlistStatus }) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--size-meta)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderRadius: 4,
    padding: "1px 6px",
    flexShrink: 0,
  };
  if (status === "invited") {
    return (
      <span
        style={{
          ...base,
          color: "var(--session-cream)",
          background: "var(--session-persona)",
        }}
      >
        Invited
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span
        style={{
          ...base,
          color: "var(--session-ink-ghost)",
          border: "1px solid var(--session-ink-hairline)",
        }}
      >
        Declined
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        color: "var(--session-ink-mid)",
        border: "1px solid var(--session-ink-hairline)",
      }}
    >
      Waiting
    </span>
  );
}

const formMsgStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  marginTop: 8,
  letterSpacing: "0.5px",
};

const newPillStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-cream)",
  background: "var(--session-walnut)",
  borderRadius: 4,
  padding: "1px 6px",
  flexShrink: 0,
};

const ghostNote: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  color: "var(--session-ink-ghost)",
  letterSpacing: "1px",
};

const solidBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-cream)",
  background: "var(--session-persona)",
  border: "none",
  borderRadius: 4,
  padding: "5px 9px",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

const outlineBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-ink-ghost)",
  background: "none",
  border: "1px solid var(--session-ink-hairline)",
  borderRadius: 4,
  padding: "5px 9px",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

const dangerBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--session-cream)",
  background: "var(--session-error)",
  border: "none",
  borderRadius: 4,
  padding: "5px 9px",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};
