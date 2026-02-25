"use client";

import { useState, useEffect, useCallback } from "react";
import OnboardingInfoScreen from "./OnboardingInfoScreen";
import OnboardingSeedScreen from "./OnboardingSeedScreen";

interface OnboardingOverlayProps {
  onComplete: (text: string) => void;
  phase: "onboarding" | "dissolving";
}

const SCREENS = [
  {
    headline: "Mantle",
    body: "A space for honest conversation about how you move through the world. Not therapy. Not advice. Just structured depth that builds something real.",
  },
  {
    iconType: "clock" as const,
    label: "DEPTH TAKES TIME",
    headline: "This is a 20-minute conversation",
    body: "Long enough to get past surface answers. Each session builds a permanent record of what drives your behavior — written in your own language, confirmed by you.",
  },
  {
    iconType: "fingerprint" as const,
    label: "HOW IT WORKS",
    headline: "You talk. Sage listens. Patterns emerge.",
    body: "Sage is an AI conversationalist trained to surface the behavioral patterns most people can't see on their own. When something resonates, you'll be asked to confirm it.",
  },
  {
    iconType: "shield" as const,
    label: "YOUR ROLE",
    headline: "Be honest — even when it's uncomfortable",
    body: "The model is only as good as what you bring to it. The things you'd normally skip over or minimize? That's usually where the real material lives.",
  },
];

export default function OnboardingOverlay({
  onComplete,
  phase,
}: OnboardingOverlayProps) {
  const [screenIndex, setScreenIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);

  const totalScreens = SCREENS.length + 1; // 4 info + 1 seed
  const isLastInfoScreen = screenIndex === SCREENS.length - 1;
  const isSeedScreen = screenIndex === SCREENS.length;

  // Fade in on mount
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Show first screen content after mount
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => setContentVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  const transitionTo = useCallback((nextIndex: number) => {
    if (transitioning) return;
    setTransitioning(true);
    setContentVisible(false);

    setTimeout(() => {
      setScreenIndex(nextIndex);
      setTimeout(() => {
        setContentVisible(true);
        setTransitioning(false);
      }, 100);
    }, 250);
  }, [transitioning]);

  function handleContinue() {
    if (screenIndex < totalScreens - 1) {
      transitionTo(screenIndex + 1);
    }
  }

  function handleBack() {
    if (screenIndex > 0) {
      transitionTo(screenIndex - 1);
    }
  }

  function handleSeedSubmit(text: string) {
    onComplete(text);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "var(--color-void)",
        opacity: mounted ? (phase === "dissolving" ? 0 : 1) : 0,
        transition: phase === "dissolving" ? "opacity 500ms ease" : "opacity 300ms ease",
      }}
    >
      {/* Screen content */}
      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: "opacity 250ms ease",
        }}
      >
        {!isSeedScreen && (
          <OnboardingInfoScreen
            iconType={SCREENS[screenIndex]?.iconType}
            label={SCREENS[screenIndex]?.label}
            headline={SCREENS[screenIndex]?.headline || ""}
            body={SCREENS[screenIndex]?.body || ""}
            contentVisible={contentVisible}
          />
        )}
        {isSeedScreen && (
          <OnboardingSeedScreen
            onSubmit={handleSeedSubmit}
            contentVisible={contentVisible}
          />
        )}
      </div>

      {/* Navigation bar */}
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          left: "28px",
          right: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Back link */}
        <div style={{ width: "60px" }}>
          {screenIndex > 0 && !isSeedScreen && (
            <button
              onClick={handleBack}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              Back
            </button>
          )}
          {isSeedScreen && (
            <button
              onClick={handleBack}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--color-text-ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              Back
            </button>
          )}
        </div>

        {/* Pagination dashes */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          {Array.from({ length: totalScreens }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === screenIndex ? "20px" : "8px",
                height: "2px",
                borderRadius: "1px",
                backgroundColor:
                  i === screenIndex
                    ? "var(--color-accent)"
                    : "var(--color-text-ghost)",
                opacity: i === screenIndex ? 1 : 0.3,
                transition: "width 300ms ease, background-color 300ms ease, opacity 300ms ease",
              }}
            />
          ))}
        </div>

        {/* Continue button */}
        <div style={{ width: "60px", display: "flex", justifyContent: "flex-end" }}>
          {!isSeedScreen && (
            <button
              onClick={handleContinue}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--color-accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              {isLastInfoScreen ? "Begin" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
