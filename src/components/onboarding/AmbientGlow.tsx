"use client";

export interface GlowConfig {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

interface AmbientGlowProps {
  config: GlowConfig;
}

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export default function AmbientGlow({ config }: AmbientGlowProps) {
  const { x, y, scale, opacity } = config;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Primary glow */}
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: `${380 * scale}px`,
          height: `${380 * scale}px`,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 45% 45%, rgba(91,117,83,${opacity}) 0%, rgba(91,117,83,${opacity * 0.35}) 45%, transparent 72%)`,
          filter: "blur(8px)",
          transform: "translate(-50%, -50%)",
          transition: `left 1s ${EASE}, top 1s ${EASE}, width 1s ${EASE}, height 1s ${EASE}, background 1s ${EASE}, filter 1s ${EASE}`,
        }}
      />

      {/* Secondary warmth */}
      <div
        style={{
          position: "absolute",
          left: `${x + 12}%`,
          top: `${y + 15}%`,
          width: `${220 * scale}px`,
          height: `${260 * scale}px`,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at 55% 40%, rgba(139,157,119,${opacity * 0.5}) 0%, transparent 65%)`,
          filter: "blur(12px)",
          transform: "translate(-50%, -50%)",
          transition: `left 1.2s ${EASE}, top 1.2s ${EASE}, width 1.2s ${EASE}, height 1.2s ${EASE}, background 1.2s ${EASE}, filter 1.2s ${EASE}`,
        }}
      />

      {/* Faint edge */}
      <div
        style={{
          position: "absolute",
          left: `${x - 15}%`,
          top: `${y - 8}%`,
          width: `${160 * scale}px`,
          height: `${160 * scale}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(107,139,99,${opacity * 0.3}) 0%, transparent 55%)`,
          filter: "blur(20px)",
          transform: "translate(-50%, -50%)",
          transition: `left 1.4s ${EASE}, top 1.4s ${EASE}, width 1.4s ${EASE}, height 1.4s ${EASE}, background 1.4s ${EASE}, filter 1.4s ${EASE}`,
        }}
      />

      {/* Grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN_URI,
          backgroundSize: "128px 128px",
          opacity: 0.025,
        }}
      />
    </div>
  );
}
