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
        background: "var(--session-cream)",
        // Structural floor boundary — separates the writing/reading zone from
        // the navigation frame. The nav is one step lifted from the linen
        // ground (--cream is a half-step warmer/lighter than --linen) so it
        // reads as a quiet platform under the chat, not a flat slab.
        // Especially important in dark mode where a flat --linen nav would
        // contrast as "true black" against the chat's vignette edges.
        borderTop: "1px solid var(--session-hair-soft)",
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
              // SG nav: active state is a 3px sage dot below mono caps —
              // the only "you are here" cue, and the only place sage
              // appears in the bottom bar (sage is the "one thing per
              // screen" accent). Inactive labels stay at --ink-mid;
              // active label lifts to --ink. No underline on either,
              // since the dot carries the role.
              padding: "0 0 8px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              lineHeight: 1,
              color: isActive
                ? "var(--session-ink)"
                : "var(--session-ink-mid)",
              transition: "color 0.25s ease",
              WebkitTapHighlightColor: "transparent",
              position: "relative",
            }}
          >
            {label}
            {isActive && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  transform: "translateX(-50%)",
                  width: "3px",
                  height: "3px",
                  borderRadius: "50%",
                  background: "var(--session-persona)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
