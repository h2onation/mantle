"use client";

import { useEffect, useState } from "react";
import type { BaselineExperiment } from "@/lib/persona/baseline-experiment";

// ⚠ TEMPORARY strip-to-baseline experiment (Part A). Admin-only switches that
// strip safety-shaping/timing FORCES out of Jove. They are applied ONLY for
// admin conversations, never for real users. Delete this panel + its mount at
// teardown. See the banner copy below.

// Each switch reads from the resolved { enabled, forces } object; `key` is the
// baseline_experiment_gates row key the PATCH body needs. Order = render order:
// master first, then the add-back ladder in the order you climb it.
const SWITCHES: {
  key: string;
  read: (e: BaselineExperiment) => boolean;
  label: string;
  desc: string;
}[] = [
  {
    key: "enabled",
    read: (e) => e.enabled,
    label: "Baseline mode (master)",
    desc: "ON → YOUR conversations run stripped Jove: neutral identity + safety/author LIMITS + the bare save contract only. Everything below is OFF on top of this = the thinnest baseline. Real users are unaffected (admin-scoped).",
  },
  {
    key: "conductor",
    read: (e) => e.conductor,
    label: "Conductor voice (v0.4)",
    desc: "ON → YOUR conversations run the conductor prompt instead — self-contained, carries the 988 crisis clause and the save contract, no cross-domain instructions, ignores the rung toggles below. Overrides Baseline mode when both are on. Run it in a Situation conversation. Real users unaffected (admin-scoped).",
  },
  {
    key: "force_flag_dont_grab",
    read: (e) => e.forces.flagDontGrab,
    label: "Rung 1 · flag-don't-grab",
    desc: "Adds the pre-proposal restraint: flag worth-keeping material in passing and stay with the thread, which buys you the turns to land before any save offer.",
  },
  {
    key: "force_seam_rule",
    read: (e) => e.forces.seamRule,
    label: "Rung 2 · seam rule",
    desc: "Adds “propose only at a seam / ready material doesn't mean now” — the explicit WHEN.",
  },
  {
    key: "force_mechanics_deepening",
    read: (e) => e.forces.mechanicsDeepening,
    label: "Rung 3 · MECHANICS deepening",
    desc: "Adds the rest of MECHANICS (walk-one-moment, never-said test, feeling-is-the-doorway, proposal form). With rungs 1–2 also on, this is the full live mechanics.",
  },
  {
    key: "force_character_shaping",
    read: (e) => e.forces.characterShaping,
    label: "Rung 4 · CHARACTER shaping",
    desc: "Swaps the neutral identity for the full CHARACTER (pattern-naming, lay-out-choices, handoff).",
  },
  {
    key: "force_tier3_blocks",
    read: (e) => e.forces.tier3Blocks,
    label: "Final arm · Tier-3 / intake spine",
    desc: "Renders the mode's Tier-3 guidance. The guided-intake spine appears only in a Guided conversation — use this for the intake-mode arm.",
  },
  {
    key: "force_gate",
    read: (e) => e.forces.gate,
    label: "Server gate (re-add)",
    desc: "OFF (default) → the gate is OPEN: any time Jove emits the transition line it saves (crisis still blocks). ON → re-enables the material-quality checklist + cooldown.",
  },
];

export default function BaselineExperimentPanel() {
  const [experiment, setExperiment] = useState<BaselineExperiment | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/baseline-experiment")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.experiment) setExperiment(d.experiment);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load baseline experiment.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function flip(key: string, next: boolean) {
    setPending(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/baseline-experiment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Update failed");
      if (d?.experiment) setExperiment(d.experiment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--session-warning)",
        background: "var(--session-walnut-surface)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 28,
      }}
    >
      {/* TEARDOWN banner — this experiment must not live in admin forever. */}
      <div
        style={{
          border: "1px solid var(--session-warning)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--session-warning)",
            marginBottom: 4,
          }}
        >
          ⚠ Temporary experiment — delete when concluded
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            lineHeight: 1.45,
            color: "var(--session-walnut-meta)",
          }}
        >
          These switches strip safety-shaping and timing out of Jove to measure
          raw save-timing. They apply ONLY to your own (admin) conversations —
          never to a real user. Crisis / 988 safety stays on even fully stripped.
          When the strip-down experiment concludes, delete the table, this panel,
          the route, and the baseline-experiment code (teardown steps live in the
          migration and baseline-experiment.ts).
        </div>
      </div>

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
          Baseline experiment
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
        Flip Baseline mode on, leave the rest off, and start a Situation
        conversation to talk to the thinnest Jove. Then add ONE force at a time,
        in a fresh conversation, to climb the ladder.
      </p>

      {experiment === null && !error && (
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

      {experiment !== null &&
        SWITCHES.map((s, i) => {
          const on = s.read(experiment);
          const busy = pending === s.key;
          return (
            <div
              key={s.key}
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
                  {s.label}
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
                  {s.desc}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${s.label} ${on ? "on" : "off"}`}
                disabled={busy}
                onClick={() => flip(s.key, !on)}
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
