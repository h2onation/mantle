"use client";

// Beta user activity: who's allowlisted, who's signed in ever, who's
// active in the last 24h / 7d. Mirrors ApiErrorsPanel layout conventions
// (mono uppercase header, card treatment, listing) for consistency
// inside /admin?section=health.

import { useEffect, useState } from "react";
import { adminEmptyStyle, formatAdminDate } from "./admin-shared";

interface BetaUser {
  email: string;
  user_id: string | null;
  allowlisted_at: string;
  signed_in_ever: boolean;
  last_sign_in_at: string | null;
}

interface ActiveUsersSummary {
  total_allowlisted: number;
  ever_signed_in: number;
  active_last_24h: number;
  active_last_7d: number;
}

interface ActiveUsersData {
  summary: ActiveUsersSummary;
  users: BetaUser[];
  checkedAt: string;
}

function relativeDays(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  return `${Math.floor(days)}d ago`;
}

export default function ActiveUsersPanel() {
  const [data, setData] = useState<ActiveUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/active-users");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setData((await res.json()) as ActiveUsersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
          Beta users
        </div>
      </div>

      {error && (
        <div style={{ ...adminEmptyStyle, color: "var(--session-error)" }}>
          Error: {error}
        </div>
      )}
      {loading && !data && <div style={adminEmptyStyle}>Loading…</div>}

      {data && !error && (
        <>
          <SummaryBanner summary={data.summary} />

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              marginBottom: 8,
            }}
          >
            All · {data.users.length}
          </div>
          <div
            style={{
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {data.users.length === 0 ? (
              <div
                style={{
                  padding: "14px 16px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--session-ink-mid)",
                }}
              >
                (No emails on the allowlist yet.)
              </div>
            ) : (
              data.users.map((u, idx) => (
                <div
                  key={u.email}
                  style={{
                    padding: "10px 16px",
                    borderBottom:
                      idx < data.users.length - 1
                        ? "1px solid var(--session-ink-hairline)"
                        : "none",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={u.email}
                  >
                    {u.email}
                    {!u.signed_in_ever && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          color: "var(--session-ink-ghost)",
                          marginLeft: 8,
                        }}
                      >
                        · invited, no sign-in
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--session-ink-ghost)",
                      whiteSpace: "nowrap",
                    }}
                    title={`Allowlisted ${formatAdminDate(u.allowlisted_at)}`}
                  >
                    allowlisted {relativeDays(u.allowlisted_at)}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: u.last_sign_in_at
                        ? "var(--session-ink)"
                        : "var(--session-ink-ghost)",
                      whiteSpace: "nowrap",
                      minWidth: 100,
                      textAlign: "right",
                    }}
                    title={
                      u.last_sign_in_at
                        ? `Last sign-in ${formatAdminDate(u.last_sign_in_at)}`
                        : "Never signed in"
                    }
                  >
                    {relativeDays(u.last_sign_in_at)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
              marginTop: 16,
            }}
          >
            Checked {formatAdminDate(data.checkedAt)}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryBanner({ summary }: { summary: ActiveUsersSummary }) {
  // Use the same neutral-card treatment as confirm-failures' "clean"
  // banner, but load it with 4 stats instead of a single OK/warn state.
  const cells: { label: string; value: number }[] = [
    { label: "Allowlisted", value: summary.total_allowlisted },
    { label: "Signed in ever", value: summary.ever_signed_in },
    { label: "Active 24h", value: summary.active_last_24h },
    { label: "Active 7d", value: summary.active_last_7d },
  ];
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: 8,
        background: "rgba(91, 122, 79, 0.08)",
        border: "1px solid rgba(91, 122, 79, 0.2)",
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}
    >
      {cells.map((c) => (
        <div key={c.label}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              marginBottom: 4,
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "20px",
              fontWeight: 500,
              color: "var(--session-ink)",
            }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
