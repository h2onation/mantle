"use client";

import { useState, useCallback, useEffect } from "react";
import { useChat } from "@/lib/hooks/useChat";
import type { ExplorationContext } from "@/lib/types";
import MobileLayout from "@/components/layout/MobileLayout";
import type { MobileTab } from "@/components/layout/MobileNav";
import AuthPromptModal from "@/components/onboarding/AuthPromptModal";
import MobileSession from "@/components/mobile/MobileSession";
import MobileManual from "@/components/mobile/MobileManual";
import MobileSettings from "@/components/mobile/MobileSettings";
import SWUpdatePrompt from "@/components/shared/SWUpdatePrompt";
import PostLoginOnboarding from "@/components/onboarding/PostLoginOnboarding";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";

type ExplorationPhase = "transitioning" | "loading" | "revealing" | null;
type OnboardingStatus = "loading" | "needed" | "complete";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("session");
  const [explorationPhase, setExplorationPhase] = useState<ExplorationPhase>(null);
  const [explorationLabel, setExplorationLabel] = useState("");
  const [authDismissed, setAuthDismissed] = useState(false);
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("loading");
  const { updateAvailable, applyUpdate } = useServiceWorker();

  // Clean up post-OAuth conversion flag
  useEffect(() => {
    if (localStorage.getItem("mantle_pending_conversion") === "true") {
      localStorage.removeItem("mantle_pending_conversion");
    }
  }, []);

  // Onboarding gate. Fresh beta signups must pass through the
  // InfoScreens + SeedScreen disclaimers once before reaching the
  // app. Fail open on error: a transient API failure must not lock
  // a logged-in beta user out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding-status");
        if (!res.ok) {
          console.error(
            "[MainApp] onboarding-status returned",
            res.status,
            "— failing open"
          );
          if (!cancelled) setOnboardingStatus("complete");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setOnboardingStatus(data.completed ? "complete" : "needed");
      } catch (err) {
        console.error("[MainApp] onboarding-status fetch failed:", err);
        if (!cancelled) setOnboardingStatus("complete");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedComponents,
    displayName,
    initialized,
    isNewUser,
    firstSessionCompleted,
    sessionOrigin,
    sessionSummary,
    lastSessionDate,
    userEmail,
    errorMessage,
    checkpointError,
    conversations,
    isGuest,
    promptAuth,
    resetPromptAuth,
    showFeedbackModal,
    dismissFeedbackModal,
    feedbackHint,
    clearFeedbackHint,
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

  // When promptAuth fires, clear any previous dismiss so modal shows
  useEffect(() => {
    if (promptAuth) setAuthDismissed(false);
  }, [promptAuth]);

  // Inline sign-in banner state
  const [bannerAuthRequested, setBannerAuthRequested] = useState(false);

  // Auth prompt dismiss: reset promptAuth so next checkpoint can re-trigger
  const handleAuthDismiss = useCallback(() => {
    setAuthDismissed(true);
    setBannerAuthRequested(false);
    resetPromptAuth();
  }, [resetPromptAuth]);

  const handleAuthSuccess = useCallback(() => {
    setAuthDismissed(true);
    setBannerAuthRequested(false);
    resetPromptAuth();
  }, [resetPromptAuth]);

  // Trigger auth modal from inline sign-in banner
  const handleSignInPrompt = useCallback(() => {
    setBannerAuthRequested(true);
    setAuthDismissed(false);
  }, []);

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

  // Only block render on useChat init. The onboarding-status check
  // is allowed to resolve in the background — if it comes back as
  // "needed" we swap in PostLoginOnboarding then. Blocking on the
  // status check turned the splash into a hard wall when the fetch
  // didn't resolve quickly enough on first paint.
  if (!initialized) {
    return (
      <div
        style={{
          height: "100dvh",
          backgroundColor: "var(--session-linen)",
        }}
      />
    );
  }

  if (onboardingStatus === "needed") {
    return (
      <PostLoginOnboarding
        onComplete={() => setOnboardingStatus("complete")}
      />
    );
  }

  const showAuthModal = isGuest && (promptAuth || bannerAuthRequested) && !authDismissed;

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
            showFeedbackModal={showFeedbackModal}
            dismissFeedbackModal={dismissFeedbackModal}
            feedbackHint={feedbackHint}
            clearFeedbackHint={clearFeedbackHint}
            isGuest={isGuest}
            onSignInPrompt={handleSignInPrompt}
            firstSessionCompleted={firstSessionCompleted}
            sessionOrigin={sessionOrigin}
          />
        }
        manualContent={
          <MobileManual components={confirmedComponents} displayName={displayName} onExploreWithSage={handleExploreWithSage} />
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

      {/* SW update prompt */}
      {updateAvailable && <SWUpdatePrompt onUpdate={applyUpdate} />}

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
