import type { Config } from "tailwindcss";

/**
 * Linen Design System — Tailwind projection.
 *
 * Token source of truth lives in `src/app/globals.css` as `--session-*` CSS
 * variables. This config projects those variables into Tailwind utility names,
 * dropping the `session-` prefix at the utility surface so components can
 * write `bg-linen` / `text-ink-soft` / `font-persona` instead of reading
 * CSS variables inline.
 *
 * Rules:
 *   - No new tokens introduced here. Every value points at an existing var.
 *   - Token names (the CSS var names) stay unchanged in globals.css.
 *   - Utility names intentionally shorter; the prefix was inherited from an
 *     earlier narrower context and is friction at the call site.
 *   - Two naming quirks accepted as tech debt: `border-persona-border` and
 *     `text-error-text` read redundantly because the CSS var names encode
 *     intent-of-use. Revisit if they grate in real use. See decisions.md.
 *
 * What is NOT projected, and why:
 *   - spacing, borderRadius, boxShadow, animation: no named tokens for these
 *     exist yet. Each is a design decision due in a later step.
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

        // Ink hierarchy.
        // NOTE: `text-ink` is the body default (darkest value, #1A1614),
        // not a strongest-emphasis variant. The Linen palette calibrates the
        // darkest carbon ink to sit correctly on warm linen as primary text.
        // Softer ink values are specific opinionated choices for specific
        // roles (persona voice, user message weight), not a weight spectrum.
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

        // Sage / persona accent
        persona: {
          DEFAULT: "var(--session-persona)",
          soft:    "var(--session-persona-soft)",
          muted:   "var(--session-persona-muted)",
          border:  "var(--session-persona-border)",
          tint:    "var(--session-persona-tint)",
        },

        // Error
        error: {
          DEFAULT: "var(--session-error)",
          ghost:   "var(--session-error-ghost)",
          text:    "var(--session-error-text)",
          banner:  "var(--session-error-banner)",
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
        // Overrides Tailwind defaults: `font-sans`, `font-serif`, `font-mono`
        // resolve to our project faces rather than system stacks.
        serif:   ["var(--font-serif)"],
        sans:    ["var(--font-sans)"],
        persona: ["var(--font-persona)"],
        mono:    ["var(--font-mono)"],
      },

      fontSize: {
        // Bare sizes without bundled line-heights — matches the --size-*
        // vars in globals.css, which deliberately leave line-height as a
        // per-component decision.
        meta:    "var(--size-meta)",
        body:    "var(--size-body)",
        prose:   "var(--size-prose)",
        heading: "var(--size-heading)",
      },
    },
  },
  plugins: [],
};

export default config;
