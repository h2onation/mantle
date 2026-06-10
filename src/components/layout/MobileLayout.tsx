"use client";

import DesktopVitrine from "./DesktopVitrine";
import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";

export type MobileView = "session" | "manual" | "settings" | "crisis";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  crisisContent: React.ReactNode;
  activeView: MobileView;
  // When true and the active view is "session", swap the panel gradient
  // from --session-bg-chat to --session-bg-checkpoint. The checkpoint
  // stack centers walnut warmth at the top instead of the bottom-right,
  // matching the demo's "3 · Checkpoint" surface.
  hasActiveCheckpoint?: boolean;
  // Overlays that should be scoped to the phone frame on desktop (e.g.
  // SessionDrawer). Rendered as a sibling of the view panels inside the
  // DesktopVitrine so position: absolute children are clipped by the
  // phone frame's rounded corners and overflow: hidden.
  overlay?: React.ReactNode;
}

// Shared with DesktopShell so both shells light the room identically.
export function gradientFor(view: MobileView, hasActiveCheckpoint?: boolean): string {
  if (view === "session") {
    return hasActiveCheckpoint
      ? "var(--session-bg-checkpoint)"
      : "var(--session-bg-chat)";
  }
  if (view === "manual" || view === "settings" || view === "crisis") {
    return "var(--session-bg-manual)";
  }
  return "var(--session-bg-chat)";
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  settingsContent,
  crisisContent,
  activeView,
  hasActiveCheckpoint,
  overlay,
}: MobileLayoutProps) {
  return (
    <DesktopVitrine>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "var(--session-linen)",
        }}
      >
        {([
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
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
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
        {overlay}
      </div>
    </DesktopVitrine>
  );
}
