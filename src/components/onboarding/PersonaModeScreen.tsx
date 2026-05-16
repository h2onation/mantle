"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PersonaMode } from "@/lib/persona/system-prompt";
import { togglePersonaMode } from "@/lib/persona/persona-mode-toggle";
import TopBar from "@/components/shared/TopBar";

interface PersonaModeScreenProps {
  onContinue: () => void;
  onBack?: () => void;
}

const OPTIONS: { value: PersonaMode; label: string; description: string }[] = [
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
  {
    value: "general",
    label: "General",
    description:
      "Direct and warm. Same depth, same conversation. No neurotype-specific framing.",
  },
];

export default function PersonaModeScreen({
  onContinue,
  onBack,
}: PersonaModeScreenProps) {
  const [selected, setSelected] = useState<PersonaMode[]>(["autistic"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggle(mode: PersonaMode) {
    setSelected((prev) => togglePersonaMode(prev, mode));
  }

  async function handleContinue() {
    if (submitting || selected.length === 0) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ persona_modes: selected })
        .eq("id", userData.user.id);

      if (updateError) {
        console.error("[PersonaModeScreen] profile update failed:", updateError);
        setError("Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
    }

    onContinue();
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <TopBar onBack={onBack} />

      {/* Scrollable middle — TopBar above stays pinned, Continue footer
          below stays pinned. min-height:0 lets this flex child shrink
          below content size so overflow-y: auto actually kicks in (the
          default min-height: auto on a flex child blocks shrinking and
          is exactly what made the persona plate clip on short screens). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
      <div
        style={{
          margin: "32px 18px 0",
          padding: "26px 24px 24px",
          borderRadius: 18,
          background: "var(--session-walnut-surface)",
          border: "1px solid var(--session-bubble-border)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "var(--session-plate-shadow)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          Voice
        </p>
        <h2
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
          }}
        >
          How should Jove talk to you
          <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>
            ?
          </span>
        </h2>
        <p
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15,
            lineHeight: 1.62,
            color: "var(--session-ink-soft)",
            letterSpacing: "-0.05px",
          }}
        >
          Pick all that apply. This shapes how Jove writes and what it pays
          attention to. You can change it later in settings.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 22,
          }}
        >
          {OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "block",
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: isSelected
                    ? "1.5px solid var(--session-walnut)"
                    : "1.5px solid var(--session-walnut-border)",
                  background: isSelected
                    ? "var(--session-walnut-surface)"
                    : "transparent",
                  transition: "all 0.2s ease",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: isSelected
                        ? "none"
                        : "1.5px solid var(--session-walnut-border)",
                      backgroundColor: isSelected
                        ? "var(--session-walnut)"
                        : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="var(--session-cream)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--session-ink)",
                    }}
                  >
                    {opt.label}
                  </span>
                </div>
                <p
                  style={{
                    margin: "8px 0 0 28px",
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: "var(--session-ink-mid)",
                  }}
                >
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--session-error)",
            margin: "12px 24px 0",
          }}
        >
          {error}
        </p>
      )}

      {/* bottom breathing room inside the scroll surface so the last
          option doesn't sit flush against the pinned footer */}
      <div style={{ height: 32 }} />
      </div>

      <div
        style={{
          padding: "16px 24px 0",
          paddingBottom: "calc(36px + env(safe-area-inset-bottom, 0px))",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleContinue}
          disabled={submitting || selected.length === 0}
          style={{
            all: "unset",
            cursor: submitting || selected.length === 0 ? "default" : "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 0",
            borderBottom: "1px solid var(--session-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "var(--session-ink)",
            opacity: submitting || selected.length === 0 ? 0.6 : 1,
            transition: "all 0.3s ease",
            boxSizing: "border-box",
          }}
        >
          <span>{submitting ? "Saving..." : "Continue"}</span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      </div>
    </main>
  );
}
