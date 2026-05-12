"use client";

interface BubbleProps {
  speaker: "jove" | "user";
  children: React.ReactNode;
  showLabel?: boolean;
}

const JOVE_STYLE: React.CSSProperties = {
  maxWidth: "92%",
  marginLeft: 0,
  marginRight: "auto",
  background: "var(--session-walnut-surface)",
  border: "1px solid rgba(170,120,82,0.20)",
  borderRadius: "16px",
  borderTopLeftRadius: "5px",
};

const USER_STYLE: React.CSSProperties = {
  maxWidth: "88%",
  marginLeft: "auto",
  marginRight: 0,
  background: "rgba(72,80,98,0.30)",
  border: "1px solid rgba(170,180,200,0.12)",
  borderRadius: "16px",
  borderTopRightRadius: "5px",
};

export default function Bubble({ speaker, children, showLabel = false }: BubbleProps) {
  const isJove = speaker === "jove";
  return (
    <div
      style={{
        ...(isJove ? JOVE_STYLE : USER_STYLE),
        padding: "12px 20px 20px",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {isJove && showLabel && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "10px",
            letterSpacing: "2.2px",
            textTransform: "uppercase",
            color: "var(--session-persona)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1,
          }}
        >
          JOVE
        </p>
      )}
      <div
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral), var(--font-persona), serif",
          fontSize: "17px",
          lineHeight: 1.62,
          letterSpacing: "-0.05px",
          color: isJove ? "var(--session-ink)" : "rgba(245,243,238,0.92)",
          textWrap: "pretty" as React.CSSProperties["textWrap"],
        }}
      >
        {children}
      </div>
    </div>
  );
}
