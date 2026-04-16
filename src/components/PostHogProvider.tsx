"use client";

import { Suspense, useEffect, useState } from "react";
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
  // Gate pageview capture on identify resolution. Without this, the first
  // pageview of a session fires with the anonymous UUID before identify
  // completes, which breaks retention and cohort queries keyed on the
  // hashed distinct_id. The finally block is fail-open: if identify
  // errors or the user is anonymous (hashedId=null), we still unblock
  // pageview capture so baseline analytics keep flowing.
  const [identifyResolved, setIdentifyResolved] = useState(false);

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
      } finally {
        setIdentifyResolved(true);
      }
    }
    identify();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        {identifyResolved && <PageViewTracker />}
      </Suspense>
      {children}
    </>
  );
}
