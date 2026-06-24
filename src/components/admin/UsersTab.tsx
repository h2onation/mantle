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

// Which field the list is sorted by, newest-first in both cases.
type SortMode = "last_active" | "created_at";

export default function UsersTab({ users, onSelectUser, selectedId }: Props) {
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("last_active");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const arr = [...users];
    if (sortMode === "created_at") {
      // Newest sign-ups first.
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      // Most recently active first; nulls last so brand-new users with no
      // messages yet sink to the bottom rather than dominating the top.
      arr.sort((a, b) => {
        if (!a.last_active && !b.last_active) return 0;
        if (!a.last_active) return 1;
        if (!b.last_active) return -1;
        return b.last_active.localeCompare(a.last_active);
      });
    }
    return arr;
  }, [users, sortMode]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      (u) =>
        u.email.toLowerCase().includes(query) ||
        (u.display_name?.toLowerCase().includes(query) ?? false)
    );
  }, [sorted, search]);

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

      {/* ── Sort ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
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
          <option value="last_active">Sort: last active</option>
          <option value="created_at">Sort: sign-up date</option>
        </select>
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
