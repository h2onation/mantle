"use client";

export default function MobileGuidance() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px calc(68px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "16px",
          color: "var(--session-ink-ghost)",
          textAlign: "center",
          lineHeight: 1.7,
          letterSpacing: "-0.2px",
          margin: 0,
        }}
      >
        Coming soon
      </p>
    </div>
  );
}
