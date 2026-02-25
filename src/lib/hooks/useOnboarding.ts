"use client";

import { useState, useEffect, useCallback } from "react";

export type OnboardingPhase = "hidden" | "onboarding" | "dissolving" | "complete";

interface UseOnboardingProps {
  initialized: boolean;
  isNewUser: boolean;
  sendMessage: (text: string) => void;
}

export function useOnboarding({
  initialized,
  isNewUser,
  sendMessage,
}: UseOnboardingProps) {
  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>("hidden");

  useEffect(() => {
    if (!initialized || !isNewUser) return;

    const completed = localStorage.getItem("mantle_onboarding_completed");
    if (completed === "true") return;

    setOnboardingPhase("onboarding");
  }, [initialized, isNewUser]);

  const handleComplete = useCallback(
    (focusText: string) => {
      setOnboardingPhase("dissolving");

      // 500ms fade-out + 300ms dark pause
      setTimeout(() => {
        localStorage.setItem("mantle_onboarding_completed", "true");
        sendMessage(focusText);
        setOnboardingPhase("complete");
      }, 800);
    },
    [sendMessage]
  );

  return {
    onboardingPhase,
    handleComplete,
  };
}
