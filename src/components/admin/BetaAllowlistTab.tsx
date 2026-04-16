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

export interface BetaAllowlistRow {
  id: string;
  email: string;
  notes: string | null;
  created_at: string;
}

interface Props {
  items: BetaAllowlistRow[];
  onAdd: (email: string) => Promise<"added" | "already_exists">;
  onRemove: (id: string) => Promise<void>;
}

const PER_PAGE = 15;

export default function BetaAllowlistTab({ items, onAdd, onRemove }: Props) {
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState("");
  const [formStatus, setFormStatus] = useState<
    "idle" | "saving" | "added" | "already_exists" | "error"
  >("idle");
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = paginate(items, page, PER_PAGE);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setFormStatus("saving");
    try {
      const result = await onAdd(trimmed);
      setFormStatus(result);
      if (result === "added") setEmail("");
      setTimeout(() => setFormStatus("idle"), 3000);
    } catch {
      setFormStatus("error");
      setTimeout(() => setFormStatus("idle"), 3000);
    }
  }

  async function handleConfirmRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await onRemove(id);
      setPendingRemove(null);
    } catch {
      setError("Failed to remove. Try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      {/* ── Add form ──────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 0",
          borderBottom: "1px solid var(--session-ink-hairline)",
          marginBottom: 4,
        }}
      >
        <div style={{ ...adminLabelStyle, marginBottom: 10 }}>
          Add email to allowlist
        </div>
        <form
          onSubmit={handleSubmit}
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
                formStatus === "saving" || !email.trim()
                  ? "default"
                  : "pointer",
              opacity: formStatus === "saving" || !email.trim() ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {formStatus === "saving" ? "Adding…" : "Add"}
          </button>
        </form>
        {formStatus === "added" && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-persona)",
              marginTop: 8,
              letterSpacing: "0.5px",
            }}
          >
            Added to allowlist.
          </div>
        )}
        {formStatus === "already_exists" && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              marginTop: 8,
              letterSpacing: "0.5px",
            }}
          >
            Already on the allowlist.
          </div>
        )}
        {formStatus === "error" && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-error)",
              marginTop: 8,
              letterSpacing: "0.5px",
            }}
          >
            Failed to add. Try again.
          </div>
        )}
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

      {/* ── List ──────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div style={adminEmptyStyle}>No emails on the allowlist yet</div>
      ) : (
        <>
          {visible.map((row) => {
            const isPending = pendingRemove === row.id;
            const isRemoving = removingId === row.id;
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink)",
                      fontWeight: 500,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {row.email}
                  </div>

                  {!isPending && !isRemoving && (
                    <button
                      onClick={() => setPendingRemove(row.id)}
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
                      Remove
                    </button>
                  )}

                  {isPending && !isRemoving && (
                    <>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          color: "var(--session-ink-ghost)",
                          letterSpacing: "1px",
                        }}
                      >
                        Remove?
                      </span>
                      <button
                        onClick={() => handleConfirmRemove(row.id)}
                        style={{
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
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setPendingRemove(null)}
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

                  {isRemoving && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "1px",
                      }}
                    >
                      Removing…
                    </span>
                  )}
                </div>
                <div style={adminMetaStyle}>
                  {formatAdminDate(row.created_at)}
                  {row.notes ? ` · ${row.notes}` : ""}
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
