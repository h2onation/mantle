"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PersonaMode } from "@/lib/persona/system-prompt";

// ---------------------------------------------------------------------------
// Dyslexic font swap — drives <html data-persona-dyslexic> from the user's
// persona_modes column. Mirrors the useTheme + ThemeInit pattern exactly:
//
//   1. The FOUC inline script in layout.tsx reads the localStorage cache and
//      sets the attribute before first paint, so there's no flash.
//   2. This hook (run once via PersonaDyslexicFontInit, mounted in layout)
//      fetches the authoritative value from Supabase on mount and reconciles
//      the cache + attribute with what the server actually says.
//   3. The picker calls applyDyslexicFont() right after a successful PATCH,
//      so toggles in Settings take effect synchronously with no reload.
//   4. Cross-tab sync rides on the storage event — when another tab updates
//      the cache, this tab re-applies.
//
// "Dyslexic" here means "dyslexic ∈ persona_modes" — when the user stacks
// e.g. ["autistic", "dyslexic"], the font swap still applies.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mywalnut.persona-dyslexic";
const HTML_ATTR = "data-persona-dyslexic";

/** Synchronously update localStorage + html attribute. Safe to call from
 *  anywhere — server-render guards on `document` and `localStorage`. */
export function applyDyslexicFont(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.setAttribute(HTML_ATTR, "true");
  } else {
    document.documentElement.removeAttribute(HTML_ATTR);
  }
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // localStorage can throw in private mode / disabled storage; the
    // attribute is the source of truth at runtime, so we don't fail.
  }
}

function readCachedDyslexic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Mount once via PersonaDyslexicFontInit in layout.tsx. Reconciles the
 *  localStorage cache against the authoritative server value and listens
 *  for cross-tab updates. */
export function usePersonaDyslexicFont(): void {
  // Reconcile against Supabase profile on mount. The FOUC script has
  // already applied the cached value before this runs, so any correction
  // here is an attribute flip rather than a flash of unstyled content.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          // Logged-out users get base typography. Clear stale cache.
          if (!cancelled && readCachedDyslexic()) applyDyslexicFont(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("persona_modes")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (error || cancelled) return;
        const modes = (data?.persona_modes as PersonaMode[] | null) ?? ["general"];
        applyDyslexicFont(modes.includes("dyslexic"));
      } catch {
        // Network/auth errors leave the cached value in place. The next
        // page load (or picker toggle) will reconcile.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-tab sync: another tab toggling dyslexic writes to localStorage,
  // which fires a storage event in this tab. Re-apply the attribute.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      applyDyslexicFont(e.newValue === "true");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
}
