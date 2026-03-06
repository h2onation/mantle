"use client";

export type MobileTab = "session" | "manual" | "explore" | "settings";

const TABS: { id: MobileTab; label: string }[] = [
  { id: "session", label: "Session" },
  { id: "manual", label: "Manual" },
  { id: "explore", label: "Explore" },
  { id: "settings", label: "Settings" },
];

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-evenly",
        paddingTop: "10px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: "var(--session-linen)",
        zIndex: 100,
      }}
    >
      {TABS.map(({ id, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              padding: "0 0 3px",
              background: "none",
              border: "none",
              borderBottom: isActive
                ? "1px solid var(--session-ink-mid)"
                : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "var(--font-serif)",
              fontSize: "10px",
              fontWeight: 400,
              letterSpacing: "4px",
              textTransform: "uppercase",
              lineHeight: 1,
              color: isActive
                ? "var(--session-ink-mid)"
                : "var(--session-ink-ghost)",
              transition: "all 0.25s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
