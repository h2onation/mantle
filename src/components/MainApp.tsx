"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@/lib/hooks/useChat";
import { useAudio } from "@/components/providers/AudioProvider";
import AppLayout from "@/components/layout/AppLayout";
import LeftNav from "@/components/layout/LeftNav";
import ChatPane from "@/components/layout/ChatPane";
import ContextPane from "@/components/context/ContextPane";
import ConversationHistory from "@/components/chat/ConversationHistory";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";

export default function MainApp() {
  const {
    messages,
    conversationId,
    isLoading,
    activeCheckpoint,
    confirmedComponents,
    initialized,
    isNewUser,
    displayName,
    errorMessage,
    checkpointError,
    sendMessage,
    retryLastMessage,
    confirmCheckpoint,
    loadConversation,
    startNewConversation,
    supabase,
  } = useChat();

  const { autoplayBlocked, resumeAutoplay } = useAudio();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [skipWelcome, setSkipWelcome] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissReopenRef = useRef(false);

  // Determine onboarding state once useChat signals isNewUser
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

  const handleOnboardingComplete = useCallback(
    (focusText: string, selectedSound: string | null) => {
      // Sound is already saved to localStorage by AudioProvider.play()
      // If no sound selected, clear any existing preference
      if (!selectedSound) {
        localStorage.removeItem("mantle_session_sound");
      }
      localStorage.setItem("mantle_onboarding_completed", "true");

      setShowOnboarding(false);
      setIsBlurred(false);

      // Send the user's focus text as their first message
      sendMessage(focusText);
    },
    [sendMessage]
  );

  const handleOnboardingDismiss = useCallback(() => {
    localStorage.setItem("mantle_onboarding_dismissed", "true");
    setShowOnboarding(false);
    setIsBlurred(false);
    setDismissed(true);
  }, []);

  // After dismissal, re-open onboarding (at sound card) on first input interaction
  const handleInputFocus = useCallback(() => {
    if (dismissed && !dismissReopenRef.current) {
      dismissReopenRef.current = true;
      setSkipWelcome(true);
      setShowOnboarding(true);
      setIsBlurred(true);
      setDismissed(false);
    }
  }, [dismissed]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }

  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!initialized) {
    return (
      <div
        style={{
          height: "100vh",
          backgroundColor: "var(--color-bg-primary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <div style={{ position: "relative", width: "40px", height: "40px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid transparent",
                borderTopColor: i === 0 ? "#5C6B5E" : i === 1 ? "#B5AFA6" : "#E5DFD5",
                animation: `mantleSpinner ${1.2 + i * 0.3}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                animationDirection: i === 1 ? "reverse" : "normal",
                transform: `scale(${1 - i * 0.2})`,
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "14px",
            color: "var(--color-text-muted)",
            margin: 0,
            animation: "mantleFadeIn 0.8s ease-out",
          }}
        >
          Forming...
        </p>
        <style>{`
          @keyframes mantleSpinner {
            0% { transform: scale(${1}) rotate(0deg); }
            100% { transform: scale(${1}) rotate(360deg); }
          }
          @keyframes mantleFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <ConversationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(convId) => loadConversation(convId)}
        onNewConversation={() => startNewConversation()}
        activeConversationId={conversationId}
        supabase={supabase}
      />
      <AppLayout
        isBlurred={isBlurred}
        leftNav={
          <LeftNav
            displayName={displayName}
            hasManualComponents={confirmedComponents.length > 0}
          />
        }
        chatPane={
          <ChatPane
            messages={messages}
            isLoading={isLoading}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onHistoryToggle={() => setHistoryOpen(true)}
            errorMessage={errorMessage}
            onRetry={retryLastMessage}
            onInputFocus={handleInputFocus}
            autoplayBlocked={autoplayBlocked}
            onResumeAudio={resumeAutoplay}
          />
        }
        contextPane={
          <ContextPane
            userInitials={userInitials}
            manualComponents={confirmedComponents}
            activeCheckpoint={activeCheckpoint}
            onCheckpointConfirm={() => confirmCheckpoint("confirmed")}
            onCheckpointRefine={() => confirmCheckpoint("refined")}
            onCheckpointReject={() => confirmCheckpoint("rejected")}
            checkpointError={checkpointError}
          />
        }
      />
      {showOnboarding && (
        <OnboardingOverlay
          onComplete={handleOnboardingComplete}
          onDismiss={handleOnboardingDismiss}
          skipWelcome={skipWelcome}
        />
      )}
    </>
  );
}
