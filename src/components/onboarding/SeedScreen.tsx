"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PERSONA_NAME } from "@/lib/persona/config";
import TopBar from "@/components/shared/TopBar";

interface SeedScreenProps {
  onComplete?: () => void;
  onBack?: () => void;
}

export default function SeedScreen({ onComplete, onBack }: SeedScreenProps = {}) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isEnabled = ageConfirmed && !submitting;

  async function handleSubmit() {
    if (!isEnabled) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (user) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) {
        console.error("[SeedScreen] profile update failed:", updateError);
        setError("Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      if (onComplete) {
        onComplete();
      } else {
        router.push("/app");
      }
      return;
    }

    localStorage.removeItem("mw_first_session_completed");
    localStorage.removeItem("mw_signin_banner_dismissed");

    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error("[SeedScreen] signInAnonymously failed:", authError);
      setError("Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    router.push("/app");
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

      {/* Content area — vertically centered in the available height.
          On mobile the phone-frame is the viewport, so this centers
          on the visible screen. On desktop the phone-frame is ~932px
          tall, so this prevents content falling to the bottom edge.
          min-height:0 + overflow-y:auto lets the area scroll when the
          checkbox + disclosure + CTA exceed the available height
          (short viewports, large system font, browser zoom). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 28px 40px",
        }}
      >
        <p
          style={{
            margin: "0 0 14px 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          Before you begin
        </p>

        <h2
          style={{
            margin: "0 0 16px",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
          }}
        >
          What this is, and isn&rsquo;t<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
        </h2>

        <div
          style={{
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.62,
            color: "var(--session-ink)",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: "0 0 14px 0" }}>
            {PERSONA_NAME} is AI. It helps you notice patterns in how you work, from what you actually say, in your own words. The things you confirm become entries in your Manual. You&rsquo;re the authority on how you work, and {PERSONA_NAME} isn&rsquo;t here to fix you.
          </p>
          <p style={{ margin: "0 0 14px 0", color: "var(--session-ink-soft)" }}>
            This isn&rsquo;t therapy, and {PERSONA_NAME} isn&rsquo;t a clinician. It&rsquo;s a complement to other support, not a replacement. If something serious comes up, Crisis Support is one tap away in the menu.
          </p>
          <p style={{ margin: 0 }}>
            Short answers are fine. &ldquo;I don&rsquo;t know&rdquo; is fine. Leave and come back whenever.
          </p>
        </div>

        {/* Age checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
            cursor: "pointer",
          }}
          onClick={() => setAgeConfirmed(!ageConfirmed)}
        >
          <div
            role="checkbox"
            aria-checked={ageConfirmed}
            aria-label="I'm 18 or older"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setAgeConfirmed(!ageConfirmed);
              }
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: ageConfirmed
                ? "none"
                : "1.5px solid var(--session-walnut-border)",
              backgroundColor: ageConfirmed
                ? "var(--session-walnut)"
                : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            {ageConfirmed && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7L6 10L11 4" stroke="var(--session-cream)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--session-ink-mid)",
            }}
          >
            I&rsquo;m 18 or older
          </span>
        </label>

        {/* Error message */}
        {error && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--session-error)",
              margin: "0 0 12px 0",
            }}
          >
            {error}
          </p>
        )}

        {/* Begin — TextBtn pattern */}
        <button
          onClick={handleSubmit}
          disabled={!isEnabled}
          style={{
            all: "unset",
            cursor: isEnabled ? "pointer" : "default",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 0",
            borderBottom: `1px solid ${isEnabled ? "var(--session-ink)" : "var(--session-walnut-border)"}`,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: isEnabled ? "var(--session-ink)" : "var(--session-ink-ghost)",
            opacity: submitting ? 0.6 : 1,
            transition: "all 0.3s ease",
            boxSizing: "border-box",
          }}
        >
          <span>{submitting ? "Connecting..." : "Begin"}</span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>

        {/* Legal footer */}
        <div
          style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            lineHeight: 1.6,
            marginTop: 18,
          }}
        >
          By continuing, you agree to the{" "}
          <a href="/terms" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}>
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </main>
  );
}
