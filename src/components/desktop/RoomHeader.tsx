"use client";

import type { MobileView } from "@/components/layout/MobileLayout";
import type { ReflectionSurface } from "@/lib/hooks/useReflection";
import BetaFeedbackButton from "@/components/shared/BetaFeedbackButton";
import { BRAND } from "@/lib/brand";
import ReflectionHeader from "@/components/mobile/ReflectionHeader";

interface RoomHeaderProps {
  activeView: MobileView;
  sessionTitle: string;
  sessionDate: string;
  manualEntryCount: number;
  // When set on the session view, the header center shows the scoped
  // "Going deeper · {layer}" context. The in-body bar that MobileSession
  // would otherwise render is suppressed on desktop, so this is its home.
  scopedLabel?: string | null;
  // The reflection surface. On the session view the header carries the same
  // deep-field treatment as the mobile ReflectionHeader — the field colours at
  // ready, the meter is the base rule, and the message-you-clear blooms below.
  reflection: ReflectionSurface;
}

// The persistent header over the desktop room. The wordmark lives here so the
// brand survives sidebar collapse; the title is a running header that follows
// the active view, like a book's. On the session view it doubles as the
// reflection surface (2026-07-03) — wrapped in the shared ReflectionHeader so
// desktop and mobile read identically: the build pill hangs from the bar in
// both (the old desktop-only "Build reflection" text button was removed
// 2026-07-07 when the pill became the one affordance).
export default function RoomHeader({
  activeView,
  sessionDate,
  manualEntryCount,
  scopedLabel = null,
  reflection,
}: RoomHeaderProps) {
  const isScopedSession = activeView === "session" && !!scopedLabel;
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
      // Session view: the running title is removed; the centered wordmark stands alone.
      title = "";
      meta = `Session · ${sessionDate}`;
  }

  const reflectionActive = activeView === "session" && reflection.meterVisible;

  const headerRow = (
    <header
      style={{
        position: "relative",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        height: 56,
        padding: "0 26px",
        borderBottom: "1px solid var(--session-ink-hairline)",
        zIndex: 10,
      }}
    >
      {/* Left: the running title for the active view (empty on the session view). */}
      <span
        style={{
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {isScopedSession ? (
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
                flexShrink: 0,
              }}
            >
              Going deeper
            </span>
            <span aria-hidden="true" style={{ color: "var(--session-ink-faded)" }}>
              ·
            </span>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "16px",
                color: "var(--session-ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {scopedLabel}
            </span>
          </>
        ) : title ? (
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "16px",
              color: "var(--session-ink-mid)",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
        ) : null}
      </span>

      {/* Center: the wordmark, absolutely centered so right-side meta never shifts it. */}
      <p
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
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
        {BRAND.name}
        <span style={{ color: "var(--session-walnut)" }}>.</span>
      </p>

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

  // Non-session views (or the gate off) render the plain header unchanged.
  if (!reflectionActive) return headerRow;

  return (
    <ReflectionHeader
      meterVisible={reflection.meterVisible}
      fill={reflection.fill}
      ready={reflection.ready}
      composing={reflection.composing}
      firstTime={reflection.firstTime}
      onBuild={reflection.onBuild}
    >
      {headerRow}
    </ReflectionHeader>
  );
}
