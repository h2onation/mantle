"use client";

interface MobileGuidanceProps {
  confirmedCount: number;
}

export default function MobileGuidance({ confirmedCount }: MobileGuidanceProps) {
  const unlocked = confirmedCount >= 5;

  if (unlocked) {
    return (
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: "40px 24px 56px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            color: "var(--color-text-ghost)",
            letterSpacing: "3px",
            textTransform: "uppercase",
            margin: "0 0 32px 0",
          }}
        >
          GUIDANCE
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--color-text-dim)",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          Guidance is available. This feature is coming soon.
        </p>
      </div>
    );
  }

  // Locked state
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        position: "relative",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, var(--color-accent-ghost) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "20px",
            color: "var(--color-text)",
            textAlign: "center",
            lineHeight: 1.7,
            letterSpacing: "-0.2px",
            margin: 0,
          }}
        >
          Guidance becomes available as your manual develops.
        </p>

        {/* Progress bars */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: "24px",
                  height: "2px",
                  borderRadius: "1px",
                  backgroundColor:
                    i < confirmedCount
                      ? "var(--color-accent)"
                      : "var(--color-text-ghost)",
                  opacity: i < confirmedCount ? 0.6 : 0.2,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-text-ghost)",
              letterSpacing: "2px",
            }}
          >
            {confirmedCount} OF 5
          </span>
        </div>
      </div>
    </div>
  );
}
