// Browser-side PostHog client.
// autocapture is explicitly OFF — we manually capture specific events
// because user-authored text (messages, manual entries) must never
// leak into event properties.
//
// Session recording is permanently OFF. Mywalnut is a deep personal-
// disclosure product; recording user screens crosses a trust line
// that analytics events never do. Belt-and-suspenders: project-level
// recording is also disabled in PostHog Settings → Recordings, so an
// accidental client-side config change still captures nothing.

"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      // Feature flags + the /decide endpoint are unused here. Disabling
      // cuts one more request that would otherwise log a console error
      // if *.posthog.com is blocked (extension, network, PostHog down).
      advanced_disable_decide: true,
      respect_dnt: true,
      persistence: "localStorage+cookie",
    });
    initialized = true;
  } catch (err) {
    // posthog-js handles config-fetch failures internally, but a
    // synchronous init throw (however unlikely) must not crash the app.
    // Events and pageviews simply won't fire.
    console.warn("[posthog] init failed — analytics disabled for this session", err);
  }
}

export { posthog };
