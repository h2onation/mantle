"use client";

import { useState, useCallback } from "react";
import InfoScreens from "./InfoScreens";
import SeedScreen from "./SeedScreen";

// Renders the existing InfoScreens + SeedScreen sequence for an
// already-authenticated user finishing first-time onboarding.
// Skips EntryScreen / LoginScreen entirely. SeedScreen runs in
// post-login mode (writes profiles.onboarding_completed_at instead
// of creating an anonymous account) and calls onComplete when done,
// which lets MainApp re-render into the normal app without a route
// push.

interface PostLoginOnboardingProps {
  onComplete: () => void;
}

type View = "info" | "seed";

export default function PostLoginOnboarding({
  onComplete,
}: PostLoginOnboardingProps) {
  const [currentView, setCurrentView] = useState<View>("info");
  const [viewOpacity, setViewOpacity] = useState(1);

  const fadeToView = useCallback((view: View, duration = 400) => {
    setViewOpacity(0);
    setTimeout(() => {
      setCurrentView(view);
      setViewOpacity(1);
    }, duration);
  }, []);

  function handleNavigateToSeed() {
    fadeToView("seed");
  }

  function handleBack() {
    setCurrentView("info");
    setViewOpacity(1);
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "430px",
        margin: "0 auto",
        height: "100dvh",
        background: "var(--session-linen)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          height: "100%",
          opacity: viewOpacity,
          transition: "opacity 400ms ease",
        }}
      >
        {currentView === "info" && (
          <InfoScreens
            onNavigateToSeed={handleNavigateToSeed}
            onBack={handleBack}
          />
        )}

        {currentView === "seed" && <SeedScreen onComplete={onComplete} />}
      </div>
    </div>
  );
}
