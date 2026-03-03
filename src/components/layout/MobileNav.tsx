"use client";

import { IconSession, IconManual, IconGuidance, IconSettings } from "@/components/icons/NavIcons";

export type MobileTab = "session" | "manual" | "guidance" | "settings";

const TABS: MobileTab[] = ["session", "manual", "guidance", "settings"];

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  hidden?: boolean;
}

function TabIcon({ tab, color }: { tab: MobileTab; color: string }) {
  switch (tab) {
    case "session":
      return <IconSession color={color} />;
    case "manual":
      return <IconManual color={color} />;
    case "guidance":
      return <IconGuidance color={color} />;
    case "settings":
      return <IconSettings color={color} />;
  }
}

export default function MobileNav({ activeTab, onTabChange, hidden = false }: MobileNavProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--color-void)",
        borderTop: "1px solid var(--color-divider)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: "20px",
        paddingTop: "10px",
        paddingLeft: "clamp(0px, (100vw - 430px) * 999, 20px)",
        paddingRight: "clamp(0px, (100vw - 430px) * 999, 20px)",
        paddingBottom: "clamp(calc(14px + env(safe-area-inset-bottom, 0px)), (100vw - 430px) * 999, 20px)",
        zIndex: 100,
        transform: hidden ? "translateY(100%)" : "translateY(0)",
        transition: "transform 0.25s ease",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        const color = isActive ? "var(--color-accent)" : "var(--color-text-ghost)";
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              padding: "4px 8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              WebkitTapHighlightColor: "transparent",
              minWidth: "56px",
              minHeight: "44px",
              color,
              transition: "color 0.4s ease",
            }}
          >
            <TabIcon tab={tab} color={color} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "7px",
                letterSpacing: "2.5px",
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              {tab}
            </span>
          </button>
        );
      })}
    </div>
  );
}
