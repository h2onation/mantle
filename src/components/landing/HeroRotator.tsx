"use client";

import { useEffect, useRef } from "react";

// Half affirming strengths, half owned quirks — the spectrum of a self.
// Shuffled so the order differs every visit and reads like discovery,
// not a fixed loop.
const WORDS = [
  "creative", "honest", "tender", "deep", "curious", "precise",
  "perceptive", "loyal", "vivid", "original", "kind", "gentle",
  "thoughtful", "sharp", "brave", "bright",
  "weird", "spicy", "frustrating", "loud", "restless", "literal",
  "blunt", "scattered", "intense", "quiet", "stubborn", "wired",
  "prickly", "foggy", "tired", "busy",
];

function shuffle(a: string[]): string[] {
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

/**
 * The hero word that fills "my ___ walnut". Words stack in one grid cell and
 * crossfade — the new word blurs in while the old blurs out, overlapping, so
 * there is no snap and no blank gap. Imperative DOM (mirroring the source
 * mockup) because the overlap + forced reflow is more reliable than React
 * state churn for this effect. Respects prefers-reduced-motion.
 */
export default function HeroRotator() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let deck = shuffle(WORDS.slice());
    let i = 0;

    const makeWord = (word: string) => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = word;
      return span;
    };

    let current = makeWord(deck[0]);
    el.appendChild(current);
    // Force a reflow so the base (opacity:0, blur) styles commit before we
    // add "in" — more reliable than rAF in throttled/background tabs.
    void current.offsetWidth;
    current.classList.add("in");

    if (reduce) return;

    const id = window.setInterval(() => {
      i++;
      if (i >= deck.length) {
        const last = deck[deck.length - 1];
        deck = shuffle(WORDS.slice());
        if (deck[0] === last) deck.push(deck.shift() as string);
        i = 0;
      }
      const prev = current;
      const next = makeWord(deck[i]);
      el.appendChild(next);
      void next.offsetWidth;
      next.classList.add("in");
      prev.classList.remove("in");
      prev.classList.add("out");
      current = next;
      window.setTimeout(() => {
        if (prev.parentNode) prev.parentNode.removeChild(prev);
      }, 1000);
    }, 3200);

    return () => {
      window.clearInterval(id);
      el.innerHTML = "";
    };
  }, []);

  return <span className="rotator" aria-live="polite" ref={ref} />;
}
