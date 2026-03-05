"use client";

import { useState } from "react";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import SettingsRow from "@/components/shared/SettingsRow";
import AdminView from "@/components/mobile/AdminView";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

interface MobileSettingsProps {
  userEmail: string;
  onSimulationEvent?: (type: "start" | "turn" | "checkpoint", conversationId: string) => void;
  onPopulateComplete?: () => void;
}

function SectionHeader({
  label,
  isOpen,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: "var(--session-ink-faded)",
        letterSpacing: "3px",
        textTransform: "uppercase",
        margin: "32px 0 12px 0",
        padding: "8px 0",
        background: "none",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
      <span style={{ fontSize: "10px" }}>{isOpen ? "\u25BE" : "\u25B8"}</span>
    </button>
  );
}

export default function MobileSettings({
  userEmail,
  onSimulationEvent,
  onPopulateComplete,
}: MobileSettingsProps) {
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("Run a fake conversation");
  const [simCheckpoints, setSimCheckpoints] = useState(1);
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [populating, setPopulating] = useState(false);
  const isAdmin = useIsAdmin();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["account"]));

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        padding: "40px 24px calc(68px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          color: "var(--session-ink-ghost)",
          letterSpacing: "3px",
          textTransform: "uppercase",
          margin: "0 0 32px 0",
        }}
      >
        SETTINGS
      </p>

      {/* ─── Account ─────────────────────────────────────────────── */}
      <SectionHeader label="ACCOUNT" isOpen={openSections.has("account")} onToggle={() => toggleSection("account")} />

      {openSections.has("account") && (
        <>
          <SettingsRow
            title="Log out"
            subtitle={userEmail || "—"}
            onClick={handleLogout}
          />

          <SettingsRow
            title="Delete user data"
            titleColor="var(--color-error)"
            subtitle="Removes manual and conversations"
            onClick={() => setShowDeleteDataConfirm(true)}
          />

          <SettingsRow
            title="Delete account"
            titleColor="var(--color-error)"
            subtitle="Cannot be undone"
            onClick={() => setShowDeleteAccountConfirm(true)}
            noBorder
          />
        </>
      )}

      {/* ─── Crisis Support ──────────────────────────────────────── */}
      <SectionHeader label="CRISIS SUPPORT" isOpen={openSections.has("crisis")} onToggle={() => toggleSection("crisis")} />

      {openSections.has("crisis") && (
      <SettingsRow title="Crisis Support" noBorder>
        <div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
                margin: "0 0 4px 0",
              }}
            >
              988 Suicide &amp; Crisis Lifeline
            </p>
            <a
              href="tel:988"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-sage)",
                textDecoration: "none",
              }}
            >
              Call or text 988
            </a>
          </div>
          <div style={{ marginTop: "10px" }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
                margin: "0 0 4px 0",
              }}
            >
              Crisis Text Line
            </p>
            <a
              href="sms:741741?body=HOME"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-sage)",
                textDecoration: "none",
              }}
            >
              Text HOME to 741741
            </a>
          </div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
              margin: "10px 0 0 0",
            }}
          >
            Free, confidential, available 24/7
          </p>
        </div>
      </SettingsRow>
      )}

      {/* ─── Dev Tools (admin only) ────────────────────────────── */}
      {isAdmin && (
      <>
      <SectionHeader label="DEV TOOLS" isOpen={openSections.has("devtools")} onToggle={() => toggleSection("devtools")} />

      {openSections.has("devtools") && (
        <>
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
                color: "var(--session-sage)",
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
                    border: `1px solid ${simCheckpoints === n ? "var(--session-sage)" : "var(--session-ink-ghost)"}`,
                    background: simCheckpoints === n ? "var(--session-sage-muted)" : "none",
                    color: simCheckpoints === n ? "var(--session-sage)" : "var(--session-ink-ghost)",
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
              border: `1px solid ${simulating ? "var(--session-ink-hairline)" : "var(--session-sage-muted)"}`,
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
                color: simulating ? "var(--session-ink-ghost)" : "var(--session-sage)",
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
      <SettingsRow title="Populate manual" noBorder>
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
                color: "var(--session-sage)",
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
                    border: `1px solid ${populateLayers.has(n) ? "var(--session-sage)" : "var(--session-ink-ghost)"}`,
                    background: populateLayers.has(n) ? "var(--session-sage-muted)" : "none",
                    color: populateLayers.has(n) ? "var(--session-sage)" : "var(--session-ink-ghost)",
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
              border: `1px solid ${populating || populateLayers.size === 0 ? "var(--session-ink-hairline)" : "var(--session-sage-muted)"}`,
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
                color: populating || populateLayers.size === 0 ? "var(--session-ink-ghost)" : "var(--session-sage)",
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
          <AdminView />
        </>
      )}
      </>
      )}

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
