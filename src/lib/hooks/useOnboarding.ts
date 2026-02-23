"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [skipWelcome, setSkipWelcome] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissReopenRef = useRef(false);

  useEffect(() => {
    if (!initialized || !isNewUser) return;

    const completed = localStorage.getItem("mantle_onboarding_completed");
    if (completed === "true") return;

    const wasDismissed = localStorage.getItem("mantle_onboarding_dismissed");
    if (wasDismissed === "true") {
      setSkipWelcome(true);
    }

    setShowOnboarding(true);
    setIsBlurred(true);
  }, [initialized, isNewUser]);

  const handleComplete = useCallback(
    (focusText: string, selectedSound: string | null) => {
      if (!selectedSound) {
        localStorage.removeItem("mantle_session_sound");
      }
      localStorage.setItem("mantle_onboarding_completed", "true");

      setShowOnboarding(false);
      setIsBlurred(false);

      sendMessage(focusText);
    },
    [sendMessage]
  );

  const handleDismiss = useCallback(() => {
    localStorage.setItem("mantle_onboarding_dismissed", "true");
    setShowOnboarding(false);
    setIsBlurred(false);
    setDismissed(true);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (dismissed && !dismissReopenRef.current) {
      dismissReopenRef.current = true;
      setSkipWelcome(true);
      setShowOnboarding(true);
      setIsBlurred(true);
      setDismissed(false);
    }
  }, [dismissed]);

  return {
    showOnboarding,
    isBlurred,
    skipWelcome,
    handleComplete,
    handleDismiss,
    handleInputFocus,
  };
}
