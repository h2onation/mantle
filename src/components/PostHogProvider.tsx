"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, posthog } from "@/lib/analytics/posthog-client";

// Pageview tracking lives in its own component so the Suspense boundary
// only wraps the hooks that need it. Root-layout usage of useSearchParams
// requires a Suspense boundary in Next.js 14.
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      posthog.capture("$pageview", { path: pathname });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    async function identify() {
      try {
        const res = await fetch("/api/analytics/identity");
        if (!res.ok) return;
        const { hashedId, properties } = await res.json();
        if (hashedId) {
          posthog.identify(hashedId, properties);
        }
      } catch (err) {
        console.warn("PostHog identify failed:", err);
      }
    }
    identify();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </>
  );
}
