"use client";

import DesktopVitrine from "./DesktopVitrine";

export type MobileView = "session" | "manual" | "settings";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  activeView: MobileView;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  settingsContent,
  activeView,
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
              background: "var(--session-linen)",
            }}
          >
            {content}
          </div>
        ))}
      </div>
    </DesktopVitrine>
  );
}
