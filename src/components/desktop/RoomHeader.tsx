"use client";

import type { MobileView } from "@/components/layout/MobileLayout";
import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";

interface RoomHeaderProps {
  activeView: MobileView;
  sessionTitle: string;
  sessionDate: string;
  manualEntryCount: number;
}

// The persistent header over the desktop room. The wordmark lives here
// so the brand survives sidebar collapse; the title is a running header
// that follows the active view, like a book's.
export default function RoomHeader({
  activeView,
  sessionTitle,
  sessionDate,
  manualEntryCount,
}: RoomHeaderProps) {
  let title: string;
  let meta: string;
  switch (activeView) {
    case "manual":
      title = "Your Manual";
      meta = `${manualEntryCount} ${manualEntryCount === 1 ? "entry" : "entries"}`;
      break;
    case "settings":
      title = "Settings";
      meta = "";
      break;
    case "crisis":
      title = "If you need someone now";
      meta = "";
      break;
    case "home":
      // The Home view carries its own greeting + date; keep the header quiet.
      title = "";
      meta = "";
      break;
    default:
      title = sessionTitle;
      meta = `Session · ${sessionDate}`;
  }

  return (
    <header
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: 18,
        height: 56,
        padding: "0 26px",
        borderBottom: "1px solid var(--session-ink-hairline)",
        zIndex: 10,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontSize: "21px",
          fontWeight: 400,
          letterSpacing: "-0.3px",
          lineHeight: 1,
          color: "var(--session-ink)",
          whiteSpace: "nowrap",
        }}
      >
        mywalnut
        <span style={{ color: "var(--session-walnut)" }}>.</span>
      </p>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "center",
          padding: "0 12px",
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "16px",
          color: "var(--session-ink-mid)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: "var(--session-ink-faded)",
          whiteSpace: "nowrap",
        }}
      >
        {meta && <span>{meta}</span>}
        <BetaFeedbackButton variant="inline" />
      </span>
    </header>
  );
}
