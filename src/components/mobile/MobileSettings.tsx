"use client";

import { useState, useCallback, useEffect } from "react";
import { useAudio } from "@/components/providers/AudioProvider";
import MobileSoundSelector from "./MobileSoundSelector";

interface MobileSettingsProps {
  userEmail: string;
  sessionCount: number;
  onSimulationEvent?: (type: "start" | "turn" | "checkpoint", conversationId: string) => void;
}

const SOUND_LABELS: Record<string, string> = {
  water: "Water",
  piano: "Piano",
  birds: "Birdsong",
};

export default function MobileSettings({
  userEmail,
  sessionCount,
  onSimulationEvent,
}: MobileSettingsProps) {
  const [theme, setTheme] = useState<"sage" | "ember">("sage");

  useEffect(() => {
    const saved = localStorage.getItem("mantle_theme") as "sage" | "ember" | null;
    if (saved) setTheme(saved);
  }, []);
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("Run a fake conversation");
  const { isPlaying, currentTrack } = useAudio();

  function handleThemeToggle() {
    const next = theme === "sage" ? "ember" : "sage";
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

  async function handleDelete() {
    await fetch("/api/dev-reset", { method: "POST" });
    localStorage.clear();
    window.location.reload();
  }

  async function handleSimulate() {
    setSimulating(true);
    setSimStatus("Starting simulation...");

    let simConversationId: string | null = null;

    try {
      const res = await fetch("/api/dev-simulate", { method: "POST" });
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
            } else if (event.type === "checkpoint") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Checkpoint at turn ${event.turn}!`);

              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("checkpoint", simConversationId);
              }
            } else if (event.type === "complete") {
              setSimStatus(
                `Done — ${event.totalTurns} turns${event.totalTurns >= 10 ? ", no checkpoint detected" : ""}`
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
              backgroundColor: theme === "sage" ? "#8BA888" : "#D4A574",
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
            {theme === "sage" ? "Sage" : "Ember"}
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
        <button
          onClick={handleSimulate}
          disabled={simulating}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            cursor: simulating ? "default" : "pointer",
            textAlign: "left",
            padding: 0,
            opacity: simulating ? 0.5 : 1,
            WebkitTapHighlightColor: "transparent",
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
            {simulating ? "Simulating..." : "Simulate user"}
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
            {simStatus}
          </p>
        </button>
      </div>

      {/* Delete everything */}
      <button
        onClick={() => setShowDeleteConfirm(true)}
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
          Delete everything
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

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
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
              This will permanently delete your manual, all conversations, and
              all data. Are you sure?
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
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
                onClick={handleDelete}
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
