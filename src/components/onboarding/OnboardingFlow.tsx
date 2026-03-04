"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AmbientGlow, { type GlowConfig } from "./AmbientGlow";
import EntryScreen, { ENTRY_GLOW } from "./EntryScreen";
import LoginScreen, { LOGIN_GLOW } from "./LoginScreen";
import InfoScreens from "./InfoScreens";
import SeedScreen from "./SeedScreen";

type ViewName = "entry" | "login" | "onboarding" | "seed";

const SEED_GLOW: GlowConfig = { x: 55, y: 15, scale: 0.9, opacity: 0.14 };

export default function OnboardingFlow() {
  const [currentView, setCurrentView] = useState<ViewName>("entry");
  const [viewOpacity, setViewOpacity] = useState(1);
  const [glowConfig, setGlowConfig] = useState<GlowConfig>(ENTRY_GLOW);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const checkedRef = useRef(false);

  // Returning user check on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const onboardingCompleted = localStorage.getItem("mantle_onboarding_completed") === "true";
    if (!onboardingCompleted) {
      setReady(true);
      return;
    }

    // Check for auth session (covers both real users and anonymous guests)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        // Authenticated user (real or anonymous) — resume session
        router.push("/");
        return;
      }

      // Onboarding completed but no session — show entry screen
      // (user taps "Log In" to reach the login form)
      setReady(true);
    });
  }, [router]);

  const fadeToView = useCallback((view: ViewName, glow: GlowConfig, duration = 400) => {
    setViewOpacity(0);
    setTimeout(() => {
      setCurrentView(view);
      setGlowConfig(glow);
      setViewOpacity(1);
    }, duration);
  }, []);

  // Glow change callback (stable reference)
  const handleGlowChange = useCallback((config: GlowConfig) => {
    setGlowConfig(config);
  }, []);

  function handleGetStarted() {
    fadeToView("onboarding", { x: 50, y: 25, scale: 1.1, opacity: 0.22 });
  }

  function handleLogin() {
    fadeToView("login", LOGIN_GLOW);
  }

  function handleBackToEntry() {
    setCurrentView("entry");
    setGlowConfig(ENTRY_GLOW);
    setViewOpacity(1);
  }

  function handleNavigateToSeed() {
    fadeToView("seed", SEED_GLOW);
  }

  if (!ready) {
    return (
      <div
        style={{
          width: "100%",
          height: "100dvh",
          backgroundColor: "var(--color-void)",
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
        backgroundColor: "var(--color-void)",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AmbientGlow config={glowConfig} />

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
          />
        )}

        {currentView === "login" && (
          <LoginScreen onBack={handleBackToEntry} />
        )}

        {currentView === "onboarding" && (
          <InfoScreens
            onNavigateToSeed={handleNavigateToSeed}
            onBack={handleBackToEntry}
            onGlowChange={handleGlowChange}
          />
        )}

        {currentView === "seed" && (
          <SeedScreen
            onGlowChange={handleGlowChange}
          />
        )}
      </div>
    </div>
  );
}
