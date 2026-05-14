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

  const pillBtn = (
    active: boolean,
  ): React.CSSProperties => ({
    width: 24,
    height: 24,
    borderRadius: 5,
    border: `1px solid ${active ? "var(--session-persona)" : "var(--session-ink-ghost)"}`,
    background: active ? "var(--session-persona-muted)" : "none",
    color: active ? "var(--session-persona)" : "var(--session-ink-ghost)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
    WebkitTapHighlightColor: "transparent",
  });

  return (
    <section
      aria-label="Dev tools"
      style={{
        marginTop: 28,
        paddingTop: 16,
        borderTop: "1px solid var(--session-ink-hairline)",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          fontWeight: 500,
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
          color: "var(--session-ink-soft)",
          background: "var(--session-cream)",
          border: "1px solid var(--session-ink-hairline)",
          borderRadius: 6,
          padding: "8px 10px",
          resize: "vertical",
          marginBottom: 8,
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
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-ink-ghost)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
          }}
        >
          Checkpoints
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setSimCheckpoints(n)}
              style={pillBtn(simCheckpoints === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSimulate}
        disabled={simulating || !simulatedUser.trim()}
        style={{
          width: "100%",
          background: "none",
          border: `1px solid ${simulating || !simulatedUser.trim() ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
          borderRadius: 6,
          cursor: simulating || !simulatedUser.trim() ? "default" : "pointer",
          textAlign: "center",
          padding: "8px 0",
          opacity: simulating || !simulatedUser.trim() ? 0.5 : 1,
          WebkitTapHighlightColor: "transparent",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color:
            simulating || !simulatedUser.trim()
              ? "var(--session-ink-ghost)"
              : "var(--session-persona)",
          letterSpacing: "0.5px",
        }}
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
            margin: "6px 0 0",
            textAlign: "center",
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
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: "var(--session-ink-mid)",
          }}
        >
          Populate manual
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => togglePopulateLayer(n)}
              style={pillBtn(populateLayers.has(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handlePopulate}
        disabled={populating || populateLayers.size === 0}
        style={{
          width: "100%",
          background: "none",
          border: `1px solid ${populating || populateLayers.size === 0 ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
          borderRadius: 6,
          cursor:
            populating || populateLayers.size === 0 ? "default" : "pointer",
          textAlign: "center",
          padding: "8px 0",
          opacity: populating ? 0.5 : 1,
          WebkitTapHighlightColor: "transparent",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color:
            populating || populateLayers.size === 0
              ? "var(--session-ink-ghost)"
              : "var(--session-persona)",
          letterSpacing: "0.5px",
        }}
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
            margin: "6px 0 0",
            textAlign: "center",
          }}
        >
          {populateStatus}
        </p>
      )}
    </section>
  );
}
