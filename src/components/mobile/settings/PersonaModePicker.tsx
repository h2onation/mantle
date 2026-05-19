"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import { togglePersonaMode } from "@/lib/persona/persona-mode-toggle";

/**
 * Settings-page persona-mode picker. Reads the authed user's current
 * persona_modes on mount, renders the four options as toggleable rows,
 * and auto-saves via PATCH /api/user/persona-modes on every toggle.
 *
 * UX:
 *   - Optimistic update on toggle (local state flips instantly).
 *   - On 4xx/5xx response, revert local state to last known good and
 *     surface an inline error string.
 *   - "general" is exclusive — picking it clears any neurotype modes,
 *     picking a neurotype mode clears "general". Logic delegated to
 *     `togglePersonaMode`, the same util onboarding uses.
 *   - One-liner under the picker explains that changes apply to the
 *     next message rather than retroactively to in-flight turns.
 */

const OPTIONS: { value: PersonaMode; label: string; description: string }[] = [
  {
    value: "general",
    label: "General",
    description:
      "Direct and warm. Same depth, same conversation. No neurotype-specific framing.",
  },
  {
    value: "autistic",
    label: "Autistic",
    description:
      "Direct, body-aware, no therapy voice. Built for people who think in systems and are tired of being translated.",
  },
  {
    value: "audhd",
    label: "AuDHD",
    description:
      "For brains that need structure and resist it at the same time. Tracks the tension between both systems.",
  },
  {
    value: "dyslexic",
    label: "Dyslexic",
    description:
      "Concrete, visual, story-first. Built for people who see the big picture fast and build workarounds nobody else notices.",
  },
];

type LoadState =
  | { status: "loading" }
  | { status: "ready"; selected: PersonaMode[] }
  | { status: "error"; message: string };

export default function PersonaModePicker() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initial load — pull persona_modes from the user's profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (!cancelled) {
            setState({ status: "error", message: "Not signed in." });
          }
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("persona_modes")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (error) {
          console.error("[PersonaModePicker] load failed:", error);
          if (!cancelled) {
            setState({ status: "error", message: "Couldn't load your voice settings. Refresh and try again." });
          }
          return;
        }
        const loaded = (data?.persona_modes as PersonaMode[] | null) ?? ["general"];
        if (!cancelled) {
          setState({ status: "ready", selected: loaded });
        }
      } catch (err) {
        console.error("[PersonaModePicker] load threw:", err);
        if (!cancelled) {
          setState({ status: "error", message: "Couldn't load your voice settings. Refresh and try again." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(mode: PersonaMode) {
    if (state.status !== "ready") return;
    const prev = state.selected;
    const next = togglePersonaMode(prev, mode);
    if (next.length === 0) {
      // Deselect to empty is not a valid state — the picker enforces at
      // least one selection. Treat the toggle as a no-op rather than
      // saving an empty array and tripping the server validator.
      setSaveError("Pick at least one voice.");
      return;
    }

    // Optimistic update.
    setSaveError(null);
    setState({ status: "ready", selected: next });

    try {
      const res = await fetch("/api/user/persona-modes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_modes: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const message =
          body?.error || "Couldn't save your change. Try again.";
        setSaveError(message);
        setState({ status: "ready", selected: prev });
        return;
      }
    } catch (err) {
      console.error("[PersonaModePicker] save failed:", err);
      setSaveError("Lost the connection. Try again.");
      setState({ status: "ready", selected: prev });
    }
  }

  if (state.status === "loading") {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-ink-mid)",
          padding: "12px 0",
        }}
      >
        Loading…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--session-error-text)",
          padding: "12px 0",
        }}
      >
        {state.message}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map((opt) => {
          const isSelected = state.selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleToggle(opt.value)}
              aria-pressed={isSelected}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                backgroundColor: isSelected
                  ? "var(--session-persona-muted)"
                  : "var(--session-walnut-surface)",
                border: `1px solid ${
                  isSelected
                    ? "var(--session-persona-border)"
                    : "var(--session-walnut-border)"
                }`,
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left" as const,
                width: "100%",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  marginTop: 2,
                  border: `1.5px solid ${
                    isSelected
                      ? "var(--session-persona)"
                      : "var(--session-walnut-meta-strong)"
                  }`,
                  backgroundColor: isSelected
                    ? "var(--session-persona)"
                    : "transparent",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="var(--session-linen)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 15,
                    color: "var(--session-ink)",
                    lineHeight: 1.3,
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    color: "var(--session-ink-mid)",
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {opt.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--session-ink-mid)",
          fontStyle: "italic",
        }}
      >
        Changes apply to your next message.
      </p>

      {saveError ? (
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: "var(--session-error-text)",
          }}
        >
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
