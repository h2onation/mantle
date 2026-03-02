"use client";

import { useState, useCallback, useEffect } from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import MobileSoundSelector from "./MobileSoundSelector";

interface MobileSettingsProps {
  userEmail: string;
  sessionCount: number;
  voiceAutoSend: boolean;
  onVoiceAutoSendChange: (value: boolean) => void;
  onSimulationEvent?: (type: "start" | "turn" | "checkpoint", conversationId: string) => void;
  onPopulateComplete?: () => void;
}

const SOUND_LABELS: Record<string, string> = {
  water: "Water",
  piano: "Piano",
  birds: "Birdsong",
};

export default function MobileSettings({
  userEmail,
  sessionCount,
  voiceAutoSend,
  onVoiceAutoSendChange,
  onSimulationEvent,
  onPopulateComplete,
}: MobileSettingsProps) {
  const THEMES = ["sage", "ember", "depth"] as const;
  type Theme = (typeof THEMES)[number];
  const [theme, setTheme] = useState<Theme>("sage");

  useEffect(() => {
    const saved = localStorage.getItem("mantle_theme") as Theme | null;
    if (saved && THEMES.includes(saved)) setTheme(saved);
  }, []);
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("Run a fake conversation");
  const [simCheckpoints, setSimCheckpoints] = useState(1);
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [populating, setPopulating] = useState(false);
  const { isPlaying, currentTrack } = useAudio();

  const THEME_COLORS: Record<Theme, string> = {
    sage: "#8BA888",
    ember: "#D4A574",
    depth: "#7B9EC4",
  };

  const THEME_LABELS: Record<Theme, string> = {
    sage: "Sage",
    ember: "Ember",
    depth: "Depth",
  };

  function handleThemeToggle() {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("mantle_theme", next);
  }

  const handleCloseSoundSelector = useCallback(() => {
    setShowSoundSelector(false);
  }, []);

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
              // Switch to session tab immediately
              simConversationId = event.conversationId;
              if (onSimulationEvent) {
                onSimulationEvent("start", event.conversationId);
              }
            } else if (event.type === "turn") {
              setSimStatus(`Turn ${event.turn}...`);
            } else if (event.type === "turn_complete") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Turn ${event.turn} complete`);

              // Reload messages to show new turn
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("turn", simConversationId);
              }
            } else if (event.type === "checkpoint_auto_confirmed") {
              setSimStatus(`Checkpoint ${event.checkpointNumber} auto-confirmed (layer ${event.layer})`);
              // Reload to show confirmed checkpoint in chat
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

  const soundLabel =
    isPlaying && currentTrack
      ? SOUND_LABELS[currentTrack] || "On"
      : "Off";

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

      {/* Theme */}
      <button
        onClick={handleThemeToggle}
        style={{
          width: "100%",
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
          background: "none",
          border: "none",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
          borderBottomColor: "var(--color-divider)",
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text)",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Theme
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "3px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: THEME_COLORS[theme],
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--color-text-ghost)",
              letterSpacing: "0.5px",
            }}
          >
            {THEME_LABELS[theme]}
          </span>
        </div>
      </button>

      {/* Sound */}
      <div
        style={{
          position: "relative",
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <button
          onClick={() => setShowSoundSelector(!showSoundSelector)}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-text)",
              letterSpacing: "0.2px",
              margin: 0,
            }}
          >
            Sound
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--color-text-ghost)",
              letterSpacing: "0.5px",
              margin: "3px 0 0 0",
            }}
          >
            {soundLabel}
          </p>
        </button>
        <MobileSoundSelector
          open={showSoundSelector}
          onClose={handleCloseSoundSelector}
        />
      </div>

      {/* Voice auto-send */}
      <button
        onClick={() => onVoiceAutoSendChange(!voiceAutoSend)}
        style={{
          width: "100%",
          padding: "18px 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--color-divider)",
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-text)",
              letterSpacing: "0.2px",
              margin: 0,
            }}
          >
            Voice auto-send
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--color-text-ghost)",
              letterSpacing: "0.5px",
              margin: "3px 0 0 0",
            }}
          >
            {voiceAutoSend ? "Sends after silence" : "Manual review"}
          </p>
        </div>
        {/* Toggle pill */}
        <div
          style={{
            width: "36px",
            height: "20px",
            borderRadius: "10px",
            backgroundColor: voiceAutoSend
              ? "var(--color-accent-dim)"
              : "var(--color-divider)",
            position: "relative",
            transition: "background-color 0.25s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: voiceAutoSend
                ? "var(--color-accent)"
                : "var(--color-text-ghost)",
              position: "absolute",
              top: "2px",
              left: voiceAutoSend ? "18px" : "2px",
              transition: "left 0.25s ease, background-color 0.25s ease",
            }}
          />
        </div>
      </button>

      {/* Account */}
      <div
        style={{
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text)",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Account
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          {userEmail || "—"}
        </p>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          width: "100%",
          padding: "18px 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--color-divider)",
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text)",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Log out
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          {userEmail || "—"}
        </p>
      </button>

      {/* Session history */}
      <div
        style={{
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text)",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Session history
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Export manual */}
      <div
        style={{
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text)",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Export manual
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          PDF or text
        </p>
      </div>

      {/* Simulate user */}
      <div
        style={{
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
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

      {/* Populate manual */}
      <div
        style={{
          padding: "18px 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
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

      {/* Delete user data */}
      <button
        onClick={() => setShowDeleteDataConfirm(true)}
        style={{
          width: "100%",
          padding: "18px 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--color-divider)",
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "#B5564D",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Delete user data
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          Removes manual and conversations
        </p>
      </button>

      {/* Delete account */}
      <button
        onClick={() => setShowDeleteAccountConfirm(true)}
        style={{
          width: "100%",
          padding: "18px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "#B5564D",
            letterSpacing: "0.2px",
            margin: 0,
          }}
        >
          Delete account
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "0.5px",
            margin: "3px 0 0 0",
          }}
        >
          Cannot be undone
        </p>
      </button>

      {/* Delete data confirmation overlay */}
      {showDeleteDataConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "320px",
              width: "100%",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "var(--color-text)",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
              }}
            >
              This will delete your manual and all conversations. Your account
              will remain.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowDeleteDataConfirm(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-divider)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#B5564D",
                  backgroundColor: "transparent",
                  border: "1px solid #B5564D",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Delete data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation overlay */}
      {showDeleteAccountConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "320px",
              width: "100%",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "var(--color-text)",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
              }}
            >
              This will permanently delete your account and all data. This
              cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowDeleteAccountConfirm(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-divider)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#B5564D",
                  backgroundColor: "transparent",
                  border: "1px solid #B5564D",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
