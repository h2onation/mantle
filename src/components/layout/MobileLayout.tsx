"use client";

import { useState } from "react";
import MobileNav, { type MobileTab } from "./MobileNav";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  guidanceContent: React.ReactNode;
  settingsContent: React.ReactNode;
  isBlurred?: boolean;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  guidanceContent,
  settingsContent,
  isBlurred,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("session");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-void)",
        filter: isBlurred ? "blur(12px)" : undefined,
        pointerEvents: isBlurred ? "none" : undefined,
        transition: "filter 1.2s ease-out",
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
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
            overflow: "hidden",
            display: activeTab === tab ? "block" : "none",
          }}
        >
          {content}
        </div>
      ))}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
