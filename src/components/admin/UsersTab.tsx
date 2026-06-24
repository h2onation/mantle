"use client";

import { useMemo, useState } from "react";
import {
  adminListItemStyle,
  adminMetaStyle,
  adminEmptyStyle,
  formatAdminDate,
  paginate,
} from "./admin-shared";
import Pagination from "./Pagination";

export interface AdminUserOverview {
  id: string;
  email: string;
  display_name: string | null;
  conversation_count: number;
  component_count: number;
  is_anonymous: boolean;
  created_at: string;
  last_active: string | null;
  last_conversation_at: string | null;
}

interface Props {
  users: AdminUserOverview[];
  onSelectUser: (user: AdminUserOverview) => void;
  selectedId?: string | null;
}

const PER_PAGE = 10;

// Single-select lenses over the user list. Each is a different cut, not a
// status field — "guests" overlaps active/dormant by design (it answers a
// different admin question: which accounts are anonymous).
type UserFilter = "all" | "active" | "dormant" | "guests";

const FILTERS: UserFilter[] = ["all", "active", "dormant", "guests"];

const FILTER_LABEL: Record<UserFilter, string> = {
  all: "All",
  active: "Active",
  dormant: "Dormant",
  guests: "Guests",
};

export default function UsersTab({ users, onSelectUser, selectedId }: Props) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<UserFilter>("all");
  const [search, setSearch] = useState("");

  // Sort by last_active desc; nulls last so brand-new users that have no
  // messages yet sink to the bottom rather than dominating the top.
  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      if (!a.last_active && !b.last_active) return 0;
      if (!a.last_active) return 1;
      if (!b.last_active) return -1;
      return b.last_active.localeCompare(a.last_active);
    });
  }, [users]);

  // Counts for the filter chips, computed off the full set so they stay stable
  // as the active filter / search narrows the visible rows.
  const counts = useMemo(
    () => ({
      all: users.length,
      active: users.filter((u) => u.conversation_count > 0).length,
      dormant: users.filter((u) => u.conversation_count === 0).length,
      guests: users.filter((u) => u.is_anonymous).length,
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted
      .filter((u) => {
        if (filter === "active") return u.conversation_count > 0;
        if (filter === "dormant") return u.conversation_count === 0;
        if (filter === "guests") return u.is_anonymous;
        return true;
      })
      .filter((u) => {
        if (!query) return true;
        return (
          u.email.toLowerCase().includes(query) ||
          (u.display_name?.toLowerCase().includes(query) ?? false)
        );
      });
  }, [sorted, filter, search]);

  const visible = paginate(filtered, page, PER_PAGE);

  function resetPage() {
    setPage(0);
  }

  if (users.length === 0) {
    return <div style={adminEmptyStyle}>No users yet</div>;
  }

  return (
    <div>
      {/* ── Search ────────────────────────────────────────────── */}
      <input
        type="text"
        placeholder="Search email or name…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          resetPage();
        }}
        style={{
          width: "100%",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink)",
          background: "rgba(255,255,255,0.6)",
          border: "1px solid var(--session-ink-hairline)",
          borderRadius: 6,
          padding: "7px 10px",
          outline: "none",
          marginBottom: 8,
        }}
      />

      {/* ── Filter chips ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
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
              {FILTER_LABEL[f]} ({counts[f]})
            </button>
          );
        })}
      </div>

      {/* ── Rows ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={adminEmptyStyle}>No matches</div>
      ) : (
        <>
          {visible.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelectUser(u)}
              style={{
                ...adminListItemStyle,
                background: u.id === selectedId ? "rgba(255,255,255,0.6)" : "none",
                borderRadius: u.id === selectedId ? 6 : 0,
                paddingLeft: u.id === selectedId ? 10 : 0,
                paddingRight: u.id === selectedId ? 10 : 0,
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                }}
              >
                {u.email || (u.is_anonymous ? "Guest" : "—")}
              </div>
              <div style={adminMetaStyle}>
                Signed up {formatAdminDate(u.created_at)}
              </div>
              <div style={adminMetaStyle}>
                Last active {formatAdminDate(u.last_active)}
              </div>
              <div style={adminMetaStyle}>
                {u.conversation_count} conversation{u.conversation_count !== 1 ? "s" : ""}
                {" · "}
                {u.component_count} manual entr{u.component_count !== 1 ? "ies" : "y"}
              </div>
              <div style={adminMetaStyle}>
                Last conversation {formatAdminDate(u.last_conversation_at)}
              </div>
            </button>
          ))}
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
