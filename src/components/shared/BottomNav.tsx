"use client";

import type { MobileView } from "@/components/layout/MobileLayout";

interface BottomNavProps {
  activeView: MobileView;
  onNavigate: (view: MobileView) => void;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// "Talk" is a label on the existing `session` view, and "You" a label on
// `settings` — no new enum values for those. Only `home` is new.
const TABS: { label: string; view: MobileView; icon: React.ReactNode }[] = [
  {
    label: "Home",
    view: "home",
    icon: (
      <Icon>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 9.5V20h14V9.5" />
      </Icon>
    ),
  },
  {
    label: "Manual",
    view: "manual",
    icon: (
      <Icon>
        <path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1V4z" />
        <path d="M6 17.5h12" />
      </Icon>
    ),
  },
  {
    label: "Talk",
    view: "session",
    icon: (
      <Icon>
        <path d="M4 5h16v10H9l-4 3.5V15H4V5z" />
      </Icon>
    ),
  },
  {
    label: "You",
    view: "settings",
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      </Icon>
    ),
  },
];

// Persistent bottom navigation. Replaces the slide-out drawer as the
// primary way around the app. 56px tap targets (well clear of the 44px
// floor). Crisis is not a tab — it lives under "You" (Settings).
export default function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      style={{
        flexShrink: 0,
        display: "flex",
        borderTop: "1px solid var(--session-hair)",
        background: "var(--session-cream-bright)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.view === activeView;
        return (
          <button
            key={tab.label}
            onClick={() => onNavigate(tab.view)}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
            style={{
              all: "unset",
              flex: 1,
              minHeight: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: "pointer",
              color: active
                ? "var(--session-walnut)"
                : "var(--session-ink-faded)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {tab.icon}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
