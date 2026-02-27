"use client";

import { useKeyboardOpen } from "@/lib/hooks/useKeyboardOpen";
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
  const keyboardOpen = useKeyboardOpen();

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
            bottom: keyboardOpen
              ? "0px"
              : "calc(68px + env(safe-area-inset-bottom, 0px))",
            overflowX: "hidden",
            display: activeTab === tab ? "block" : "none",
            transition: "bottom 0.25s ease",
          }}
        >
          {content}
        </div>
      ))}
      <MobileNav activeTab={activeTab} onTabChange={onTabChange} hidden={keyboardOpen} />
    </div>
  );
}
