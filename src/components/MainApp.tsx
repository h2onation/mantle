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
import DoorIntroModal from "@/components/modals/DoorIntroModal";
import type { DoorIntro } from "@/lib/persona/door-intros";
import { APP_COPY_DEFAULTS, type AppCopy } from "@/lib/persona/app-copy";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { trackManualViewed, trackModal1Shown } from "@/lib/analytics/events";

const MANUAL_LAST_VIEW_KEY = "mw_last_manual_view";

// Phase 3 landing flag. true = returning users land on Home; false restores
// the pre-redesign behavior of auto-resuming into the conversation on open.
// The one-line revert for the migration's riskiest change (the landing
// control-flow inversion).
const LAND_ON_HOME = true;

// Views a refresh may restore the user into (see the landing effect). Excludes
// transient/derived states; these are the real top-level destinations.
const RESTORABLE_VIEWS: MobileView[] = [
  "home",
  "session",
  "manual",
  "settings",
  "crisis",
];

// Default when no gates are passed (e.g. a test render): every entry door live.
// The real value comes from the /app server component, which reads the per-mode
// feature gates and hands it down so disabled doors render as "Coming soon".
const ALL_MODES_ENABLED: Record<ConversationMode, boolean> = {
  situation: true,
  "guided-intake": true,
  upload: true,
};

type ExplorationPhase = "transitioning" | "loading" | "revealing" | null;
type OnboardingStatus = "loading" | "needed" | "complete";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MainApp() {
  const isDesktop = useIsDesktop();
  const [activeView, setActiveView] = useState<MobileView>("session");
  // Which entry doors are live (per-mode conversation gates). Fetched on mount
  // from /api/onboarding-status (NOT read at server-render time — that value
  // gets frozen by the browser/Router cache and never reflects an admin gate
  // flip). Defaults to all-ON until the fetch resolves; fails open to all-ON.
  const [enabledModes, setEnabledModes] =
    useState<Record<ConversationMode, boolean>>(ALL_MODES_ENABLED);
  // Admin-editable onboarding/Home copy, fetched with the onboarding status
  // (same call). Defaults to the shipped copy until the fetch resolves and on
  // any error — so the screens always have text.
  const [appCopy, setAppCopy] = useState<AppCopy>(APP_COPY_DEFAULTS);
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
  // Per-door one-time intro. doorIntros/doorIntrosSeen load once from
  // /api/door-intros; pendingIntroMode is the door whose intro is currently
  // open (set when a first-time door is tapped, cleared on dismiss → the
  // conversation starts). Suppressed for anonymous-auth users.
  const [doorIntros, setDoorIntros] =
    useState<Record<ConversationMode, DoorIntro> | null>(null);
  const [doorIntrosSeen, setDoorIntrosSeen] = useState<string[] | null>(null);
  const [pendingIntroMode, setPendingIntroMode] =
    useState<ConversationMode | null>(null);
  // Holds the in-flight pre-start kicked off when a door's intro modal opens,
  // so the opener generates *behind* the modal instead of as a dead wait after
  // dismiss. Resolves true if the conversation actually started, false if
  // startConversation's in-flight guard skipped it — the dismiss handler reads
  // this to decide whether it must start one itself. See handleStartConversation.
  const preStartRef = useRef<Promise<boolean> | null>(null);
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
        // no-store so the per-mode door availability reflects a live admin
        // gate flip rather than a cached response.
        const res = await fetch("/api/onboarding-status", { cache: "no-store" });
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
        if (data.enabledModes) setEnabledModes(data.enabledModes);
        if (data.appCopy) setAppCopy(data.appCopy);
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

  // Per-door intro copy + which doors this user has already seen. Drives the
  // one-time "how this works" card shown the first time each door is opened.
  // Fail-open (leave null) so a fetch hiccup just means no intro this session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/door-intros");
        if (!res.ok) return;
        const data = (await res.json()) as {
          intros?: Record<ConversationMode, DoorIntro>;
          seen?: string[];
        };
        if (cancelled) return;
        setDoorIntros(data.intros ?? null);
        setDoorIntrosSeen(Array.isArray(data.seen) ? data.seen : []);
      } catch {
        // fail-open
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
    // Refresh-stays-put: if the user was already inside the app this tab,
    // return them to the view they were on (their conversation, the manual,
    // settings…) instead of bouncing them to Home. Only the first-of-tab
    // load (no saved view) falls through to the LAND_ON_HOME default.
    try {
      const savedView = sessionStorage.getItem("mw_active_view");
      if (savedView && RESTORABLE_VIEWS.includes(savedView as MobileView)) {
        setActiveView(savedView as MobileView);
        return;
      }
    } catch {}
    if (!LAND_ON_HOME) return;
    const midCheckpoint = activeCheckpoint !== null;
    const openerStreaming = conversationId !== null && messages.length === 0;
    if (!midCheckpoint && !openerStreaming) {
      setActiveView("home");
    }
    // One-shot snapshot at init; deps intentionally minimal so it never re-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  // Persist the active view so a refresh returns the user to it (see the
  // landing effect above). Only after init so we never store the pre-landing
  // default "session" and override the LAND_ON_HOME first-load decision.
  useEffect(() => {
    if (!landingDecided.current) return;
    try {
      sessionStorage.setItem("mw_active_view", activeView);
    } catch {}
  }, [activeView]);

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
      // Guard against a second tap landing while a door intro is mid-pre-start
      // (the ref is set synchronously below and cleared on dismiss). Rapid taps
      // are sequential events, so the second sees the first's ref and bails —
      // this closes the sub-frame double-start window the pre-warm would
      // otherwise open. (useChat's own in-flight guard reads React state and
      // can't catch a same-tick double-fire.)
      if (preStartRef.current) return;
      // First time this user opens this door (and not anonymous): show its
      // one-time "how this works" intro, then start the conversation when they
      // dismiss it. Otherwise go straight in.
      if (
        !modalState?.isAnonymous &&
        doorIntros &&
        doorIntrosSeen &&
        !doorIntrosSeen.includes(mode)
      ) {
        if (doorIntrosSeen.length === 0) {
          trackModal1Shown({
            time_since_signup_ms: modalState?.signupAtMs
              ? Date.now() - modalState.signupAtMs
              : 0,
          });
        }
        setPendingIntroMode(mode);
        // Pre-warm: start the conversation now, while the one-time intro modal
        // is on screen being read, so the opener generates *behind* it instead
        // of as a dead wait after dismiss. This matters most for guided-intake,
        // whose opener is a live model-generated tee-up — there's no fixed
        // string to emit instantly the way situation/upload openers do, so its
        // first-token latency is the worst. Every dismiss path (Got it /
        // Escape / backdrop) already commits to starting, so pre-starting can't
        // orphan a conversation the user backed out of. Stash the promise so
        // the dismiss handler can fall back to a real start if the in-flight
        // guard skipped this one.
        preStartRef.current = startConversation(mode);
        return;
      }
      setActiveView("session");
      void startConversation(mode);
    },
    [startConversation, doorIntros, doorIntrosSeen, modalState]
  );

  // "Got it" on a door's intro: mark it seen (optimistic + persist), advance
  // the onboarding modal chain on the user's first intro so the later
  // pattern-forming modal still fires, then start the deferred conversation.
  const handleDoorIntroDismiss = useCallback(() => {
    const mode = pendingIntroMode;
    setPendingIntroMode(null);
    if (!mode) return;
    const wasFirst = (doorIntrosSeen?.length ?? 0) === 0;
    setDoorIntrosSeen((prev) =>
      prev ? (prev.includes(mode) ? prev : [...prev, mode]) : [mode]
    );
    if (wasFirst) handleModalProgressAdvance(1);
    fetch("/api/door-intros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => {});
    // The conversation was pre-started when the modal opened — reveal it.
    // Only start one here as a fallback if that pre-start was skipped by the
    // in-flight guard (resolves false); a successful pre-start resolves true,
    // so this never double-starts.
    setActiveView("session");
    const pending = preStartRef.current;
    preStartRef.current = null;
    void Promise.resolve(pending).then((started) => {
      if (!started) void startConversation(mode);
    });
  }, [pendingIntroMode, doorIntrosSeen, handleModalProgressAdvance, startConversation]);

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
        appCopy={appCopy}
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
      onStartSituation={() => handleStartConversation("situation")}
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
      enabledModes={enabledModes}
      appCopy={appCopy}
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
      enabledModes={enabledModes}
      appCopy={appCopy}
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
          onNavigateToManual={handleNavigateToManual}
          onNavigateToSettings={handleNavigateToSettings}
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

      {/* One-time "how this works" intro, shown the first time a door opens. */}
      {pendingIntroMode && doorIntros && (
        <DoorIntroModal
          open
          eyebrow={doorIntros[pendingIntroMode].eyebrow}
          title={doorIntros[pendingIntroMode].title}
          body={doorIntros[pendingIntroMode].body}
          onDismiss={handleDoorIntroDismiss}
        />
      )}
    </>
  );
}
