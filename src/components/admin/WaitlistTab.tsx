"use client";

import { useState } from "react";
import {
  adminMetaStyle,
  adminEmptyStyle,
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
  created_at: string;
}

interface Props {
  items: WaitlistRow[];
  onChangeStatus: (id: string, status: WaitlistStatus) => Promise<void>;
  onAddToBeta: (email: string, waitlistId?: string) => Promise<"added" | "already_exists">;
}

const PER_PAGE = 10;
const STATUSES: WaitlistStatus[] = ["waiting", "invited", "declined"];

// Inline two-step status change. The dropdown sets a *pending* selection on
// the row; the row then renders a confirm/cancel pair right next to it. No
// modal — matches the rest of the app's terse style and avoids stealing
// focus from the table.
type Pending = { id: string; nextStatus: WaitlistStatus } | null;

export default function WaitlistTab({ items, onChangeStatus, onAddToBeta }: Props) {
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-row "Add to beta" state
  const [betaRowSaving, setBetaRowSaving] = useState<string | null>(null);
  const [betaRowResult, setBetaRowResult] = useState<
    Record<string, "added" | "already_exists">
  >({});

  const visible = paginate(items, page, PER_PAGE);

  async function handleConfirm() {
    if (!pending) return;
    setError(null);
    setSavingId(pending.id);
    try {
      await onChangeStatus(pending.id, pending.nextStatus);
      setPending(null);
    } catch {
      setError("Failed to update status. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleRowAddToBeta(row: WaitlistRow) {
    setBetaRowSaving(row.id);
    try {
      const result = await onAddToBeta(row.email, row.id);
      setBetaRowResult((prev) => ({ ...prev, [row.id]: result }));
    } catch {
      setError("Failed to add to beta. Try again.");
    } finally {
      setBetaRowSaving(null);
    }
  }

  return (
    <div>
      {/* ── Error banner ──────────────────────────────────────── */}
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

      {/* ── Waitlist rows ─────────────────────────────────────── */}
      {items.length === 0 ? (
        <div style={adminEmptyStyle}>No waitlist submissions yet</div>
      ) : (
        <>
          {visible.map((row) => {
            const isPending = pending?.id === row.id;
            const isSaving = savingId === row.id;
            const isBetaSaving = betaRowSaving === row.id;
            const betaResult = betaRowResult[row.id];
            return (
              <div
                key={row.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--session-ink-hairline)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.email}
                </div>
                <div style={adminMetaStyle}>
                  {formatAdminDate(row.created_at)}
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

                {/* Status row + Add to beta */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    value={isPending ? pending!.nextStatus : row.status}
                    disabled={isSaving}
                    onChange={(e) => {
                      const next = e.target.value as WaitlistStatus;
                      if (next === row.status) {
                        setPending(null);
                      } else {
                        setPending({ id: row.id, nextStatus: next });
                      }
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
                      padding: "4px 6px",
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  {isPending && !isSaving && (
                    <>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          color: "var(--session-ink-ghost)",
                          letterSpacing: "1px",
                        }}
                      >
                        Change to {pending!.nextStatus}?
                      </span>
                      <button
                        onClick={handleConfirm}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          color: "var(--session-cream)",
                          background: "var(--session-ink)",
                          border: "none",
                          borderRadius: 4,
                          padding: "5px 9px",
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPending(null)}
                        style={{
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
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {isSaving && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "1px",
                      }}
                    >
                      Saving…
                    </span>
                  )}

                  {/* Add to beta button */}
                  {!betaResult && (
                    <button
                      onClick={() => handleRowAddToBeta(row)}
                      disabled={isBetaSaving}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "var(--session-persona)",
                        background: "none",
                        border: "1px solid var(--session-persona)",
                        borderRadius: 4,
                        padding: "5px 9px",
                        cursor: isBetaSaving ? "default" : "pointer",
                        opacity: isBetaSaving ? 0.5 : 1,
                        WebkitTapHighlightColor: "transparent",
                        marginLeft: "auto",
                      }}
                    >
                      {isBetaSaving ? "Adding…" : "Add to beta"}
                    </button>
                  )}
                  {betaResult === "added" && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-persona)",
                        letterSpacing: "0.5px",
                        marginLeft: "auto",
                      }}
                    >
                      Added
                    </span>
                  )}
                  {betaResult === "already_exists" && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "0.5px",
                        marginLeft: "auto",
                      }}
                    >
                      Already on list
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={items.length}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
