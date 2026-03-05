"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface InfoScreensProps {
  onNavigateToSeed: () => void;
  onBack: () => void;
}

const SCREENS = [
  {
    label: "HOW IT WORKS",
    headline: "Build a working model of how you operate.",
    body: [
      "Through extended conversation, you\u2019ll map what drives you, how you react under pressure, and how you show up in relationships. The result is your User Manual. A living document built from your words and confirmed by you at every step.",
    ],
  },
  {
    label: "WHAT TO EXPECT",
    headline: "A real conversation.\nNot a quiz.",
    body: [
      "Plan for at least 15 minutes your first time. Sage is an AI conversationalist. This isn\u2019t therapy. It\u2019s a structured way to see yourself more clearly.",
      "Sage will ask questions, listen closely, and gradually form an understanding of how you operate. The deeper you go, the more precise your manual becomes.",
    ],
    dataTrust: "Your conversations are encrypted and your data is never sold.",
  },
];

// 3 dots total: screen 1, screen 2, seed
const TOTAL_DOTS = 3;

export default function InfoScreens({ onNavigateToSeed, onBack }: InfoScreensProps) {
  const [screenIndex, setScreenIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef(0);

  const transitionTo = useCallback((nextIndex: number, dir: number) => {
    if (transitioning) return;

    if (nextIndex >= SCREENS.length) {
      onNavigateToSeed();
      return;
    }

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
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
      <div
        style={{
          padding: "0 28px 40px",
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
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--session-sage)",
            marginBottom: 16,
          }}
        >
          {screen.label}
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
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
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.6,
              color: "var(--session-ink-mid)",
              margin: i < screen.body.length - 1 ? "0 0 14px 0" : "0",
            }}
          >
            {paragraph}
          </p>
        ))}

        {/* Privacy note (Screen 2 only) */}
        {screen.dataTrust && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.5,
              color: "var(--session-sage-soft)",
              margin: "16px 0 0 0",
            }}
          >
            {screen.dataTrust}
          </p>
        )}
      </div>

      {/* Nav bar */}
      <div
        style={{
          padding: "0 28px",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Pagination dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {Array.from({ length: TOTAL_DOTS }).map((_, i) => {
            const isActive = i === screenIndex;
            return (
              <button
                key={i}
                onClick={() => handleDotClick(i)}
                style={{
                  width: isActive ? 20 : 4,
                  height: isActive ? 2 : 4,
                  borderRadius: isActive ? 1 : 2,
                  backgroundColor: isActive
                    ? "var(--session-sage)"
                    : "var(--session-ink-whisper)",
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {screenIndex > 0 && (
            <button
              onClick={() => transitionTo(screenIndex - 1, -1)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--session-ink-ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Back
            </button>
          )}

          <button
            onClick={() => transitionTo(screenIndex + 1, 1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--session-cream)",
              backgroundColor: "var(--session-sage-soft)",
              border: "none",
              borderRadius: 8,
              padding: "12px 28px",
              cursor: "pointer",
            }}
          >
            Continue
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9.5 7L5 11" stroke="var(--session-cream)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
