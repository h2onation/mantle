"use client";

import SeedScreen from "./SeedScreen";
import type { AppCopy } from "@/lib/persona/app-copy";

// Single post-login consent screen (SeedScreen) for an already-authenticated
// user finishing first-time onboarding. SeedScreen runs in post-login mode
// (writes profiles.onboarding_completed_at instead of creating an anonymous
// account) and calls onComplete when done, which lets MainApp re-render into
// the normal app without a route push.
//
// Collapsed 2026-06-17 from the old InfoScreens -> PersonaModeScreen ->
// SeedScreen sequence: the "what this is, and isn't" prose merged into
// SeedScreen, and the persona-mode pick was dropped. The rebuilt voice does
// not render persona deltas, so the pick had no live effect; the pipeline
// defaults a null persona_modes to ["general"] (persona-pipeline.ts), and
// persona modes stay settable in Settings for when the ND layer returns.

interface PostLoginOnboardingProps {
  onComplete: () => void;
  // Admin-editable consent-screen copy, threaded down to SeedScreen.
  appCopy?: AppCopy;
}

export default function PostLoginOnboarding({
  onComplete,
  appCopy,
}: PostLoginOnboardingProps) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "430px",
        margin: "0 auto",
        height: "100dvh",
        background: "var(--session-linen)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <SeedScreen onComplete={onComplete} appCopy={appCopy} />
    </div>
  );
}
