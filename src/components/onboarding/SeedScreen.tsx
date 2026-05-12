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
        router.push("/");
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

    router.push("/");
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

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 40px" }}>
        <p
          style={{
            margin: "0 0 16px 0",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          Before you start
        </p>

        <div
          style={{
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.62,
            color: "var(--session-ink-mid)",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: "0 0 14px 0" }}>
            {PERSONA_NAME} is AI. It surfaces patterns using psychological frameworks. It doesn&rsquo;t diagnose, and it&rsquo;s not trying to fix how you work. You&rsquo;re the authority on your own experience.
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

        {/* Disclosure */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.6,
            color: "var(--session-ink-mid)",
            margin: "0 0 18px 0",
          }}
        >
          {PERSONA_NAME} is a great complement to therapy, coaching, or any work you&rsquo;re already doing on yourself. It&rsquo;s not a replacement for professional support.
        </p>

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
            borderBottom: `1px solid ${isEnabled ? "var(--session-ink)" : "var(--session-ink-whisper)"}`,
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
