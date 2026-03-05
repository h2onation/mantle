"use client";

interface EntryScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function EntryScreen({ onGetStarted, onLogin }: EntryScreenProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Wordmark (top center) */}
      <div
        style={{
          padding: "16px 0",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "15px",
          color: "var(--session-ink-faded)",
          paddingLeft: 15,
        }}
      >
        MANTLE
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 56px" }}>
        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            color: "var(--session-ink)",
            margin: "0 0 14px 0",
          }}
        >
          You understand yourself in fragments.
        </h1>

        {/* Subhead */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--session-ink-mid)",
            margin: "0 0 44px 0",
          }}
        >
          That&apos;s why the same patterns keep running.
        </p>

        {/* Get started button */}
        <button
          onClick={onGetStarted}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-cream)",
            backgroundColor: "var(--session-sage)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Get started
        </button>

        {/* Log in button */}
        <button
          onClick={onLogin}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--session-ink-mid)",
            backgroundColor: "transparent",
            border: "1px solid var(--session-ink-whisper)",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Log in
        </button>
      </div>
    </div>
  );
}
