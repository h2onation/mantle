"use client";

import { useTheme, type ThemeChoice } from "@/lib/hooks/useTheme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Three-state segmented control for the Appearance row in Settings.
// Reads/writes via useTheme; persists to localStorage automatically.
export default function AppearanceToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      style={{
        display: "flex",
        alignItems: "stretch",
        padding: 3,
        borderRadius: 999,
        background: "var(--session-walnut-surface-soft)",
        border: "1px solid var(--session-walnut-border-soft)",
      }}
    >
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={isActive}
            style={{
              all: "unset",
              flex: 1,
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 999,
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              color: isActive
                ? "var(--session-ink)"
                : "var(--session-ink-mid)",
              background: isActive
                ? "var(--session-walnut-surface)"
                : "transparent",
              boxShadow: isActive ? "var(--session-card-shadow, none)" : "none",
              transition: "color 0.18s ease, background 0.18s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
