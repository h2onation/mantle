"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import EntryScreen from "./EntryScreen";
import LoginScreen from "./LoginScreen";
import InfoScreens from "./InfoScreens";
import SeedScreen from "./SeedScreen";
import DesktopVitrine from "@/components/layout/DesktopVitrine";

type ViewName = "entry" | "login" | "onboarding" | "seed";

export default function OnboardingFlow() {
  const [currentView, setCurrentView] = useState<ViewName>("entry");
  const [viewOpacity, setViewOpacity] = useState(1);
  const [ready, setReady] = useState(false);
  const checkedRef = useRef(false);

  // Show UI immediately — middleware already handles redirecting
  // authenticated users from /login to /. No need to duplicate that
  // check here (doing so causes redirect loops with stale cookies).
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setReady(true);
  }, []);

  const fadeToView = useCallback((view: ViewName, duration = 400) => {
    setViewOpacity(0);
    setTimeout(() => {
      setCurrentView(view);
      setViewOpacity(1);
    }, duration);
  }, []);

  function handleLogin() {
    fadeToView("login");
  }

  function handleBackToEntry() {
    setCurrentView("entry");
    setViewOpacity(1);
  }

  function handleNavigateToSeed() {
    fadeToView("seed");
  }

  if (!ready) {
    return (
      <div
        style={{
          width: "100%",
          height: "100dvh",
          background: "var(--session-linen)",
        }}
      />
    );
  }

  return (
    <DesktopVitrine>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--session-linen)",
          // Paper surface: noise + corner vignette. Matches the authenticated
          // tab panels so landing and Jove chat share the same paper feel.
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"), radial-gradient(ellipse at center, transparent 50%, rgba(26, 22, 20, 0.04) 100%)`,
          backgroundSize: "256px 256px, 100% 100%",
          backgroundRepeat: "repeat, no-repeat",
          overflow: "hidden",
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
          {currentView === "entry" && (
            <EntryScreen onLogin={handleLogin} />
          )}

          {currentView === "login" && (
            <LoginScreen onBack={handleBackToEntry} />
          )}

          {currentView === "onboarding" && (
            <InfoScreens
              onNavigateToSeed={handleNavigateToSeed}
              onBack={handleBackToEntry}
            />
          )}

          {currentView === "seed" && (
            <SeedScreen />
          )}
        </div>
      </div>
    </DesktopVitrine>
  );
}
