"use client";

import { useEffect, useState } from "react";
import type { FeatureGates } from "@/lib/persona/feature-gates";

// Founder-facing copy for each gate. `field` keys into the FeatureGates
// object the API returns; `key` is the feature_gates row key the PATCH
// body needs. Order is the order they render.
const GATE_META: {
  key: string;
  field: keyof FeatureGates;
  label: string;
  off: string;
}[] = [
  {
    key: "persona_deltas",
    field: "personaDeltas",
    label: "Persona routing",
    off: "OFF → one neutral voice. The autistic / ADHD / dyslexic voice deltas stop loading; everyone gets the base scaffold.",
  },
  {
    key: "conversation_modes",
    field: "conversationModes",
    label: "Conversation modes",
    off: "OFF → every conversation runs Situation. Guided Intake and Upload entry paths (and the upload short-circuit) stop firing.",
  },
  {
    key: "checkpoints",
    field: "checkpoints",
    label: "Checkpoint pipeline",
    off: "OFF → Jove never proposes a Manual entry. Detection, the quality gate, and composition all go dark. Voice + extraction still run.",
  },
];

export default function FeatureGatesPanel() {
  const [gates, setGates] = useState<FeatureGates | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/feature-gates")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.gates) setGates(d.gates);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load feature gates.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function flip(key: string, field: keyof FeatureGates, next: boolean) {
    setPending(key);
    setError(null);
    // Optimistic update so the switch feels instant.
    setGates((g) => (g ? { ...g, [field]: next } : g));
    try {
      const res = await fetch("/api/admin/feature-gates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Update failed");
      if (d?.gates) setGates(d.gates);
    } catch (e) {
      // Roll back on failure.
      setGates((g) => (g ? { ...g, [field]: !next } : g));
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
          Feature gates
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
        Live global switches. Turn one off to strip that subsystem out and test
        the core voice + extraction loop in isolation. All default ON; off is
        debug scaffolding, not a permanent state.
      </p>

      {gates === null && !error && (
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

      {gates !== null &&
        GATE_META.map((g, i) => {
          const on = gates[g.field];
          const busy = pending === g.key;
          return (
            <div
              key={g.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                padding: "12px 0",
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid var(--session-walnut-border-soft)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--session-ink)",
                    marginBottom: 3,
                  }}
                >
                  {g.label}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: on
                        ? "var(--session-persona)"
                        : "var(--session-warning)",
                    }}
                  >
                    {on ? "ON" : "OFF"}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    lineHeight: 1.45,
                    color: "var(--session-walnut-meta)",
                  }}
                >
                  {g.off}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${g.label} ${on ? "on" : "off"}`}
                disabled={busy}
                onClick={() => flip(g.key, g.field, !on)}
                style={{
                  all: "unset",
                  cursor: busy ? "default" : "pointer",
                  flexShrink: 0,
                  width: 44,
                  height: 26,
                  borderRadius: 999,
                  background: on
                    ? "var(--session-persona)"
                    : "var(--session-walnut-border)",
                  position: "relative",
                  transition: "background 140ms ease",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: on ? 21 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--session-cream-bright)",
                    transition: "left 140ms ease",
                  }}
                />
              </button>
            </div>
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
