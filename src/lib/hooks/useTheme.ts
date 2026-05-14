"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mywalnut.theme";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface UseThemeReturn {
  /** What the user picked. "system" means follow OS preference. */
  theme: ThemeChoice;
  /** What's actually displayed. Always concrete — never "system". */
  resolved: ResolvedTheme;
  setTheme: (t: ThemeChoice) => void;
}

function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage can throw in private mode / disabled storage; fall through.
  }
  return "system";
}

function systemPrefersLight(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

// Sync the document with the resolved theme. Handles both the
// data-theme attribute (CSS driver) and the meta theme-color tag
// (PWA status bar). The FOUC inline script in layout.tsx covers
// the very-first paint; this keeps things in sync afterward.
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  const color = resolved === "light" ? "#E5D8BE" : "#0A0B10";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", color);
  }
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [systemLight, setSystemLight] = useState(false);

  // Initialize on mount: pull persisted choice and current system pref.
  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemLight(systemPrefersLight());
  }, []);

  // Watch system preference changes. Only impacts rendering when
  // theme === "system"; harmless to track always.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      // Safari <14 fallback.
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, []);

  const resolved: ResolvedTheme =
    theme !== "system" ? theme : systemLight ? "light" : "dark";

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback((t: ThemeChoice) => {
    try {
      if (t === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, t);
      }
    } catch {
      // Persistence is best-effort; the in-memory state still updates.
    }
    setThemeState(t);
  }, []);

  return { theme, resolved, setTheme };
}
