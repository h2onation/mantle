"use client";

// ACCESSIBILITY DEBT: Tab tap targets are below Apple HIG's 44×44 minimum.
// Button padding is "0 0 3px" + 11px label gives a ~14px tall target. This
// predates Design 2.0 and was not worsened by this pass. Scheduled for a
// dedicated accessibility pass — see decisions.md ADR-033.

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
        paddingTop: "10px",
        paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        background: "var(--session-linen)",
        // Structural floor boundary — separates the writing/reading zone from
        // the navigation frame. Keeps the nav recessive so the feed and input
        // can claim priority on the linen surface above.
        borderTop: "1px solid var(--session-ink-hairline)",
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
              // Active state uses --session-ink (darkest) rather than --ink-soft.
              // This creates strong active/inactive contrast while keeping
              // inactive at --ink-mid for accessibility on the linen surface.
              // See decisions.md ADR-033 for the reasoning.
              borderBottom: isActive
                ? "1px solid var(--session-ink)"
                : "1px solid transparent",
              cursor: "pointer",
              // Nav tabs are structural, not decorative. Mono unifies with
              // other structural labels in the system (JOVE, TEXT, layer
              // names) and reads more restrained at small sizes.
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              lineHeight: 1,
              color: isActive
                ? "var(--session-ink)"
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
