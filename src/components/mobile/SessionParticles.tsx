"use client";

import React, { useMemo } from "react";

interface SessionParticlesProps {
  messageCount: number;
  converge: boolean;
}

const DRIFT_ANIMATIONS = [
  "particleDrift1",
  "particleDrift2",
  "particleDrift3",
  "particleDrift4",
];

// Pre-defined particle positions and properties (16 particles max)
const PARTICLE_CONFIGS = [
  { x: 12, y: 15, size: 3, drift: 0, duration: 10, delay: 0, threshold: 1 },
  { x: 78, y: 25, size: 4, drift: 1, duration: 12, delay: 1.2, threshold: 1 },
  { x: 45, y: 40, size: 3, drift: 2, duration: 9, delay: 0.5, threshold: 2 },
  { x: 88, y: 55, size: 5, drift: 3, duration: 14, delay: 2.1, threshold: 3 },
  { x: 22, y: 65, size: 3, drift: 0, duration: 11, delay: 0.8, threshold: 3 },
  { x: 65, y: 10, size: 4, drift: 1, duration: 13, delay: 1.5, threshold: 4 },
  { x: 35, y: 75, size: 3, drift: 2, duration: 10, delay: 0.3, threshold: 4 },
  { x: 92, y: 35, size: 4, drift: 3, duration: 12, delay: 2.5, threshold: 5 },
  { x: 8, y: 45, size: 3, drift: 0, duration: 15, delay: 1.0, threshold: 6 },
  { x: 55, y: 85, size: 5, drift: 1, duration: 11, delay: 0.7, threshold: 6 },
  { x: 72, y: 60, size: 3, drift: 2, duration: 13, delay: 1.8, threshold: 7 },
  { x: 18, y: 30, size: 4, drift: 3, duration: 9, delay: 2.3, threshold: 7 },
  { x: 42, y: 20, size: 3, drift: 0, duration: 14, delay: 0.4, threshold: 8 },
  { x: 85, y: 80, size: 4, drift: 1, duration: 10, delay: 1.6, threshold: 9 },
  { x: 28, y: 90, size: 3, drift: 2, duration: 12, delay: 2.0, threshold: 9 },
  { x: 60, y: 50, size: 5, drift: 3, duration: 11, delay: 0.9, threshold: 10 },
];

function SessionParticlesInner({ messageCount, converge }: SessionParticlesProps) {
  const visibleParticles = useMemo(() => {
    return PARTICLE_CONFIGS.filter((p) => messageCount >= p.threshold);
  }, [messageCount]);

  // Base opacity scales with message count: 0.03 at few messages → 0.08 at 10+
  const baseOpacity = Math.min(0.08, 0.02 + (messageCount / 10) * 0.06);

  if (visibleParticles.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {visibleParticles.map((particle, i) => {
        // Each particle converges toward the center (50%, 50%)
        const convergeX = `${50 - particle.x}vw`;
        const convergeY = `${50 - particle.y}%`;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: "50%",
              backgroundColor: "var(--color-accent)",
              opacity: converge ? undefined : baseOpacity,
              animation: converge
                ? `particleConverge 1.5s ease-in forwards`
                : `${DRIFT_ANIMATIONS[particle.drift]} ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
              willChange: "transform, opacity",
              ["--converge-x" as string]: convergeX,
              ["--converge-y" as string]: convergeY,
              ["--particle-opacity" as string]: baseOpacity,
            }}
          />
        );
      })}
    </div>
  );
}

const SessionParticles = React.memo(SessionParticlesInner);
export default SessionParticles;
