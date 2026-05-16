"use client";

import { PERSONA_NAME } from "@/lib/persona/config";

interface BubbleProps {
  speaker: "jove" | "user";
  children: React.ReactNode;
  showLabel?: boolean;
}

const JOVE_STYLE: React.CSSProperties = {
  maxWidth: "92%",
  marginLeft: 0,
  marginRight: "auto",
  background: "var(--session-jove-bg)",
  border: "1px solid var(--session-jove-border)",
  borderRadius: "16px",
  borderTopLeftRadius: "5px",
};

const USER_STYLE: React.CSSProperties = {
  maxWidth: "88%",
  marginLeft: "auto",
  marginRight: 0,
  background: "var(--session-user-bg)",
  border: "1px solid var(--session-user-border)",
  borderRadius: "16px",
  borderTopRightRadius: "5px",
};

export default function Bubble({ speaker, children, showLabel = false }: BubbleProps) {
  const isJove = speaker === "jove";
  return (
    <div
      style={{
        ...(isJove ? JOVE_STYLE : USER_STYLE),
        padding: "12px 20px 14px",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "var(--session-bubble-shadow)",
      }}
    >
      {isJove && showLabel && (
        <p
          style={{
            margin: "0 0 6px",
            fontSize: "9.5px",
            letterSpacing: "2.2px",
            textTransform: "uppercase",
            color: "var(--session-persona)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1,
          }}
        >
          {PERSONA_NAME.toUpperCase()}
        </p>
      )}
      <div
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral), var(--font-persona), serif",
          fontSize: "14.5px",
          lineHeight: 1.6,
          letterSpacing: "-0.03px",
          color: isJove ? "var(--session-ink)" : "var(--session-ink-user-text)",
          textWrap: "pretty" as React.CSSProperties["textWrap"],
        }}
      >
        {children}
      </div>
    </div>
  );
}
