"use client";

import { useTheme } from "@/lib/hooks/useTheme";

// Mounted once in layout.tsx body. Doesn't render anything; it exists
// to instantiate useTheme so the document stays in sync with the
// user's theme choice (and with system pref changes when theme is
// "system"). The FOUC-safe inline script in <head> handles the very-
// first paint; this component owns the lifecycle afterward.
export default function ThemeInit() {
  useTheme();
  return null;
}
