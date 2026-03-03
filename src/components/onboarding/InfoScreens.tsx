"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GlowConfig } from "./AmbientGlow";

interface InfoScreensProps {
  onNavigateToSeed: () => void;
  onBack: () => void;
  onGlowChange: (config: GlowConfig) => void;
}

const SCREENS = [
  {
    label: "MANTLE",
    headline: "Build a working model\nof how you operate.",
    body: [
      "Through extended conversation, you\u2019ll map what drives you, how you react under pressure, and how you show up in relationships. The result is your User Manual. A living document built from your words and confirmed by you at every step.",
    ],
    glow: { x: 50, y: 25, scale: 1.1, opacity: 0.22 },
  },
  {
    label: "WHAT TO EXPECT",
    headline: "A real conversation.\nNot a quiz.",
    body: [
      "Plan for at least 15 minutes your first time. Sage is an AI conversationalist. This isn\u2019t therapy. It\u2019s a structured way to see yourself more clearly.",
      "Sage will ask questions, listen closely, and gradually form an understanding of how you operate. The deeper you go, the more precise your manual becomes.",
    ],
    dataTrust: "Your conversations are encrypted and your data is never sold.",
    glow: { x: 35, y: 30, scale: 1.0, opacity: 0.18 },
  },
];

// 3 dots total: screen 1, screen 2, seed
const TOTAL_DOTS = 3;

export default function InfoScreens({ onNavigateToSeed, onBack, onGlowChange }: InfoScreensProps) {
  const [screenIndex, setScreenIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const touchStartX = useRef(0);

  // Emit glow config on screen change
  useEffect(() => {
    onGlowChange(SCREENS[screenIndex].glow);
  }, [screenIndex, onGlowChange]);

  const transitionTo = useCallback((nextIndex: number, dir: number) => {
    if (transitioning) return;

    // Navigate to seed screen
    if (nextIndex >= SCREENS.length) {
      onNavigateToSeed();
      return;
    }

    // Navigate back to entry
    if (nextIndex < 0) {
      onBack();
      return;
    }

    setTransitioning(true);
    setDirection(dir);
    setContentVisible(false);

    setTimeout(() => {
      setScreenIndex(nextIndex);
      setDirection(dir);
      setTimeout(() => {
        setContentVisible(true);
        setTransitioning(false);
      }, 50);
    }, 350);
  }, [transitioning, onNavigateToSeed, onBack]);

  // Arrow key navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") transitionTo(screenIndex + 1, 1);
      else if (e.key === "ArrowLeft") transitionTo(screenIndex - 1, -1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screenIndex, transitionTo]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0) transitionTo(screenIndex + 1, 1);
      else transitionTo(screenIndex - 1, -1);
    }
  }

  function handleDotClick(dotIndex: number) {
    if (dotIndex === screenIndex) return;
    if (dotIndex >= SCREENS.length) {
      onNavigateToSeed();
      return;
    }
    transitionTo(dotIndex, dotIndex > screenIndex ? 1 : -1);
  }

  const screen = SCREENS[screenIndex];

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        height: "100%",
        boxSizing: "border-box",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Content area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: "100%",
          padding: "0 32px 148px",
          boxSizing: "border-box",
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible
            ? "translateY(0)"
            : `translateY(${-8 * direction}px)`,
          transition: contentVisible
            ? "opacity 450ms ease, transform 450ms ease"
            : "opacity 350ms ease, transform 350ms ease",
        }}
      >
        {/* Label */}
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--color-accent-dim)",
            marginBottom: "16px",
          }}
        >
          {screen.label}
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 400,
            lineHeight: 1.22,
            letterSpacing: "-0.01em",
            color: "var(--color-text)",
            margin: "0 0 20px 0",
            whiteSpace: "pre-line",
          }}
        >
          {screen.headline}
        </h1>

        {/* Body paragraphs */}
        {screen.body.map((paragraph, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "14.5px",
              lineHeight: 1.75,
              color: "var(--color-text-dim)",
              margin: i < screen.body.length - 1 ? "0 0 16px 0" : "0",
              maxWidth: "340px",
            }}
          >
            {paragraph}
          </p>
        ))}

        {/* Data trust line (Screen 2 only) */}
        {screen.dataTrust && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              color: "var(--color-accent-dim)",
              margin: "20px 0 0 0",
            }}
          >
            {screen.dataTrust}
          </p>
        )}
      </div>

      {/* Nav bar */}
      <div
        style={{
          position: "absolute",
          bottom: "52px",
          left: "32px",
          right: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Pagination dots */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {Array.from({ length: TOTAL_DOTS }).map((_, i) => {
            const isActive = i === screenIndex;
            const isVisited = i < screenIndex;
            return (
              <button
                key={i}
                onClick={() => handleDotClick(i)}
                style={{
                  width: isActive ? "20px" : "5px",
                  height: "5px",
                  borderRadius: "3px",
                  backgroundColor: isActive
                    ? "var(--color-accent-strong)"
                    : isVisited
                    ? "var(--color-accent-glow)"
                    : "var(--color-divider)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
                }}
                aria-label={`Go to screen ${i + 1}`}
              />
            );
          })}
        </div>

        {/* Right side: Back + Continue */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Back button (Screen 2 only) */}
          {screenIndex > 0 && (
            <button
              onClick={() => transitionTo(screenIndex - 1, -1)}
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "13.5px",
                color: "var(--color-text-ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
              }}
            >
              Back
            </button>
          )}

          {/* Continue button */}
          <button
            onClick={() => transitionTo(screenIndex + 1, 1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "var(--font-serif)",
              fontSize: "13.5px",
              color: "var(--color-void)",
              backgroundColor: "var(--color-accent-dim)",
              border: "1px solid var(--color-input-border-focus)",
              borderRadius: "10px",
              padding: "11px 24px",
              cursor: "pointer",
            }}
          >
            Continue
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
