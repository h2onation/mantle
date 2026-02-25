"use client";

import MobileNav, { type MobileTab } from "./MobileNav";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  guidanceContent: React.ReactNode;
  settingsContent: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  guidanceContent,
  settingsContent,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-void)",
      }}
    >
      {([
        ["session", sessionContent],
        ["manual", manualContent],
        ["guidance", guidanceContent],
        ["settings", settingsContent],
      ] as const).map(([tab, content]) => (
        <div
          key={tab}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
            overflow: "hidden",
            display: activeTab === tab ? "block" : "none",
          }}
        >
          {content}
        </div>
      ))}
      <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
