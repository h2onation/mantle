"use client";

import TopBar from "@/components/shared/TopBar";

interface MobileCrisisProps {
  onNavigateToSession?: () => void;
  onOpenDrawer?: () => void;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
}

// Dedicated Crisis Support surface, reached from the drawer's footer
// row. Kept deliberately quiet — a serif intro line, two link cards,
// the "free + 24/7" reassurance. The drawer is the entry point; the
// TopBar back chevron returns to chat.
export default function MobileCrisis({ onNavigateToSession, onOpenDrawer, showTopBar = true }: MobileCrisisProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showTopBar && <TopBar onBack={onNavigateToSession} onMenu={onOpenDrawer} />}

      <div
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 22px calc(40px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-error-text)",
          }}
        >
          Crisis Support
        </p>

        <h1
          style={{
            margin: "10px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 32,
            fontWeight: 400,
            color: "var(--session-ink)",
            letterSpacing: "-0.4px",
            lineHeight: 1.15,
          }}
        >
          If you need someone now
          <span style={{ color: "var(--session-walnut)" }}>.</span>
        </h1>

        <p
          style={{
            margin: "14px 0 32px",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 16,
            color: "var(--session-ink-soft)",
            lineHeight: 1.55,
            letterSpacing: "-0.05px",
          }}
        >
          These lines are staffed 24/7 by trained counselors. Free and
          confidential. Jove is not a substitute for crisis support.
        </p>

        <CrisisCard
          eyebrow="988 Suicide & Crisis Lifeline"
          href="tel:988"
          label="Call or text 988"
        />
        <CrisisCard
          eyebrow="Crisis Text Line"
          href="sms:741741?body=HOME"
          label="Text HOME to 741741"
        />

        <p
          style={{
            margin: "28px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          Free · Confidential · Available 24/7
        </p>
      </div>
    </div>
  );
}

function CrisisCard({
  eyebrow,
  href,
  label,
}: {
  eyebrow: string;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        padding: "18px 18px",
        marginBottom: 12,
        background: "var(--session-walnut-surface-soft)",
        border: "1px solid var(--session-error-border-soft)",
        borderRadius: 12,
        boxShadow: "var(--session-card-shadow, none)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: "var(--session-walnut-meta)",
        }}
      >
        {eyebrow}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 18,
          color: "var(--session-error-text)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </p>
    </a>
  );
}
