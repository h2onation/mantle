"use client";

import { useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

export default function DevToolsPanel() {
  const isAdmin = useIsAdmin();
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("");
  const [simCheckpoints, setSimCheckpoints] = useState(1);
  const [simulatedUser, setSimulatedUser] = useState("");
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5]),
  );
  const [populating, setPopulating] = useState(false);
  const [populateStatus, setPopulateStatus] = useState<string>("");

  async function handleSimulate() {
    setSimulating(true);
    setSimStatus("Starting simulation...");

    let simConversationId: string | null = null;

    try {
      const res = await fetch("/api/dev-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedUserDescription: simulatedUser.trim(),
          checkpointTarget: simCheckpoints,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setSimStatus(`Failed: ${errBody.error || `HTTP ${res.status}`}`);
        setSimulating(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "started") {
              simConversationId = event.conversationId;
              window.dispatchEvent(
                new CustomEvent("dev-tools:simulation-event", {
                  detail: { type: "start", conversationId: event.conversationId },
                }),
              );
            } else if (event.type === "turn") {
              setSimStatus(`Turn ${event.turn}...`);
            } else if (event.type === "turn_complete") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Turn ${event.turn} complete`);
              if (simConversationId) {
                window.dispatchEvent(
                  new CustomEvent("dev-tools:simulation-event", {
                    detail: { type: "turn", conversationId: simConversationId },
                  }),
                );
              }
            } else if (event.type === "checkpoint") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(
                `Checkpoint ${event.checkpointNumber} ${event.action || "confirmed"} (layer ${event.layer}) at turn ${event.turn}`,
              );
              if (simConversationId) {
                window.dispatchEvent(
                  new CustomEvent("dev-tools:simulation-event", {
                    detail: { type: "checkpoint", conversationId: simConversationId },
                  }),
                );
              }
            } else if (event.type === "complete") {
              const cpInfo =
                event.totalCheckpoints != null
                  ? `, ${event.totalCheckpoints} checkpoint${event.totalCheckpoints !== 1 ? "s" : ""}`
                  : "";
              setSimStatus(`Done — ${event.totalTurns} turns${cpInfo}`);
            } else if (event.type === "error") {
              setSimStatus("Simulation failed");
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch {
      setSimStatus("Simulation failed");
    } finally {
      setSimulating(false);
    }
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={labelStyle}>Checkpoints</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSimCheckpoints(n)}
              style={pillBtn(simCheckpoints === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSimulate}
        disabled={simulating || !simulatedUser.trim()}
        style={actionBtn(simulating || !simulatedUser.trim())}
      >
        {simulating
          ? simStatus
          : !simulatedUser.trim()
            ? "Enter a description"
            : `Run ${simCheckpoints} checkpoint${simCheckpoints > 1 ? "s" : ""}`}
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
