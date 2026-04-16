"use client";

import { useEffect, useState } from "react";
import { adminEmptyStyle, formatAdminDate } from "./admin-shared";

interface ErrorKindCount {
  error_kind: string;
  count: number;
}

interface RecentFailure {
  id: string;
  user_id: string;
  message_id: string | null;
  conversation_id: string | null;
  error_kind: string;
  error_detail: string | null;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface ConfirmStats {
  windowSeconds: number;
  totalFailures: number;
  byKind: ErrorKindCount[];
  recent: RecentFailure[];
  checkedAt: string;
}

const WINDOWS: { label: string; seconds: number }[] = [
  { label: "Last 1h", seconds: 3600 },
  { label: "Last 24h", seconds: 86400 },
  { label: "Last 7d", seconds: 7 * 86400 },
];

export default function ConfirmHealthPanel() {
  const [stats, setStats] = useState<ConfirmStats | null>(null);
  const [windowSeconds, setWindowSeconds] = useState<number>(86400);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(windowSec: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/confirm-stats?windowSeconds=${windowSec}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setStats((await res.json()) as ConfirmStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(windowSeconds);
  }, [windowSeconds]);

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
          Checkpoint confirm failures
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => {
            const active = w.seconds === windowSeconds;
            return (
              <button
                key={w.seconds}
                onClick={() => setWindowSeconds(w.seconds)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: active
                    ? "var(--session-ink)"
                    : "var(--session-ink-ghost)",
                  background: active ? "rgba(255,255,255,0.6)" : "none",
                  border: "1px solid var(--session-ink-hairline)",
                  borderRadius: 4,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ ...adminEmptyStyle, color: "var(--session-error)" }}>
          Error: {error}
        </div>
      )}
      {loading && !stats && <div style={adminEmptyStyle}>Loading…</div>}

      {stats && !error && (
        <>
          {stats.totalFailures === 0 ? (
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
              No confirm failures in this window.
            </div>
          ) : (
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
                    marginBottom: 4,
                  }}
                >
                  ⚠ {stats.totalFailures} failure
                  {stats.totalFailures === 1 ? "" : "s"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink)",
                  }}
                >
                  Breakdown by kind:{" "}
                  {stats.byKind.map((k, i) => (
                    <span key={k.error_kind}>
                      {i > 0 && ", "}
                      <span
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {k.error_kind}
                      </span>{" "}
                      · {k.count}
                    </span>
                  ))}
                </div>
              </div>

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
                Recent · {stats.recent.length}
              </div>
              <div
                style={{
                  border: "1px solid var(--session-ink-hairline)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {stats.recent.length === 0 ? (
                  <div
                    style={{
                      padding: "14px 16px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink-mid)",
                    }}
                  >
                    (No rows in the feed yet — stats may reflect a longer
                    window than the feed captures.)
                  </div>
                ) : (
                  stats.recent.map((f, idx) => (
                    <div
                      key={f.id}
                      style={{
                        padding: "10px 16px",
                        borderBottom:
                          idx < stats.recent.length - 1
                            ? "1px solid var(--session-ink-hairline)"
                            : "none",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "12px",
                            color: "var(--session-ink)",
                          }}
                        >
                          <span style={{ color: "var(--session-error)" }}>
                            {f.error_kind}
                          </span>
                          {f.status_code && (
                            <span style={{ color: "var(--session-ink-ghost)" }}>
                              {" "}
                              · HTTP {f.status_code}
                            </span>
                          )}
                          {f.duration_ms !== null && (
                            <span style={{ color: "var(--session-ink-ghost)" }}>
                              {" "}
                              · {f.duration_ms}ms
                            </span>
                          )}
                        </div>
                        {f.error_detail && (
                          <div
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "12px",
                              color: "var(--session-ink-mid)",
                              marginTop: 2,
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={f.error_detail}
                          >
                            {f.error_detail}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          color: "var(--session-ink-ghost)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatAdminDate(f.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
              marginTop: 16,
            }}
          >
            Checked {formatAdminDate(stats.checkedAt)}
          </div>
        </>
      )}
    </div>
  );
}
