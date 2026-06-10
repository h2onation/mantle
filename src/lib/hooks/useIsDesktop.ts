"use client";

import { useEffect, useState } from "react";

// Single desktop breakpoint for the authenticated app shell. 1030px
// matches the vitrine's existing wide-desktop boundary in globals.css
// (.mw-dev-tools, side-margin layout) so the two layout systems never
// disagree about which regime the viewport is in.
export const DESKTOP_BREAKPOINT = 1030;

// null = not yet measured (SSR / first client render). Callers gate
// rendering on it the same way they gate on useChat's `initialized`,
// so the user never sees the wrong shell flash during hydration.
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
