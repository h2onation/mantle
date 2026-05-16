"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@/lib/hooks/useChat";
import type { ExplorationContext } from "@/lib/types";
import MobileLayout, { type MobileView } from "@/components/layout/MobileLayout";
import AuthPromptModal from "@/components/onboarding/AuthPromptModal";
import MobileSession from "@/components/mobile/MobileSession";
import MobileManual from "@/components/mobile/MobileManual";
import MobileSettings from "@/components/mobile/MobileSettings";
import MobileCrisis from "@/components/mobile/MobileCrisis";
import SessionDrawer from "@/components/mobile/SessionDrawer";
import SWUpdatePrompt from "@/components/shared/SWUpdatePrompt";
import PostLoginOnboarding from "@/components/onboarding/PostLoginOnboarding";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { trackManualViewed } from "@/lib/analytics/events";

const MANUAL_LAST_VIEW_KEY = "mw_last_manual_view";

type ExplorationPhase = "transitioning" | "loading" | "revealing" | null;
type OnboardingStatus = "loading" | "needed" | "complete";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MainApp() {
  const [activeView, setActiveView] = useState<MobileView>("session");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explorationPhase, setExplorationPhase] = useState<ExplorationPhase>(null);
  const [explorationLabel, setExplorationLabel] = useState("");
  const [authDismissed, setAuthDismissed] = useState(false);
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("loading");
  // Onboarding modal state. null = not loaded yet (modals suppressed
  // until known so we never flash). Track A Gate 4.
  const [modalState, setModalState] = useState<{
    modalProgress: number;
    signupAtMs: number | null;
    isAnonymous: boolean;
  } | null>(null);
  const { updateAvailable, applyUpdate } = useServiceWorker();

  // One-time migration: rename mantle_* localStorage keys to mw_*
  useEffect(() => {
    if (localStorage.getItem("mw_keys_migrated")) return;
    const renames: [string, string][] = [
      ["mantle_pending_conversion", "mw_pending_conversion"],
      ["mantle_first_session_completed", "mw_first_session_completed"],
      ["mantle_signin_banner_dismissed", "mw_signin_banner_dismissed"],
      ["mantle_manual_intro_seen", "mw_manual_intro_seen"],
    ];
    for (const [oldKey, newKey] of renames) {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
    localStorage.setItem("mw_keys_migrated", "1");
  }, []);

  // Clean up post-OAuth conversion flag
  useEffect(() => {
    if (localStorage.getItem("mw_pending_conversion") === "true") {
      localStorage.removeItem("mw_pending_conversion");
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

  // Modal-progress fetch — mirrors onboarding-status pattern. Fail-open
  // here means "leave modalState null" so no modal ever fires; that's
  // the safer default than re-prompting onboarding modals on every
  // transient API hiccup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/modal-progress");
        if (!res.ok) {
          console.error(
            "[MainApp] modal-progress returned",
            res.status,
            "— modals suppressed for this session"
          );
          return;
        }
        const data = (await res.json()) as {
          modal_progress: number;
          signup_at_ms: number | null;
          is_anonymous: boolean;
        };
        if (cancelled) return;
        setModalState({
          modalProgress: data.modal_progress,
          signupAtMs: data.signup_at_ms,
          isAnonymous: data.is_anonymous,
        });
      } catch (err) {
        console.error("[MainApp] modal-progress fetch failed:", err);
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
    confirmedEntries,
    firstName,
    initialized,
    userEmail,
    errorMessage,
    checkpointError,
    conversations,
    isGuest,
    promptAuth,
    resetPromptAuth,
    sendMessage,
    sendChipResponse,
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    loadConversation,
    startNewSession,
    startExploration,
    startGuidedIntake,
    startUpload,
    refreshConversations,
    loadManual,
    updateEntry,
    emergingPatternSnippet,
    hasLayerEmergingOrBeyond,
    concreteExamples,
  } = useChat();

  // When promptAuth fires, clear any previous dismiss so modal shows
  useEffect(() => {
    if (promptAuth) setAuthDismissed(false);
  }, [promptAuth]);

  // Fire manual_viewed when the user lands on the manual tab. Days-since
  // is a rough retention signal computed from a localStorage timestamp —
  // no server round-trip; PostHog can aggregate visit counts itself.
  //
  // Effect depends only on activeView so the event fires once per tab visit,
  // not on every entry-add while the tab is open. entry_count is read at fire
  // time via a ref to avoid the stale-closure problem.
  const entryCountRef = useRef(confirmedEntries.length);
  entryCountRef.current = confirmedEntries.length;
  useEffect(() => {
    if (activeView !== "manual") return;
    const stored = localStorage.getItem(MANUAL_LAST_VIEW_KEY);
    const now = Date.now();
    const daysSinceLastView = stored
      ? Math.max(0, Math.round((now - Number(stored)) / (1000 * 60 * 60 * 24)))
      : null;
    trackManualViewed({
      entry_count: entryCountRef.current,
      days_since_last_view: daysSinceLastView,
    });
    localStorage.setItem(MANUAL_LAST_VIEW_KEY, String(now));
  }, [activeView]);

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

  const handleExploreWithPersona = useCallback(async (context: ExplorationContext) => {
    setExplorationLabel(context.name || context.layerName);

    // Phase 1: Fade in interstitial
    setExplorationPhase("transitioning");
    await sleep(250);

    // Phase 2: Kick off API call (non-blocking — stream runs in background)
    setExplorationPhase("loading");
    await startExploration(context);

    // Brief pause on interstitial for the "moment of pause" feel
    await sleep(800);

    // Phase 3: Switch to session (thinking dots will be visible), fade out interstitial
    setActiveView("session");
    setExplorationPhase("revealing");
    await sleep(350);

    // Done — session is showing with thinking dots while Jove generates
    setExplorationPhase(null);
  }, [startExploration]);

  const handleSimulationEvent = useCallback((type: string, conversationId: string) => {
    loadConversation(conversationId);
    if (type === "start") {
      setActiveView("session");
    }
  }, [loadConversation]);

  // Bridge events from the desktop DevToolsPanel (which lives outside this
  // component tree, in DesktopVitrine) back into the in-frame app so
  // populate refreshes the manual + navigates to it, and simulate switches
  // to the simulated session.
  useEffect(() => {
    function onPopulate() {
      loadManual();
      setActiveView("manual");
    }
    function onSimulation(e: Event) {
      const detail = (e as CustomEvent<{ type: string; conversationId: string }>).detail;
      if (!detail?.conversationId) return;
      handleSimulationEvent(detail.type, detail.conversationId);
    }
    window.addEventListener("dev-tools:populate-complete", onPopulate);
    window.addEventListener("dev-tools:simulation-event", onSimulation);
    return () => {
      window.removeEventListener("dev-tools:populate-complete", onPopulate);
      window.removeEventListener("dev-tools:simulation-event", onSimulation);
    };
  }, [loadManual, handleSimulationEvent]);

  const handleOpenDrawer = useCallback(async () => {
    setDrawerOpen(true);
    await refreshConversations();
  }, [refreshConversations]);

  // Swipe-from-left-edge to open the drawer. Standard mobile gesture —
  // touchstart within 24px of the left edge, then a horizontal swipe of
  // 60px+ that's clearly horizontal (dx > 1.5 * dy) opens the drawer.
  // Only active when the drawer is closed; doesn't fight scrolling.
  useEffect(() => {
    if (drawerOpen) return;
    let startX = 0;
    let startY = 0;
    let armed = false;
    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t || t.clientX > 24) return;
      startX = t.clientX;
      startY = t.clientY;
      armed = true;
    }
    function onMove(e: TouchEvent) {
      if (!armed) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 60 && dx > dy * 1.5) {
        armed = false;
        handleOpenDrawer();
      } else if (dy > 30) {
        // Vertical scroll wins — disarm so we don't fire mid-scroll.
        armed = false;
      }
    }
    function onEnd() {
      armed = false;
    }
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [drawerOpen, handleOpenDrawer]);

  const handleNavigateToManual = useCallback(() => {
    setActiveView("manual");
  }, []);

  const handleNavigateToSettings = useCallback(() => {
    setActiveView("settings");
  }, []);

  const handleNavigateToCrisis = useCallback(() => {
    setActiveView("crisis");
  }, []);

  // Wraps the chat-state reset so the user always lands on the session
  // view after starting fresh. Without the view switch, tapping
  // "+ New session" from Manual or Settings reset state but stranded
  // the user on the wrong panel — they thought the button was broken.
  const handleNewSession = useCallback(() => {
    setActiveView("session");
    startNewSession();
  }, [startNewSession]);

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
        activeView={activeView}
        hasActiveCheckpoint={activeCheckpoint !== null}
        sessionContent={
          <MobileSession
            messages={messages}
            conversationId={conversationId}
            isLoading={isLoading}
            isStreaming={isStreaming}
            confirmedEntries={confirmedEntries}
            activeCheckpoint={activeCheckpoint}
            checkpointError={checkpointError}
            errorMessage={errorMessage}
            sendMessage={sendMessage}
            sendChipResponse={sendChipResponse}
            retryLastMessage={retryLastMessage}
            confirmCheckpoint={confirmCheckpoint}
            startGuidedIntake={startGuidedIntake}
            startUpload={startUpload}
            isGuest={isGuest}
            onSignInPrompt={handleSignInPrompt}
            modalProgress={modalState?.modalProgress ?? null}
            signupAtMs={modalState?.signupAtMs ?? null}
            isAnonymous={modalState?.isAnonymous ?? false}
            emergingPatternSnippet={emergingPatternSnippet}
            hasLayerEmergingOrBeyond={hasLayerEmergingOrBeyond}
            concreteExamples={concreteExamples}
            firstName={firstName}
            onOpenDrawer={handleOpenDrawer}
          />
        }
        manualContent={
          <MobileManual
            entries={confirmedEntries}
            firstName={firstName}
            onExploreWithPersona={handleExploreWithPersona}
            onUpdateEntry={updateEntry}
            onNavigateToSession={() => setActiveView("session")}
            onOpenDrawer={handleOpenDrawer}
          />
        }
        settingsContent={
          <MobileSettings
            userEmail={userEmail}
            isActive={activeView === "settings"}
            onSimulationEvent={handleSimulationEvent}
            onPopulateComplete={loadManual}
            onOpenDrawer={handleOpenDrawer}
            onNavigateToSession={() => setActiveView("session")}
          />
        }
        crisisContent={
          <MobileCrisis
            onNavigateToSession={() => setActiveView("session")}
            onOpenDrawer={handleOpenDrawer}
          />
        }
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        activeView={activeView}
        manualEntryCount={confirmedEntries.length}
        onSelectSession={switchConversation}
        onNewSession={handleNewSession}
        onNavigateToManual={handleNavigateToManual}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToCrisis={handleNavigateToCrisis}
        onLogout={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
      />

      {/* Exploration interstitial overlay */}
      {explorationPhase !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Loading exploration"
          aria-live="polite"
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
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, var(--session-persona-soft) 0%, var(--session-persona-tint) 40%, transparent 70%)",
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
              animation: "mwFadeIn 0.5s ease-out both",
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
                animation: "mwFadeIn 0.7s ease-out 0.15s both",
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
