"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import EntryScreen from "./EntryScreen";
import LoginScreen from "./LoginScreen";
import InfoScreens from "./InfoScreens";
import SeedScreen from "./SeedScreen";

type ViewName = "entry" | "login" | "signup" | "onboarding" | "seed";

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

  function handleGetStarted() {
    fadeToView("onboarding");
  }

  function handleLogin() {
    fadeToView("login");
  }

  function handleSignup() {
    fadeToView("signup");
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
        {currentView === "entry" && (
          <EntryScreen
            onGetStarted={handleGetStarted}
            onLogin={handleLogin}
            onSignup={handleSignup}
          />
        )}

        {currentView === "login" && (
          <LoginScreen onBack={handleBackToEntry} />
        )}

        {currentView === "signup" && (
          <LoginScreen onBack={handleBackToEntry} initialMode="signup" />
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
  );
}
