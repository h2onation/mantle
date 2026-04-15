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

export default function UsersTab({ users, onSelectUser, selectedId }: Props) {
  const [page, setPage] = useState(0);

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

  const visible = paginate(sorted, page, PER_PAGE);

  if (sorted.length === 0) {
    return <div style={adminEmptyStyle}>No users yet</div>;
  }

  return (
    <div>
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
        total={sorted.length}
        onChange={setPage}
      />
    </div>
  );
}
