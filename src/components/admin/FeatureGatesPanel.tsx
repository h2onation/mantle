"use client";

import { useEffect, useState } from "react";
import type { FeatureGates } from "@/lib/persona/feature-gates";

// Founder-facing copy for each gate. `field` keys into the FeatureGates
// object the API returns; `key` is the feature_gates row key the PATCH
// body needs. `def` is the shipped default. `what` is one plain line on what
// the switch controls; `desc` spells out ON vs OFF and any gotcha. Order is
// the order they render.
const GATE_META: {
  key: string;
  field: keyof FeatureGates;
  label: string;
  def: "ON" | "OFF";
  what: string;
  desc: string;
}[] = [
  {
    key: "persona_deltas",
    field: "personaDeltas",
    label: "Persona routing",
    def: "ON",
    what: "Adapts Jove's voice to the user's neurotype.",
    desc: "ON: autistic / ADHD / dyslexic users get their tailored voice. OFF: everyone gets one neutral voice (the neurotype deltas stop loading).",
  },
  {
    key: "situation",
    field: "situation",
    label: "Situation mode",
    def: "ON",
    what: "The “Situation” way to start — the user brings a topic and Jove goes deep.",
    desc: "ON: the Situation door shows on Home and new chats can start here. OFF: the door reads “Coming soon” AND any conversation that would start as Situation falls back to the next enabled mode (Guided, then Upload). ⚠ With this OFF you cannot start a plain Situation chat — a new conversation lands in Guided instead.",
  },
  {
    key: "guided_intake",
    field: "guidedIntake",
    label: "Guided intake mode",
    def: "ON",
    what: "The “Guided” way to start — Jove leads, the user picks a section and taps through prompts.",
    desc: "ON: the Guided door shows and its tappable section / focus cards work. OFF: the door reads “Coming soon” and its path falls back to the next enabled mode.",
  },
  {
    key: "upload",
    field: "upload",
    label: "Upload mode",
    def: "ON",
    what: "The “Upload” way to start — paste a transcript or journal for Jove to work from.",
    desc: "ON: the Upload door shows on Home. OFF: it reads “Coming soon” and falls back to Situation.",
  },
  {
    key: "checkpoints",
    field: "checkpoints",
    label: "Checkpoint pipeline",
    def: "ON",
    what: "Whether Jove can propose Manual entries at all (the “I want to put something in your Manual” → tappable card flow).",
    desc: "ON: Jove proposes and entries can be saved. OFF: Jove still talks and analyzes, but never proposes or saves anything.",
  },
  {
    key: "extraction_brief",
    field: "extractionBrief",
    label: "Extraction analysis",
    def: "ON",
    what: "The background analysis that reads each message and judges when material is ripe to save.",
    desc: "ON: normal. OFF: voice-only — no analysis steers Jove, AND checkpoints can't fire (they depend on it), so nothing saves even if Checkpoint pipeline is ON.",
  },
  {
    key: "reflection_meter",
    field: "reflectionMeter",
    label: "Reflection meter",
    def: "OFF",
    what: "Switches the WEB capture model between two mutually-exclusive ways to save.",
    desc: "OFF: Jove PUSHES — it proposes an entry when it sees one is ready. ON: the user PULLS — a “reflection ready” meter fills as the talk deepens and the user taps to capture. ⚠ Turning this ON automatically turns OFF Jove's auto-propose — you get one model or the other, never both. Text / SMS always uses push. For the strip-to-baseline experiment: keep this OFF, or Jove's push (what the experiment watches) is disabled and the meter reads “ready” immediately.",
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
        <strong>These are global — they change Jove for every user, not just
        you.</strong> Each switch shows its default and what ON vs OFF does. The
        five mode / pipeline switches default ON (turn one off to isolate the
        core loop for debugging); Reflection meter is a real product model that
        defaults OFF. Watch for the ⚠ notes — some switches quietly change
        another.
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
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      fontWeight: 500,
                      letterSpacing: "0.03em",
                      color: "var(--session-walnut-meta-soft)",
                    }}
                  >
                    default {g.def}
                    {on === (g.def === "ON") ? "" : " · changed"}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    lineHeight: 1.45,
                    color: "var(--session-ink)",
                    marginBottom: 3,
                  }}
                >
                  {g.what}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    lineHeight: 1.45,
                    color: "var(--session-walnut-meta)",
                  }}
                >
                  {g.desc}
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
