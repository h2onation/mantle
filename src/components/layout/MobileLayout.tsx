"use client";

import MobileNav, { type MobileTab } from "./MobileNav";
import DesktopVitrine from "./DesktopVitrine";
import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";

interface MobileLayoutProps {
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileLayout({
  sessionContent,
  manualContent,
  settingsContent,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
  return (
    <DesktopVitrine>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "var(--session-linen)",
        }}
      >
        {([
          ["session", sessionContent, "session-panel"],
          ["manual", manualContent, "manual-panel"],
          ["settings", settingsContent, "settings-panel"],
        ] as const).map(([tab, content, panelId]) => (
          <div
            key={tab}
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${panelId}-tab`}
            hidden={activeTab !== tab}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: "0px",
              overflowX: "hidden",
              display: activeTab === tab ? "block" : "none",
              background: "var(--session-linen)",
              // Paper surface: noise on top, subtle corner vignette beneath.
              // The vignette darkens ~4% toward the far corners — threshold
              // of perception, enough to feel (a page naturally shadows
              // toward its edges) without reading as a "texture effect."
              // Background-image layers: topmost listed first, so noise
              // sits over the vignette.
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\"), radial-gradient(ellipse at center, transparent 50%, rgba(26, 22, 20, 0.04) 100%)",
              backgroundSize: "256px 256px, 100% 100%",
              backgroundRepeat: "repeat, no-repeat",
            }}
          >
            {content}
          </div>
        ))}
        <MobileNav activeTab={activeTab} onTabChange={onTabChange} />
        <BetaFeedbackButton />
      </div>
    </DesktopVitrine>
  );
}
