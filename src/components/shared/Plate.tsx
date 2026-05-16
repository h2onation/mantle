"use client";

interface PlateProps {
  eyebrow?: string;
  heading?: string;
  children: React.ReactNode;
}

export default function Plate({ eyebrow, heading, children }: PlateProps) {
  return (
    <div
      style={{
        padding: "20px 22px 22px",
        borderRadius: "18px",
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-bubble-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "var(--session-plate-shadow)",
      }}
    >
      {eyebrow && (
        <p
          style={{
            margin: 0,
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-strong)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1,
          }}
        >
          {eyebrow}
        </p>
      )}
      {heading && (
        <h3
          style={{
            margin: eyebrow ? "12px 0 0" : 0,
            fontFamily: "var(--font-spectral), var(--font-persona), serif",
            fontSize: "19px",
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: "-0.15px",
            color: "var(--session-ink)",
          }}
        >
          {heading}
          <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
        </h3>
      )}
      <div
        style={{
          marginTop: heading || eyebrow ? "14px" : 0,
          fontFamily: "var(--font-spectral), var(--font-persona), serif",
          fontSize: "14.5px",
          lineHeight: 1.6,
          letterSpacing: "-0.03px",
          color: "var(--session-ink)",
          textWrap: "pretty" as React.CSSProperties["textWrap"],
        }}
      >
        {children}
      </div>
    </div>
  );
}
