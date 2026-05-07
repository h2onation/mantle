"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "mw-theme";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function getResolvedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const pref = getStoredPreference();
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: "light" | "dark") {
  const html = document.documentElement;
  const pref = getStoredPreference();
  if (pref === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", pref);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#15110C" : "#FAF7F0");
  }
}

let listeners: Array<() => void> = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function notify() {
  applyTheme(getResolvedTheme());
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", notify);
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    getStoredPreference,
    () => "system" as ThemePreference,
  );

  const resolved = useSyncExternalStore(
    subscribe,
    getResolvedTheme,
    () => "light" as const,
  );

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((pref: ThemePreference) => {
    if (pref === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
    notify();
  }, []);

  return { preference, resolved, setPreference };
}
