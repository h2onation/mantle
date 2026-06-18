"use client";

import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";
import BottomNav from "@/components/shared/BottomNav";

export type MobileView = "session" | "manual" | "settings" | "crisis" | "home";

interface MobileLayoutProps {
  homeContent: React.ReactNode;
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  crisisContent: React.ReactNode;
  activeView: MobileView;
  onNavigate: (view: MobileView) => void;
  // When true and the active view is "session", swap the panel gradient
  // from --session-bg-chat to --session-bg-checkpoint. The checkpoint
  // stack centers warmth at the top instead of the bottom-right.
  hasActiveCheckpoint?: boolean;
}

// Shared with DesktopShell so both shells light the room identically.
export function gradientFor(view: MobileView, hasActiveCheckpoint?: boolean): string {
  if (view === "session") {
    return hasActiveCheckpoint
      ? "var(--session-bg-checkpoint)"
      : "var(--session-bg-chat)";
  }
  if (view === "home") {
    return "var(--session-bg-welcome)";
  }
  if (view === "manual" || view === "settings" || view === "crisis") {
    return "var(--session-bg-manual)";
  }
  return "var(--session-bg-chat)";
}

export default function MobileLayout({
  homeContent,
  sessionContent,
  manualContent,
  settingsContent,
  crisisContent,
  activeView,
  onNavigate,
  hasActiveCheckpoint,
}: MobileLayoutProps) {
  return (
    // The authed app as a centered phone-width column. At <=430px it fills the
    // viewport (phone, unchanged); at mid-width (431-1029px) it sits centered
    // on the warm ground with calm margins — no decorative frame, no paratext.
    // Login keeps the full DesktopVitrine; this is the signed-in app only.
    // (ADR-048 Phase D — replaced the phone-frame vitrine for authed users.)
    <div
      style={{
        width: "100%",
        height: "100dvh",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "var(--session-linen)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          height: "100%",
          overflow: "hidden",
          boxShadow: "var(--session-card-shadow, none)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--session-linen)",
          }}
        >
          {/* View panels fill the space above the persistent bottom nav. */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {([
              ["home", homeContent, "home-panel"],
              ["session", sessionContent, "session-panel"],
              ["manual", manualContent, "manual-panel"],
              ["settings", settingsContent, "settings-panel"],
              ["crisis", crisisContent, "crisis-panel"],
            ] as const).map(([view, content, panelId]) => (
              <div
                key={view}
                id={panelId}
                hidden={activeView !== view}
                style={{
                  position: "absolute",
                  inset: 0,
                  overflowX: "hidden",
                  display: activeView === view ? "block" : "none",
                  backgroundColor: "var(--session-linen)",
                  backgroundImage: gradientFor(view, hasActiveCheckpoint),
                  transition: "background-image 0.3s ease",
                }}
              >
                {content}
              </div>
            ))}
            {activeView === "session" && <BetaFeedbackButton />}
          </div>

          <BottomNav activeView={activeView} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
