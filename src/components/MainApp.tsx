"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "@/lib/hooks/useChat";
import type { ExplorationContext } from "@/lib/types";
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
  const [explorationLabel, setExplorationLabel] = useState("");
  const [voiceAutoSend, setVoiceAutoSend] = useState(true);

  // Load voice auto-send preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("mantle_voice_autosubmit");
    if (saved !== null) setVoiceAutoSend(saved === "true");
  }, []);

  const handleVoiceAutoSendChange = useCallback((value: boolean) => {
    setVoiceAutoSend(value);
    localStorage.setItem("mantle_voice_autosubmit", String(value));
  }, []);

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
    loadManual,
  } = useChat();

  const {
    onboardingPhase,
    handleComplete,
  } = useOnboarding({ initialized, isNewUser, sendMessage });

  const handleExploreWithSage = useCallback(async (context: ExplorationContext) => {
    // Build dynamic label
    const elementName = context.name || context.layerName;
    setExplorationLabel(elementName);

    // Phase 1: Fade in interstitial
    setExplorationPhase("transitioning");
    await sleep(250);

    // Phase 2: Kick off API call (non-blocking — stream runs in background)
    setExplorationPhase("loading");
    await startExploration(context);

    // Brief pause on interstitial for the "moment of pause" feel
    await sleep(800);

    // Phase 3: Switch to session (thinking dots will be visible), fade out interstitial
    setActiveTab("session");
    setExplorationPhase("revealing");
    await sleep(350);

    // Done — session is showing with thinking dots while Sage generates
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
              voiceAutoSend={voiceAutoSend}
            />
          }
          manualContent={
            <MobileManual components={confirmedComponents} onExploreWithSage={handleExploreWithSage} />
          }
          guidanceContent={
            <MobileGuidance />
          }
          settingsContent={
            <MobileSettings
              userEmail={userEmail}
              sessionCount={conversations.length}
              voiceAutoSend={voiceAutoSend}
              onVoiceAutoSendChange={handleVoiceAutoSendChange}
              onSimulationEvent={handleSimulationEvent}
              onPopulateComplete={loadManual}
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            opacity: explorationPhase === "revealing" ? 0 : 1,
            transition: explorationPhase === "transitioning"
              ? "opacity 250ms ease"
              : explorationPhase === "revealing"
                ? "opacity 350ms ease"
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
              background: "radial-gradient(ellipse at center, rgba(122,139,114,0.28) 0%, rgba(122,139,114,0.08) 40%, transparent 70%)",
              filter: "blur(30px)",
              pointerEvents: "none",
              animation: "explorationGlow 3s ease-in-out infinite",
            }}
          />
          <style>{`
            @keyframes explorationGlow {
              0%, 100% { opacity: 0.45; transform: scale(0.92); }
              50% { opacity: 1; transform: scale(1.15); }
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
              animation: "mantleFadeIn 0.5s ease-out both",
            }}
          >
            Let&apos;s explore further
          </p>
          {explorationLabel && (
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "15px",
                color: "var(--color-text-dim)",
                margin: 0,
                letterSpacing: "-0.2px",
                position: "relative",
                animation: "mantleFadeIn 0.7s ease-out 0.15s both",
              }}
            >
              {explorationLabel}
            </p>
          )}
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
