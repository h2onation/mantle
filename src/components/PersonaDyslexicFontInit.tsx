"use client";

import { usePersonaDyslexicFont } from "@/lib/hooks/usePersonaDyslexicFont";

// Mounted once in layout.tsx body. Doesn't render anything; it exists
// to run usePersonaDyslexicFont so the document's data-persona-dyslexic
// attribute stays in sync with the user's persona_modes. The FOUC inline
// script in <head> handles the very-first paint; this component owns
// reconciliation against the authoritative Supabase value afterward.
export default function PersonaDyslexicFontInit() {
  usePersonaDyslexicFont();
  return null;
}
