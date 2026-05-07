import type { Config } from "tailwindcss";

/**
 * Linen Design System (v2 — Quiet Journal) — Tailwind projection.
 *
 * Token source of truth lives in `src/app/globals.css` as CSS custom
 * properties. This config projects those variables into Tailwind utility
 * names, dropping prefixes at the utility surface so components can write
 * `bg-linen` / `text-ink-soft` / `font-persona` / `gap-sp-md` / `rounded-sm`.
 *
 * Rules:
 *   - No new tokens introduced here. Every value points at an existing var.
 *   - Token names (the CSS var names) stay unchanged in globals.css.
 *   - Utility names intentionally shorter than the var names.
 */

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        linen:     "var(--session-linen)",
        cream:     "var(--session-cream)",
        parchment: "var(--session-parchment)",

        // Ink hierarchy — role-based, not a weight spectrum.
        ink: {
          DEFAULT:  "var(--session-ink)",
          soft:     "var(--session-ink-soft)",
          persona:  "var(--session-ink-persona)",
          user:     "var(--session-ink-user)",
          mid:      "var(--session-ink-mid)",
          faded:    "var(--session-ink-faded)",
          ghost:    "var(--session-ink-ghost)",
          whisper:  "var(--session-ink-whisper)",
          hairline: "var(--session-ink-hairline)",
        },

        // Hair — border system, separate from ink text colors
        hair: {
          DEFAULT: "var(--session-hair)",
          soft:    "var(--session-hair-soft)",
        },

        // Sage / persona accent — the single accent
        persona: {
          DEFAULT: "var(--session-persona)",
          soft:    "var(--session-persona-soft)",
          muted:   "var(--session-persona-muted)",
          border:  "var(--session-persona-border)",
          tint:    "var(--session-persona-tint)",
        },

        // Error — oxblood
        error: {
          DEFAULT: "var(--session-error)",
          ghost:   "var(--session-error-ghost)",
          text:    "var(--session-error-text)",
          banner:  "var(--session-error-banner)",
        },

        // Warning — amber
        warning: {
          DEFAULT: "var(--session-warning)",
          soft:    "var(--session-warning-soft)",
        },

        // Overlays
        backdrop: {
          DEFAULT: "var(--session-backdrop)",
          heavy:   "var(--session-backdrop-heavy)",
        },

        // Gold glow (checkpoint moments, scroll fades)
        glow: {
          cp:     "var(--session-glow-cp)",
          scroll: "var(--session-glow-scroll)",
        },
      },

      fontFamily: {
        serif:   ["var(--font-serif)"],
        sans:    ["var(--font-sans)"],
        persona: ["var(--font-persona)"],
        mono:    ["var(--font-mono)"],
      },

      fontSize: {
        meta:    "var(--size-meta)",
        body:    "var(--size-body)",
        prose:   "var(--size-prose)",
        heading: "var(--size-heading)",
      },

      spacing: {
        "sp-hair":  "var(--sp-hair)",
        "sp-tight": "var(--sp-tight)",
        "sp-xs":    "var(--sp-xs)",
        "sp-sm":    "var(--sp-sm)",
        "sp-md":    "var(--sp-md)",
        "sp-lg":    "var(--sp-lg)",
        "sp-xl":    "var(--sp-xl)",
        "sp-xxl":   "var(--sp-xxl)",
      },

      borderRadius: {
        none:  "var(--radius-none)",
        xs:    "var(--radius-xs)",
        sm:    "var(--radius-sm)",
        pill:  "var(--radius-pill)",
      },

      boxShadow: {
        lift:   "var(--lift)",
        "lift-hi": "var(--lift-hi)",
      },
    },
  },
  plugins: [],
};

export default config;
