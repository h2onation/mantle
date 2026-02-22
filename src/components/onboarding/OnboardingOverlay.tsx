"use client";

import { useState, useEffect } from "react";
import WelcomeCard from "./WelcomeCard";
import SoundCard from "./SoundCard";
import FocusCard from "./FocusCard";

type Step = "welcome" | "sound" | "focus";

interface OnboardingOverlayProps {
  onComplete: (focusText: string, selectedSound: string | null) => void;
  onDismiss: () => void;
  skipWelcome?: boolean;
}

export default function OnboardingOverlay({
  onComplete,
  onDismiss,
  skipWelcome,
}: OnboardingOverlayProps) {
  const [step, setStep] = useState<Step>(skipWelcome ? "sound" : "welcome");
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  // Fade in on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  function transitionTo(nextStep: Step) {
    setTransitioning(true);
    setVisible(false);

    setTimeout(() => {
      setStep(nextStep);
      setVisible(true);
      setTransitioning(false);
    }, 300);
  }

  function handleReady() {
    transitionTo("sound");
  }

  function handleSoundSelect(sound: string | null) {
    setSelectedSound(sound);
    transitionTo("focus");
  }

  function handleFocusSubmit(text: string) {
    onComplete(text, selectedSound);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        style={{
          opacity: visible && !transitioning ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {step === "welcome" && (
          <WelcomeCard onReady={handleReady} onDismiss={onDismiss} />
        )}
        {step === "sound" && <SoundCard onSelect={handleSoundSelect} />}
        {step === "focus" && <FocusCard onSubmit={handleFocusSubmit} />}
      </div>
    </div>
  );
}
