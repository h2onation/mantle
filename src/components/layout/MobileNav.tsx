"use client";

export type MobileTab = "session" | "manual" | "guidance" | "settings";

const TABS: MobileTab[] = ["session", "manual", "guidance", "settings"];

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
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
        gap: "12px",
        paddingTop: "14px",
        paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          style={{
            padding: "10px 10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            minWidth: "44px",
            minHeight: "24px",
          }}
        >
          <div
            style={{
              width: activeTab === tab ? "20px" : "5px",
              height: "5px",
              borderRadius: "3px",
              backgroundColor:
                activeTab === tab
                  ? "var(--color-accent)"
                  : "var(--color-text-ghost)",
              transition: "width 0.4s ease, background-color 0.4s ease",
            }}
          />
        </button>
      ))}
    </div>
  );
}
