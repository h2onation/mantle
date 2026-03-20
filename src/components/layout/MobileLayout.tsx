"use client";

import MobileNav, { type MobileTab } from "./MobileNav";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  exploreContent: React.ReactNode;
  settingsContent: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  exploreContent,
  settingsContent,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "var(--session-parchment)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          height: "100%",
          maxHeight: 932,
          borderRadius: "clamp(0px, (100vw - 430px) * 999, 40px)",
          border: "clamp(0px, (100vw - 430px) * 999, 1px) solid rgba(26, 22, 20, 0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--session-linen)",
          }}
        >
          {([
            ["session", sessionContent],
            ["manual", manualContent],
            ["explore", exploreContent],
            ["settings", settingsContent],
          ] as const).map(([tab, content]) => (
            <div
              key={tab}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: "0px",
                overflowX: "hidden",
                display: activeTab === tab ? "block" : "none",
                background: "var(--session-linen)",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
                backgroundSize: "256px 256px",
              }}
            >
              {content}
            </div>
          ))}
          <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
        </div>
      </div>
    </div>
  );
}
