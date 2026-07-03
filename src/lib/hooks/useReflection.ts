"use client";

import { useCallback, useState, type RefObject } from "react";

// Imperative handle the session view exposes so the reflection surface —
// which can live on EITHER the mobile header (inside MobileSession) or the
// desktop RoomHeader (a sibling of MobileSession in DesktopShell) — can drive
// the one CheckpointOverlay without lifting its state. The overlay stays
// byte-for-byte local to MobileSession; this just opens it and composes.
export interface ReflectionSessionHandle {
  // Opens the overlay in its building state, composes the reflection on
  // demand, and fills it in place. Returns the compose status. No-op guard
  // lives on onBuild, not here.
  composeAndOpenOverlay: () => Promise<"ok" | "blocked" | "error" | "noop">;
}

// The reflection UI state both headers consume. Passed to the desktop
// RoomHeader (via DesktopShell) as one object; MobileSession takes the same
// fields as individual props.
export interface ReflectionSurface {
  meterVisible: boolean;
  fill: number;
  ready: boolean;
  composing: boolean;
  showEducation: boolean;
  onBuild: () => void;
  onDismissEducation: () => void;
}

interface UseReflectionArgs {
  // Server-computed capture-progress fill (null = meter hidden: gate off/crisis).
  fill: number | null;
  ready: boolean;
  // Anonymous-auth users skip the one-time education (they convert at first
  // checkpoint), mirroring the pre-lift behaviour.
  isAnonymous: boolean;
  // Compose is blocked while a turn is in flight; both come from useChat,
  // already above the session view.
  isLoading: boolean;
  isStreaming: boolean;
  // False when composeReflection is absent (gate off) — nothing to build.
  hasComposer: boolean;
  sessionRef: RefObject<ReflectionSessionHandle | null>;
}

// Single source of truth for the reflection surface's UI state. Owns the
// composing flag and the one-time education (per-device localStorage), derives
// showEducation once, and exposes onBuild. Both the mobile header and the
// desktop RoomHeader consume this so the treatment is identical and the
// decision logic is never duplicated. Introduced 2026-07-03 to bring the
// deep-field reflection header to the desktop shell.
export function useReflection({
  fill,
  ready,
  isAnonymous,
  isLoading,
  isStreaming,
  hasComposer,
  sessionRef,
}: UseReflectionArgs) {
  // `composing` = a compose request is in flight after the user taps build.
  // Owned here (not in MobileSession) so both headers reflect it; passed back
  // down as a prop to drive the overlay's `loading` too — one flag, no second
  // boolean.
  const [composing, setComposing] = useState(false);

  // One-time education. Per-device (localStorage). SSR-safe: returns "seen"
  // on the server so the education line never flashes before hydration.
  const [introSeen, setIntroSeen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mw_reflection_intro_seen") === "1";
  });
  const dismissEducation = useCallback(() => {
    try {
      localStorage.setItem("mw_reflection_intro_seen", "1");
    } catch {
      // Private-mode / storage-disabled: it simply re-shows next ready.
    }
    setIntroSeen(true);
  }, []);

  const meterVisible = fill !== null;
  const displayFill = fill ?? 0;

  // Computed ONCE here; both headers receive the boolean.
  const showEducation =
    meterVisible && ready && !composing && !introSeen && !isAnonymous;

  const onBuild = useCallback(async () => {
    // Re-entry + in-flight guard (a double-tap can't fire two composes).
    if (composing || isLoading || isStreaming || !hasComposer) return;
    const handle = sessionRef.current;
    if (!handle) return;
    // Building implies acknowledgement — mark the education seen so it won't
    // re-show on later readys.
    dismissEducation();
    setComposing(true);
    try {
      await handle.composeAndOpenOverlay();
    } finally {
      // Always clear, even if the handle went null mid-flight — never stuck.
      setComposing(false);
    }
  }, [
    composing,
    isLoading,
    isStreaming,
    hasComposer,
    sessionRef,
    dismissEducation,
  ]);

  return {
    meterVisible,
    displayFill,
    ready,
    composing,
    showEducation,
    onBuild,
    onDismissEducation: dismissEducation,
  };
}
