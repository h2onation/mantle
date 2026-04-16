// Browser-side PostHog client.
// autocapture is explicitly OFF — we manually capture specific events
// because user-authored text (messages, manual entries) must never
// leak into event properties.

"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    // Replay stays off until PR 2 wires data-ph-mask on chat and manual
    // surfaces. Remove this line when masking lands.
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    respect_dnt: true,
    persistence: "localStorage+cookie",
  });

  initialized = true;
}

export { posthog };
