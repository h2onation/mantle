"use client";

import { useState } from "react";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import SettingsRow from "@/components/shared/SettingsRow";
import { VERSION } from "@/lib/version";
import { CRISIS_RESOURCES, CRISIS_FOOTER } from "@/lib/crisis-resources";

interface MobileSettingsProps {
  userEmail: string;
  onSimulationEvent?: (type: "start" | "turn" | "checkpoint", conversationId: string) => void;
  onPopulateComplete?: () => void;
}

export default function MobileSettings({
  userEmail,
  onSimulationEvent,
  onPopulateComplete,
}: MobileSettingsProps) {
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("Run a fake conversation");
  const [simCheckpoints, setSimCheckpoints] = useState(1);
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [populating, setPopulating] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleDeleteData() {
    await fetch("/api/dev-reset", { method: "POST" });
    localStorage.clear();
    window.location.reload();
  }

  async function handleDeleteAccount() {
    await fetch("/api/account/delete", { method: "POST" });
    localStorage.clear();
    window.location.href = "/login";
  }

  async function handleSimulate() {
    setSimulating(true);
    setSimStatus("Starting simulation...");

    let simConversationId: string | null = null;

    try {
      const res = await fetch("/api/dev-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoints: simCheckpoints }),
      });
      if (!res.ok) {
        setSimStatus("Failed to start simulation");
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
              if (onSimulationEvent) {
                onSimulationEvent("start", event.conversationId);
              }
            } else if (event.type === "turn") {
              setSimStatus(`Turn ${event.turn}...`);
            } else if (event.type === "turn_complete") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Turn ${event.turn} complete`);
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("turn", simConversationId);
              }
            } else if (event.type === "checkpoint_auto_confirmed") {
              setSimStatus(`Checkpoint ${event.checkpointNumber} auto-confirmed (layer ${event.layer})`);
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("turn", simConversationId);
              }
            } else if (event.type === "checkpoint") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Checkpoint ${event.checkpointNumber} at turn ${event.turn}!`);
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("checkpoint", simConversationId);
              }
            } else if (event.type === "complete") {
              const cpInfo = event.totalCheckpoints != null ? `, ${event.totalCheckpoints} checkpoint${event.totalCheckpoints !== 1 ? "s" : ""}` : "";
              setSimStatus(
                `Done — ${event.totalTurns} turns${cpInfo}`
              );
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
    try {
      const res = await fetch("/api/dev-populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: Array.from(populateLayers).sort() }),
      });
      if (!res.ok) {
        console.error("[populate] Failed:", await res.text());
      }
      if (onPopulateComplete) onPopulateComplete();
    } catch (err) {
      console.error("[populate] Error:", err);
    } finally {
      setPopulating(false);
    }
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "40px 24px 56px",
      }}
    >
      {/* Header */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          color: "var(--color-text-ghost)",
          letterSpacing: "3px",
          textTransform: "uppercase",
          margin: "0 0 32px 0",
        }}
      >
        SETTINGS
      </p>

      {/* Account */}
      <SettingsRow title="Account" subtitle={userEmail || "—"} />

      {/* Crisis Support */}
      <SettingsRow
        title="Crisis Support"
        subtitle="Resources and helplines"
        onClick={() => setCrisisOpen(!crisisOpen)}
      />
      <div
        style={{
          maxHeight: crisisOpen ? 300 : 0,
          opacity: crisisOpen ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.05s",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid var(--color-divider)",
            padding: "0 0 16px 0",
          }}
        >
          {CRISIS_RESOURCES.map((resource, i) => (
            <div key={i} style={{ marginTop: i > 0 ? 12 : 0 }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--color-text-ghost)",
                  letterSpacing: "0.5px",
                  margin: "0 0 4px 0",
                }}
              >
                {resource.label}
              </p>
              <a
                href={resource.href}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--color-accent)",
                  textDecoration: "none",
                }}
              >
                {resource.action}
              </a>
            </div>
          ))}
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--color-text-ghost)",
              letterSpacing: "0.5px",
              margin: "12px 0 0 0",
              textAlign: "center",
            }}
          >
            {CRISIS_FOOTER}
          </p>
        </div>
      </div>

      {/* Logout */}
      <SettingsRow
        title="Log out"
        subtitle={userEmail || "—"}
        onClick={handleLogout}
      />

      {/* Simulate user */}
      <SettingsRow title="Simulate user">
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-accent)",
                letterSpacing: "0.2px",
                margin: 0,
              }}
            >
              Simulate user
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSimCheckpoints(n)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `1px solid ${simCheckpoints === n ? "var(--color-accent)" : "var(--color-text-ghost)"}`,
                    background: simCheckpoints === n ? "var(--color-accent-ghost)" : "none",
                    color: simCheckpoints === n ? "var(--color-accent)" : "var(--color-text-ghost)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            style={{
              width: "100%",
              background: "none",
              border: `1px solid ${simulating ? "var(--color-divider)" : "var(--color-accent-ghost)"}`,
              borderRadius: 8,
              cursor: simulating ? "default" : "pointer",
              textAlign: "center",
              padding: "10px 0",
              opacity: simulating ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: simulating ? "var(--color-text-ghost)" : "var(--color-accent)",
                letterSpacing: "0.5px",
                margin: 0,
              }}
            >
              {simulating
                ? simStatus
                : `Run ${simCheckpoints} checkpoint${simCheckpoints > 1 ? "s" : ""}`}
            </p>
          </button>
        </div>
      </SettingsRow>

      {/* Populate manual */}
      <SettingsRow title="Populate manual">
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-accent)",
                letterSpacing: "0.2px",
                margin: 0,
              }}
            >
              Populate manual
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => togglePopulateLayer(n)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `1px solid ${populateLayers.has(n) ? "var(--color-accent)" : "var(--color-text-ghost)"}`,
                    background: populateLayers.has(n) ? "var(--color-accent-ghost)" : "none",
                    color: populateLayers.has(n) ? "var(--color-accent)" : "var(--color-text-ghost)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    WebkitTapHighlightColor: "transparent",
                  }}
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
              border: `1px solid ${populating || populateLayers.size === 0 ? "var(--color-divider)" : "var(--color-accent-ghost)"}`,
              borderRadius: 8,
              cursor: populating || populateLayers.size === 0 ? "default" : "pointer",
              textAlign: "center",
              padding: "10px 0",
              opacity: populating ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: populating || populateLayers.size === 0 ? "var(--color-text-ghost)" : "var(--color-accent)",
                letterSpacing: "0.5px",
                margin: 0,
              }}
            >
              {populating
                ? "Populating..."
                : populateLayers.size === 0
                  ? "Select layers above"
                  : `Insert layers ${Array.from(populateLayers).sort().join(", ")}`}
            </p>
          </button>
        </div>
      </SettingsRow>

      {/* Delete user data */}
      <SettingsRow
        title="Delete user data"
        titleColor="var(--color-error)"
        subtitle="Removes manual and conversations"
        onClick={() => setShowDeleteDataConfirm(true)}
      />

      {/* Delete account */}
      <SettingsRow
        title="Delete account"
        titleColor="var(--color-error)"
        subtitle="Cannot be undone"
        onClick={() => setShowDeleteAccountConfirm(true)}
        noBorder
      />

      {/* Version */}
      <div
        onClick={() => setVersionOpen(!versionOpen)}
        style={{
          padding: "24px 0",
          textAlign: "center",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            color: "var(--color-text-ghost)",
            letterSpacing: "1px",
            margin: 0,
          }}
        >
          v{VERSION.app} · sage v{VERSION.sage}
        </p>
        <div
          style={{
            maxHeight: versionOpen ? 100 : 0,
            opacity: versionOpen ? 1 : 0,
            overflow: "hidden",
            transition:
              "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.05s",
          }}
        >
          <div style={{ marginTop: 10 }}>
            {[
              ["App version", VERSION.app],
              ["Sage version", VERSION.sage],
              ["Last updated", VERSION.updated],
            ].map(([label, value]) => (
              <p
                key={label}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--color-text-ghost)",
                  letterSpacing: "0.5px",
                  margin: "4px 0",
                }}
              >
                {label}: {value}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation modals */}
      <ConfirmationModal
        open={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        onConfirm={handleDeleteData}
        message="This will delete your manual and all conversations. Your account will remain."
        confirmLabel="Delete data"
        isDestructive
      />

      <ConfirmationModal
        open={showDeleteAccountConfirm}
        onClose={() => setShowDeleteAccountConfirm(false)}
        onConfirm={handleDeleteAccount}
        message="This will permanently delete your account and all data. This cannot be undone."
        confirmLabel="Delete account"
        isDestructive
      />
    </div>
  );
}
