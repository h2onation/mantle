"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@/lib/hooks/useChat";
import type { ExplorationContext } from "@/lib/types";
import type { ConversationMode } from "@/lib/persona/config";
import MobileLayout, { type MobileView } from "@/components/layout/MobileLayout";
import DesktopShell from "@/components/desktop/DesktopShell";
import DesktopHome from "@/components/desktop/DesktopHome";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";
import { formatShortDate } from "@/lib/utils/format";
import AuthPromptModal from "@/components/onboarding/AuthPromptModal";
import MobileSession from "@/components/mobile/MobileSession";
import MobileManual from "@/components/mobile/MobileManual";
import MobileSettings from "@/components/mobile/MobileSettings";
import MobileCrisis from "@/components/mobile/MobileCrisis";
import MobileHome from "@/components/mobile/MobileHome";
import SWUpdatePrompt from "@/components/shared/SWUpdatePrompt";
import PostLoginOnboarding from "@/components/onboarding/PostLoginOnboarding";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { trackManualViewed } from "@/lib/analytics/events";

const MANUAL_LAST_VIEW_KEY = "mw_last_manual_view";

// Phase 3 landing flag. true = returning users land on Home; false restores
// the pre-redesign behavior of auto-resuming into the conversation on open.
// The one-line revert for the migration's riskiest change (the landing
// control-flow inversion).
const LAND_ON_HOME = true;

type ExplorationPhase = "transitioning" | "loading" | "revealing" | null;
type OnboardingStatus = "loading" | "needed" | "complete";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MainApp() {
  const isDesktop = useIsDesktop();
  const [activeView, setActiveView] = useState<MobileView>("session");
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
  // SeedScreen consent screen once before reaching the app. Fail
  // CLOSED on error — SeedScreen carries the age-gate + legal
  // acknowledgement, so silently skipping it on a transient API
  // hiccup would let a fresh signup bypass the compliance
  // disclaimers entirely and we'd have no record of consent. A
  // returning user caught in the rare case where the API errors
  // mid-session will see one extra Begin click — minor friction
  // vs. a real compliance hole.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding-status");
        if (!res.ok) {
          console.error(
            "[MainApp] onboarding-status returned",
            res.status,
            "— failing closed"
          );
          if (!cancelled) setOnboardingStatus("needed");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setOnboardingStatus(data.completed ? "complete" : "needed");
      } catch (err) {
        console.error("[MainApp] onboarding-status fetch failed:", err);
        if (!cancelled) setOnboardingStatus("needed");
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

  // Lift a modal-progress advance (from a dismissed onboarding modal) back into
  // modalState so the NEXT modal's gate sees the new value in the SAME session.
  // Without this the in-memory value stays at its mount reading and the modal
  // ladder (modal 2 following modal 1) only advances across a page reload.
  const handleModalProgressAdvance = useCallback((target: number) => {
    setModalState((prev) =>
      prev
        ? { ...prev, modalProgress: Math.max(prev.modalProgress, target) }
        : prev
    );
  }, []);

  const {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    composingCheckpoint,
    activeCheckpoint,
    confirmedEntries,
    firstName,
    initialized,
    sessionOrigin,
    userEmail,
    errorMessage,
    draftToRestore,
    clearDraftToRestore,
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
    startConversation,
    refreshConversations,
    loadManual,
    updateEntry,
    emergingPatternSnippet,
    hasLayerEmergingOrBeyond,
    concreteExamples,
    reflectionFill,
    reflectionReady,
    composeReflection,
  } = useChat();

  // When promptAuth fires, clear any previous dismiss so modal shows
  useEffect(() => {
    if (promptAuth) setAuthDismissed(false);
  }, [promptAuth]);

  // Landing decision. Everyone lands on Home — new and returning — except
  // anyone with a pending checkpoint or whose restored thread is still
  // streaming its opener (they drop straight into the conversation). Runs
  // once, after useChat finishes init.
  //
  // New users land on Home too (ADR-048 follow-up): Home is now the single
  // front-door launchpad — greeting + "ways to begin" + the empty Manual
  // index — replacing the retired in-session 3-card entry screen. This
  // updates ADR-047's original "first-run drops into a conversation" call;
  // the richer Jove-opener-with-chips first-run screen (first-run-plan.md)
  // stays the deferred replacement.
  const landingDecided = useRef(false);
  useEffect(() => {
    if (!initialized || landingDecided.current) return;
    landingDecided.current = true;
    if (!LAND_ON_HOME) return;
    const midCheckpoint = activeCheckpoint !== null;
    const openerStreaming = conversationId !== null && messages.length === 0;
    if (!midCheckpoint && !openerStreaming) {
      setActiveView("home");
    }
    // One-shot snapshot at init; deps intentionally minimal so it never re-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

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

  // Bridge events from the DevToolsPanel (hosted in the desktop sidebar
  // and the admin settings view) into the app so populate refreshes the
  // manual + navigates to it, and simulate switches to the simulated
  // session. Window events keep the panel location-independent.
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

  // Bottom-nav navigation. Landing on Home refreshes the conversation
  // list the way opening the drawer used to.
  const handleNavigate = useCallback(
    (view: MobileView) => {
      setActiveView(view);
      if (view === "home") void refreshConversations();
    },
    // refreshConversations gets a fresh identity each render (see the
    // desktop refresh effect below); depending on it would rebuild this
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Home's conversation starters — "Bring a situation" (primary) plus the
  // secondary Guided intake / Upload links. Starts a fresh conversation in
  // the chosen mode and drops the user into it. Generalizes the old
  // situation-only handler so all three entry modes stay reachable from
  // Home: Guided + Upload were otherwise orphaned for returning users once
  // the drawer's entry-cards path was retired in the front-door redesign.
  const handleStartConversation = useCallback(
    (mode: ConversationMode) => {
      setActiveView("session");
      void startConversation(mode);
    },
    [startConversation]
  );

  // Desktop sidebar is always visible, so keep its session list fresh
  // the way opening the drawer does on mobile. refreshConversations is
  // a plain function from useChat (new identity every render) — keeping
  // it out of the deps is load-bearing, or this effect re-runs on every
  // render and hammers /api/conversations in a loop.
  useEffect(() => {
    if (isDesktop) refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  // Picking a session (from Home's recent list or the desktop sidebar)
  // lands on the conversation view; re-picking the active session is
  // "back to the conversation" and shouldn't reload anything.
  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveView("session");
      if (id !== conversationId) switchConversation(id);
    },
    [conversationId, switchConversation]
  );

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  const handleNavigateToManual = useCallback(() => {
    setActiveView("manual");
  }, []);

  // Desktop Home destination. Refresh the session list on arrival, the way
  // the mobile bottom-nav home tap does (handleNavigate's home branch).
  const handleNavigateToHome = useCallback(() => {
    setActiveView("home");
    void refreshConversations();
    // refreshConversations has a fresh identity each render; keep it out of deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigateToSettings = useCallback(() => {
    setActiveView("settings");
  }, []);

  const handleNavigateToCrisis = useCallback(() => {
    setActiveView("crisis");
  }, []);

  // "+ New session" now lands on Home — the front-door launchpad with the
  // "ways to begin" — instead of the retired in-session 3-card entry screen.
  // Still resets chat state so the prior thread isn't left loaded underneath.
  const handleNewSession = useCallback(() => {
    setActiveView("home");
    startNewSession();
  }, [startNewSession]);

  // Only block render on useChat init. The onboarding-status check
  // is allowed to resolve in the background — if it comes back as
  // "needed" we swap in PostLoginOnboarding then. Blocking on the
  // status check turned the splash into a hard wall when the fetch
  // didn't resolve quickly enough on first paint.
  // isDesktop === null means the media query hasn't been measured yet
  // (first client render). Gating on it alongside `initialized` means
  // the user never sees the wrong shell flash during hydration — the
  // splash below is the same blank linen either way.
  if (!initialized || isDesktop === null) {
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

  // The four view nodes are built once and handed to whichever shell is
  // active. Desktop hides each view's TopBar (the room header replaces it).
  const sessionContent = (
    <MobileSession
      messages={messages}
      conversationId={conversationId}
      isLoading={isLoading}
      isStreaming={isStreaming}
      composingCheckpoint={composingCheckpoint}
      activeCheckpoint={activeCheckpoint}
      checkpointError={checkpointError}
      errorMessage={errorMessage}
      sendMessage={sendMessage}
      sendChipResponse={sendChipResponse}
      retryLastMessage={retryLastMessage}
      confirmCheckpoint={confirmCheckpoint}
      isGuest={isGuest}
      onSignInPrompt={handleSignInPrompt}
      modalProgress={modalState?.modalProgress ?? null}
      signupAtMs={modalState?.signupAtMs ?? null}
      isAnonymous={modalState?.isAnonymous ?? false}
      onModalProgressAdvance={handleModalProgressAdvance}
      emergingPatternSnippet={emergingPatternSnippet}
      hasLayerEmergingOrBeyond={hasLayerEmergingOrBeyond}
      concreteExamples={concreteExamples}
      reflectionFill={reflectionFill}
      reflectionReady={reflectionReady}
      composeReflection={composeReflection}
      scopedLabel={sessionOrigin === "explore" ? explorationLabel : null}
      draftToRestore={draftToRestore}
      onDraftRestored={clearDraftToRestore}
      showTopBar={!isDesktop}
    />
  );
  const manualContent = (
    <MobileManual
      entries={confirmedEntries}
      firstName={firstName}
      onExploreWithPersona={handleExploreWithPersona}
      onUpdateEntry={updateEntry}
      showTopBar={!isDesktop}
      isDesktop={!!isDesktop}
    />
  );
  const settingsContent = (
    <MobileSettings
      userEmail={userEmail}
      isActive={activeView === "settings"}
      onSimulationEvent={handleSimulationEvent}
      onPopulateComplete={loadManual}
      onNavigateToCrisis={handleNavigateToCrisis}
      showTopBar={!isDesktop}
    />
  );
  const crisisContent = (
    <MobileCrisis
      onNavigateToSession={() => setActiveView("session")}
      showTopBar={!isDesktop}
    />
  );
  const homeContent = (
    <MobileHome
      firstName={firstName}
      conversations={conversations}
      activeConversationId={conversationId}
      entries={confirmedEntries}
      onSelectSession={handleSelectSession}
      onStartConversation={handleStartConversation}
      onExploreWithPersona={handleExploreWithPersona}
      onNavigateToManual={handleNavigateToManual}
      showTopBar={!isDesktop}
    />
  );
  const desktopHomeContent = (
    <DesktopHome
      firstName={firstName}
      conversations={conversations}
      activeConversationId={conversationId}
      entries={confirmedEntries}
      onSelectSession={handleSelectSession}
      onStartConversation={handleStartConversation}
      onExploreWithPersona={handleExploreWithPersona}
      onNavigateToManual={handleNavigateToManual}
    />
  );

  const activeConversation =
    conversations.find((c) => c.id === conversationId) ?? null;
  const sessionTitle =
    activeConversation?.title || activeConversation?.preview || "New session";
  const sessionDate = formatShortDate(
    activeConversation?.updated_at ?? new Date().toISOString()
  );

  return (
    <>
      {isDesktop ? (
        <DesktopShell
          activeView={activeView}
          hasActiveCheckpoint={activeCheckpoint !== null}
          homeContent={desktopHomeContent}
          sessionContent={sessionContent}
          manualContent={manualContent}
          settingsContent={settingsContent}
          crisisContent={crisisContent}
          sessionTitle={sessionTitle}
          sessionDate={sessionDate}
          scopedLabel={sessionOrigin === "explore" ? explorationLabel : null}
          conversations={conversations}
          activeConversationId={conversationId}
          manualEntryCount={confirmedEntries.length}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onNavigateToHome={handleNavigateToHome}
          onNavigateToSession={() => setActiveView("session")}
          onNavigateToManual={handleNavigateToManual}
          onNavigateToSettings={handleNavigateToSettings}
          onNavigateToCrisis={handleNavigateToCrisis}
          onLogout={handleLogout}
        />
      ) : (
        <MobileLayout
          activeView={activeView}
          onNavigate={handleNavigate}
          hasActiveCheckpoint={activeCheckpoint !== null}
          homeContent={homeContent}
          sessionContent={sessionContent}
          manualContent={manualContent}
          settingsContent={settingsContent}
          crisisContent={crisisContent}
        />
      )}

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
