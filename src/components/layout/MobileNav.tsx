"use client";

export type MobileTab = "session" | "manual" | "settings";

const TABS: { id: MobileTab; label: string; panelId: string }[] = [
  { id: "session", label: "Session", panelId: "session-panel" },
  { id: "manual", label: "Manual", panelId: "manual-panel" },
  { id: "settings", label: "Settings", panelId: "settings-panel" },
];

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Main navigation"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-evenly",
        paddingTop: "14px",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        background: "var(--session-linen)",
        zIndex: 100,
      }}
    >
      {TABS.map(({ id, label, panelId }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(id)}
            style={{
              padding: "0 0 3px",
              background: "none",
              border: "none",
              borderBottom: isActive
                ? "1px solid var(--session-ink-soft)"
                : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "var(--font-serif)",
              fontSize: "var(--size-meta)",
              fontWeight: 400,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              lineHeight: 1,
              color: isActive
                ? "var(--session-ink-soft)"
                : "var(--session-ink-mid)",
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
