"use client";

import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import { gradientFor, type MobileView } from "@/components/layout/MobileLayout";
import DesktopSidebar from "./DesktopSidebar";
import RoomHeader from "./RoomHeader";

// The conversation column cap. ~660px of content plus the views' own
// horizontal padding — a 60-70ch measure at body size, which is both
// the editorial norm and the BDA-recommended line length for the
// dyslexic persona. Extra viewport width becomes margin, never longer
// lines.
const CONTENT_MAX_WIDTH = 720;

interface DesktopShellProps {
  activeView: MobileView;
  hasActiveCheckpoint?: boolean;
  homeContent: React.ReactNode;
  sessionContent: React.ReactNode;
  manualContent: React.ReactNode;
  settingsContent: React.ReactNode;
  crisisContent: React.ReactNode;
  sessionTitle: string;
  sessionDate: string;
  scopedLabel?: string | null;
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  manualEntryCount: number;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onNavigateToHome: () => void;
  onNavigateToManual: () => void;
  onNavigateToSettings: () => void;
  onLogout: () => void;
}

// Desktop shell for the authenticated app (≥1030px): persistent
// sidebar + room header + one view at a time. Same activeView state
// and the same four content nodes as MobileLayout — different chrome,
// no new state model. Below the breakpoint MainApp renders
// MobileLayout instead; this component never coexists with it.
export default function DesktopShell({
  activeView,
  hasActiveCheckpoint,
  homeContent,
  sessionContent,
  manualContent,
  settingsContent,
  crisisContent,
  sessionTitle,
  sessionDate,
  scopedLabel,
  conversations,
  activeConversationId,
  manualEntryCount,
  onSelectSession,
  onNewSession,
  onNavigateToHome,
  onNavigateToManual,
  onNavigateToSettings,
  onLogout,
}: DesktopShellProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        backgroundColor: "var(--session-linen)",
      }}
    >
      <DesktopSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeView={activeView}
        manualEntryCount={manualEntryCount}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onNavigateToHome={onNavigateToHome}
        onNavigateToManual={onNavigateToManual}
        onNavigateToSettings={onNavigateToSettings}
        onLogout={onLogout}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <RoomHeader
          activeView={activeView}
          sessionTitle={sessionTitle}
          sessionDate={sessionDate}
          manualEntryCount={manualEntryCount}
          scopedLabel={scopedLabel}
        />

        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {(
            [
              ["home", homeContent],
              ["session", sessionContent],
              ["manual", manualContent],
              ["settings", settingsContent],
              ["crisis", crisisContent],
            ] as const
          ).map(([view, content]) => (
            <div
              key={view}
              hidden={activeView !== view}
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                display: activeView === view ? "block" : "none",
                backgroundColor: "var(--session-linen)",
                backgroundImage: gradientFor(view, hasActiveCheckpoint),
                transition: "background-image 0.3s ease",
              }}
            >
              <div
                style={{
                  height: "100%",
                  maxWidth: CONTENT_MAX_WIDTH,
                  margin: "0 auto",
                }}
              >
                {content}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
