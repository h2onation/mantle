"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal initializer. Renders nothing; on mount it observes every
 * `.mw-landing .reveal` element and adds `shown` as it scrolls into view.
 * Under prefers-reduced-motion (or no IntersectionObserver) it reveals
 * everything immediately. A <noscript> fallback in the page keeps content
 * visible when JS is disabled.
 */
export default function RevealInit() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".mw-landing .reveal")
    );
    if (els.length === 0) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("shown"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("shown");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
