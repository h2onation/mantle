"use client";

import { useState, useCallback } from "react";
import { useChat, type ExplorationContext } from "@/lib/hooks/useChat";
import { useOnboarding } from "@/lib/hooks/useOnboarding";
import MobileLayout from "@/components/layout/MobileLayout";
import type { MobileTab } from "@/components/layout/MobileNav";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import MobileSession from "@/components/mobile/MobileSession";
import MobileManual from "@/components/mobile/MobileManual";
import MobileGuidance from "@/components/mobile/MobileGuidance";
import MobileSettings from "@/components/mobile/MobileSettings";

type ExplorationPhase = "transitioning" | "loading" | "revealing" | null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("session");
  const [explorationPhase, setExplorationPhase] = useState<ExplorationPhase>(null);

  const {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedComponents,
    initialized,
    isNewUser,
    sessionSummary,
    lastSessionDate,
    userEmail,
    errorMessage,
    checkpointError,
    conversations,
    sendMessage,
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    loadConversation,
    startNewSession,
    startExploration,
    refreshConversations,
  } = useChat();

  const {
    onboardingPhase,
    handleComplete,
  } = useOnboarding({ initialized, isNewUser, sendMessage });

  const handleExploreWithSage = useCallback(async (context: ExplorationContext) => {
    // Phase 1: Fade out Manual, fade in interstitial
    setExplorationPhase("transitioning");
    await sleep(400);

    // Phase 2: Interstitial visible, start API call
    setExplorationPhase("loading");
    await startExploration(context);

    // Phase 3: Response received, switch tab behind interstitial, then reveal
    setActiveTab("session");
    setExplorationPhase("revealing");
    await sleep(600);

    // Done
    setExplorationPhase(null);
  }, [startExploration]);

  const handleSimulationEvent = useCallback((type: string, conversationId: string) => {
    loadConversation(conversationId);
    if (type === "start") {
      setActiveTab("session");
    }
  }, [loadConversation]);

  if (!initialized) {
    return (
      <div
        style={{
          height: "100vh",
          backgroundColor: "var(--color-void)",
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
                borderTopColor:
                  i === 0
                    ? "var(--color-accent)"
                    : i === 1
                      ? "var(--color-text-ghost)"
                      : "var(--color-divider)",
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
            color: "var(--color-text-ghost)",
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

  const showLayout = onboardingPhase === "complete" || onboardingPhase === "hidden";
  const layoutFadingIn = onboardingPhase === "complete";

  return (
    <>
      <div
        style={{
          opacity: showLayout ? 1 : 0,
          visibility: showLayout ? "visible" : "hidden",
          transition: layoutFadingIn ? "opacity 500ms ease" : undefined,
        }}
      >
        <MobileLayout
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sessionContent={
            <MobileSession
              messages={messages}
              conversationId={conversationId}
              isLoading={isLoading}
              isStreaming={isStreaming}
              isNewUser={isNewUser}
              sessionSummary={sessionSummary}
              lastSessionDate={lastSessionDate}
              confirmedComponents={confirmedComponents}
              activeCheckpoint={activeCheckpoint}
              checkpointError={checkpointError}
              errorMessage={errorMessage}
              conversations={conversations}
              sendMessage={sendMessage}
              retryLastMessage={retryLastMessage}
              confirmCheckpoint={confirmCheckpoint}
              switchConversation={switchConversation}
              startNewSession={startNewSession}
              refreshConversations={refreshConversations}
            />
          }
          manualContent={
            <MobileManual components={confirmedComponents} onExploreWithSage={handleExploreWithSage} />
          }
          guidanceContent={
            <MobileGuidance confirmedCount={confirmedComponents.length} />
          }
          settingsContent={
            <MobileSettings
              userEmail={userEmail}
              sessionCount={conversations.length}
              onSimulationEvent={handleSimulationEvent}
            />
          }
        />
      </div>

      {/* Exploration interstitial overlay */}
      {explorationPhase !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            backgroundColor: "var(--color-void)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: explorationPhase === "revealing" ? 0 : 1,
            transition: explorationPhase === "transitioning"
              ? "opacity 400ms ease"
              : explorationPhase === "revealing"
                ? "opacity 500ms ease"
                : undefined,
          }}
        >
          {/* Ambient glow behind text */}
          <div
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(122,139,114,0.2) 0%, rgba(122,139,114,0.05) 40%, transparent 70%)",
              filter: "blur(30px)",
              pointerEvents: "none",
              animation: "explorationGlow 4s ease-in-out infinite",
            }}
          />
          <style>{`
            @keyframes explorationGlow {
              0%, 100% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.08); }
            }
          `}</style>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: "-0.3px",
              position: "relative",
              animation: "mantleFadeIn 0.6s ease-out both",
            }}
          >
            Let&apos;s explore further
          </p>
        </div>
      )}

      {(onboardingPhase === "onboarding" || onboardingPhase === "dissolving") && (
        <OnboardingOverlay
          onComplete={handleComplete}
          phase={onboardingPhase}
        />
      )}
    </>
  );
}
