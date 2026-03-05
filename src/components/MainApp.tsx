"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@/lib/hooks/useChat";
import type { ExplorationContext } from "@/lib/types";
import MobileLayout from "@/components/layout/MobileLayout";
import type { MobileTab } from "@/components/layout/MobileNav";
import AuthPromptModal from "@/components/onboarding/AuthPromptModal";
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
  const [authDismissed, setAuthDismissed] = useState(false);
  const seedSent = useRef(false);

  // Clean up post-OAuth conversion flag
  useEffect(() => {
    if (localStorage.getItem("mantle_pending_conversion") === "true") {
      localStorage.removeItem("mantle_pending_conversion");
    }
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
    isGuest,
    promptAuth,
    resetPromptAuth,
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

  // Seed handoff: send seed text from onboarding as first message
  useEffect(() => {
    if (!initialized) return;
    if (seedSent.current) return;
    const seed = sessionStorage.getItem("mantle_seed_text");
    if (!seed) return;
    seedSent.current = true;
    sessionStorage.removeItem("mantle_seed_text");
    sendMessage(seed);
  }, [initialized, sendMessage]);

  // When promptAuth fires, clear any previous dismiss so modal shows
  useEffect(() => {
    if (promptAuth) setAuthDismissed(false);
  }, [promptAuth]);

  // Auth prompt dismiss: reset promptAuth so next checkpoint can re-trigger
  const handleAuthDismiss = useCallback(() => {
    setAuthDismissed(true);
    resetPromptAuth();
  }, [resetPromptAuth]);

  const handleAuthSuccess = useCallback(() => {
    setAuthDismissed(true);
    resetPromptAuth();
  }, [resetPromptAuth]);

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
          backgroundColor: "var(--session-linen)",
        }}
      />
    );
  }

  const showAuthModal = isGuest && promptAuth && !authDismissed;

  return (
    <>
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
        exploreContent={
          <MobileGuidance />
        }
        settingsContent={
          <MobileSettings
            userEmail={userEmail}
            onSimulationEvent={handleSimulationEvent}
            onPopulateComplete={loadManual}
          />
        }
      />

      {/* Exploration interstitial overlay */}
      {explorationPhase !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            backgroundColor: "var(--session-linen)",
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
              background: "radial-gradient(ellipse at center, rgba(122,139,114,0.18) 0%, rgba(122,139,114,0.05) 40%, transparent 70%)",
              filter: "blur(30px)",
              pointerEvents: "none",
              animation: "explorationGlow 3s ease-in-out infinite",
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              color: "var(--session-ink)",
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
                color: "var(--session-ink-soft)",
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

      {/* Auth prompt modal for guest users */}
      {showAuthModal && (
        <AuthPromptModal
          onDismiss={handleAuthDismiss}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}
