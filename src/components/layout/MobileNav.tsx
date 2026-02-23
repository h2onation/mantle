"use client";

export type MobileTab = "session" | "manual" | "guidance" | "settings";

const TABS: MobileTab[] = ["session", "manual", "guidance", "settings"];

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

function TabIcon({ tab }: { tab: MobileTab }) {
  const shared = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
  };

  switch (tab) {
    case "session":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="2" x2="8" y2="6.5" {...shared} />
          <line x1="8" y1="9.5" x2="8" y2="14" {...shared} />
        </svg>
      );
    case "manual":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="5" y1="4" x2="11" y2="4" {...shared} />
          <line x1="4" y1="8" x2="12" y2="8" {...shared} />
          <line x1="3" y1="12" x2="13" y2="12" {...shared} />
        </svg>
      );
    case "guidance":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="3" x2="5" y2="13" {...shared} />
          <line x1="8" y1="3" x2="11" y2="13" {...shared} />
        </svg>
      );
    case "settings":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      );
  }
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <div
      style={{
        position: "fixed",
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
        paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100,
      }}
    >
      {TABS.map((tab) => (
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
            color:
              activeTab === tab
                ? "var(--color-accent)"
                : "var(--color-text-ghost)",
            transition: "color 0.4s ease",
          }}
        >
          <TabIcon tab={tab} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "1.5px",
              lineHeight: 1,
            }}
          >
            {tab}
          </span>
        </button>
      ))}
    </div>
  );
}
