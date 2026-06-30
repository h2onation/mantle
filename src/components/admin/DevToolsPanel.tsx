"use client";

import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import PersonaIntakeControls from "@/components/admin/PersonaIntakeControls";
import type { ConversationMode } from "@/lib/persona/config";

export default function DevToolsPanel() {
  const isAdmin = useIsAdmin();
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("");
  const [simulatedUser, setSimulatedUser] = useState("");
  const [simIntakeMode, setSimIntakeMode] =
    useState<ConversationMode>("guided-intake");
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5]),
  );
  const [populating, setPopulating] = useState(false);
  const [populateStatus, setPopulateStatus] = useState<string>("");

  // The live run renders in the session view and ends itself at the first
  // checkpoint / [END] / turn cap; MainApp broadcasts when it's done so the
  // Run button re-enables.
  useEffect(() => {
    function onEnded() {
      setSimulating(false);
      setSimStatus("Simulation ended — confirm the checkpoint in the session");
    }
    window.addEventListener("dev-tools:live-sim-ended", onEnded);
    return () =>
      window.removeEventListener("dev-tools:live-sim-ended", onEnded);
  }, []);

  function handleSimulate() {
    if (!simulatedUser.trim()) return;
    setSimulating(true);
    setSimStatus("Running live — watch the session view");
    window.dispatchEvent(
      new CustomEvent("dev-tools:run-live-simulation", {
        detail: { description: simulatedUser.trim(), mode: simIntakeMode },
      }),
    );
  }

  function togglePopulateLayer(layer: number) {
    setPopulateLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  async function handlePopulate() {
    if (populateLayers.size === 0) return;
    setPopulating(true);
    setPopulateStatus("");
    try {
      const res = await fetch("/api/dev-populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: Array.from(populateLayers).sort() }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[populate] Failed:", errText);
        setPopulateStatus(`Failed: HTTP ${res.status}`);
      } else {
        const sorted = Array.from(populateLayers).sort();
        setPopulateStatus(
          `Inserted layer${sorted.length > 1 ? "s" : ""} ${sorted.join(", ")}`,
        );
        window.dispatchEvent(new CustomEvent("dev-tools:populate-complete"));
      }
    } catch (err) {
      console.error("[populate] Error:", err);
      setPopulateStatus("Failed: network error");
    } finally {
      setPopulating(false);
    }
  }

  if (!isAdmin) return null;

  const pillBtn = (active: boolean): React.CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 5,
    border: `1px solid ${active ? "var(--session-persona)" : "var(--session-walnut-border)"}`,
    background: active ? "var(--session-persona-muted)" : "var(--session-walnut-surface-soft)",
    color: active ? "var(--session-persona)" : "var(--session-ink-soft)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    WebkitTapHighlightColor: "transparent",
  });

  const actionBtn = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    background: disabled
      ? "var(--session-walnut-surface-soft)"
      : "var(--session-walnut-surface)",
    border: `1px solid ${disabled ? "var(--session-walnut-border-soft)" : "var(--session-walnut-border)"}`,
    borderRadius: 6,
    cursor: disabled ? "default" : "pointer",
    textAlign: "center",
    padding: "9px 0",
    WebkitTapHighlightColor: "transparent",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--size-meta)",
    fontWeight: 500,
    color: disabled ? "var(--session-ink-mid)" : "var(--session-walnut)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--size-meta)",
    color: "var(--session-ink-soft)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    fontWeight: 500,
  };

  return (
    <section
      aria-label="Dev tools"
      style={{
        marginTop: 24,
        padding: "14px 14px 16px",
        background: "var(--session-walnut-surface-soft)",
        border: "1px solid var(--session-walnut-border)",
        borderRadius: 8,
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          fontWeight: 600,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-walnut)",
        }}
      >
        Dev tools
      </p>

      <textarea
        value={simulatedUser}
        onChange={(e) => setSimulatedUser(e.target.value)}
        placeholder="Describe a simulated user…"
        aria-label="Simulated user description"
        rows={3}
        style={{
          width: "100%",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--session-ink)",
          background: "var(--session-linen)",
          border: "1px solid var(--session-walnut-border)",
          borderRadius: 6,
          padding: "8px 10px",
          resize: "vertical",
          marginBottom: 10,
          outline: "none",
          lineHeight: 1.4,
          boxSizing: "border-box",
        }}
      />

      <PersonaIntakeControls
        intakeMode={simIntakeMode}
        onIntakeModeChange={setSimIntakeMode}
        disabled={simulating}
        showPersona={false}
      />

      <p
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-soft)",
          lineHeight: 1.4,
        }}
      >
        Drives a fake user through the real app live. Persona comes from this
        account — set it in Settings. Stops at the first checkpoint for you to
        confirm.
      </p>

      <button
        type="button"
        onClick={handleSimulate}
        disabled={simulating || !simulatedUser.trim()}
        style={actionBtn(simulating || !simulatedUser.trim())}
      >
        {simulating
          ? "Running…"
          : !simulatedUser.trim()
            ? "Enter a description"
            : "Run live simulation"}
      </button>

      {!simulating && simStatus && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: simStatus.includes("ailed")
              ? "var(--session-error)"
              : "var(--session-persona)",
            letterSpacing: "0.3px",
            margin: "8px 0 0",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {simStatus}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
          marginBottom: 8,
          paddingTop: 14,
          borderTop: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        <span style={labelStyle}>Populate manual</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => togglePopulateLayer(n)}
              style={pillBtn(populateLayers.has(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handlePopulate}
        disabled={populating || populateLayers.size === 0}
        style={actionBtn(populating || populateLayers.size === 0)}
      >
        {populating
          ? "Populating..."
          : populateLayers.size === 0
            ? "Select layers"
            : `Insert layers ${Array.from(populateLayers).sort().join(", ")}`}
      </button>

      {!populating && populateStatus && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: populateStatus.startsWith("Failed")
              ? "var(--session-error)"
              : "var(--session-persona)",
            letterSpacing: "0.3px",
            margin: "8px 0 0",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {populateStatus}
        </p>
      )}
    </section>
  );
}
