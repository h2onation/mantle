"use client";

import { useEffect, useState } from "react";
import { COMPOSER_MODES, type ComposerMode } from "@/lib/persona/composer-mode";

// COMPOSER_MODE live switch — which composer writes the Manual entry when a user
// pulls. A/B test scaffolding: this panel, the route, and the loser mode are all
// deleted once a winner is picked. Data: GET/PATCH /api/admin/composer-mode.

const MODE_META: Record<
  ComposerMode,
  { label: string; what: string }
> = {
  composer: {
    label: "Composer",
    what: "The separate composer writes the entry — it re-reads the transcript from outside at save time. The shipped default.",
  },
  conductor: {
    label: "Conductor",
    what: "Jove writes the entry itself, from the full live conversation it just had. No separate re-read.",
  },
  compare: {
    label: "Compare",
    what: "Runs BOTH and shows you the two entries side by side, so you pick one. 2× the cost per pull — for judging only.",
  },
};

export default function ComposerModePanel() {
  const [mode, setMode] = useState<ComposerMode | null>(null);
  const [pending, setPending] = useState<ComposerMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/composer-mode")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.mode) setMode(d.mode);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load composer mode.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(next: ComposerMode) {
    if (next === mode) return;
    setPending(next);
    setError(null);
    const prev = mode;
    setMode(next); // optimistic
    try {
      const res = await fetch("/api/admin/composer-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Update failed");
      if (d?.mode) setMode(d.mode);
    } catch (e) {
      setMode(prev); // roll back
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 28,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-strong)",
          }}
        >
          Entry composer — A/B test
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--session-walnut-meta)",
          margin: "0 0 16px",
        }}
      >
        <strong>Global — changes who writes the entry for every user.</strong> Who
        composes the Manual entry when someone pulls the reflection bar. Flips
        live, no deploy. Pick <strong>Compare</strong> to see both versions side
        by side and judge which is better.
      </p>

      {mode === null && !error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-walnut-meta-soft)",
            margin: 0,
          }}
        >
          Loading…
        </p>
      )}

      {mode !== null &&
        COMPOSER_MODES.map((m, i) => {
          const active = mode === m;
          const busy = pending === m;
          const meta = MODE_META[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => choose(m)}
              style={{
                all: "unset",
                display: "flex",
                width: "100%",
                boxSizing: "border-box",
                alignItems: "flex-start",
                gap: 12,
                cursor: busy ? "default" : "pointer",
                padding: "12px 0",
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid var(--session-walnut-border-soft)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  marginTop: 2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${active ? "var(--session-persona)" : "var(--session-walnut-border)"}`,
                  background: active ? "var(--session-persona)" : "transparent",
                  boxShadow: active
                    ? "inset 0 0 0 3px var(--session-walnut-surface)"
                    : "none",
                  transition: "all 140ms ease",
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--session-ink)",
                    marginBottom: 3,
                  }}
                >
                  {meta.label}
                  {active && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: "var(--session-persona)",
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                  {m === "composer" && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "11px",
                        fontWeight: 500,
                        letterSpacing: "0.03em",
                        color: "var(--session-walnut-meta-soft)",
                      }}
                    >
                      default
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    lineHeight: 1.45,
                    color: "var(--session-walnut-meta)",
                  }}
                >
                  {meta.what}
                </span>
              </span>
            </button>
          );
        })}

      {error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: "var(--session-error-text)",
            margin: "10px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
