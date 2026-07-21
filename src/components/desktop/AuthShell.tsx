"use client";

import { APP_VERSION } from "@/lib/version";
import { BRAND } from "@/lib/brand";

interface AuthShellProps {
  // Returns to the marketing landing — same destination the mobile
  // TopBar back chevron uses.
  onBack: () => void;
  children: React.ReactNode;
}

// Desktop (>=1030px) frame for pre-auth pages: the app's room treatment
// without the sidebar. Same 56px header spec as RoomHeader so crossing
// the login -> app threshold keeps the chrome still and just adds the
// sidebar. Below the breakpoint the caller renders DesktopVitrine
// instead; this component never appears there.
export default function AuthShell({ onBack, children }: AuthShellProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        backgroundColor: "var(--session-linen)",
        backgroundImage: "var(--session-bg-welcome)",
      }}
    >
      <header
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          padding: "0 26px",
          borderBottom: "1px solid var(--session-ink-hairline)",
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
          }}
        >
          {BRAND.name}
          <span style={{ color: "var(--session-walnut)" }}>.</span>
        </p>
        <button
          onClick={onBack}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            color: "var(--session-ink-faded)",
            paddingBottom: 2,
            borderBottom: "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--session-ink)";
            e.currentTarget.style.borderBottomColor = "var(--session-walnut)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--session-ink-faded)";
            e.currentTarget.style.borderBottomColor = "transparent";
          }}
        >
          ‹ {BRAND.domain}
        </button>
      </header>

      {/* The form column. LoginScreen vertically centers its own
          content, so this just constrains the measure. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(440px, 100%)", height: "100%" }}>{children}</div>
      </div>

      <footer
        style={{
          flex: "0 0 auto",
          padding: "16px 26px 22px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: "14.5px",
            lineHeight: 1.5,
            color: "var(--session-ink-mid)",
          }}
        >
          A private manual, written by you and assembled in conversation.
          Nothing enters it unless you confirm.
        </p>
        <p
          style={{
            margin: "9px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color: "var(--session-ink-faded)",
            display: "flex",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span>In closed beta</span>
          <span aria-hidden="true">·</span>
          <span>v{APP_VERSION}</span>
          <span aria-hidden="true">·</span>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
            Privacy
          </a>
          <span aria-hidden="true">·</span>
          <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
            Terms
          </a>
        </p>
      </footer>
    </div>
  );
}
