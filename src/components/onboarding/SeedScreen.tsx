"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PERSONA_NAME } from "@/lib/persona/config";

interface SeedScreenProps {
  // When provided, SeedScreen runs in post-login mode: instead of
  // creating an anonymous account, it writes onboarding_completed_at
  // on the existing authenticated user's profile and calls onComplete.
  // When omitted, the legacy anonymous-signup flow runs.
  onComplete?: () => void;
}

export default function SeedScreen({ onComplete }: SeedScreenProps = {}) {
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

    // Branch on auth state. Post-login flow (real beta user finishing
    // first-time onboarding) writes a timestamp to profiles. Legacy
    // anonymous flow (currently unreachable from the entry screen but
    // kept in place for follow-up cleanup) creates an anonymous account.
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

    // Reset first-session localStorage flags before creating a fresh
    // anonymous user. Otherwise a browser that previously completed a
    // first session will treat this brand-new anonymous user as returning
    // and skip the welcome block with chips.
    localStorage.removeItem("mw_first_session_completed");
    localStorage.removeItem("mw_signin_banner_dismissed");

    // Create anonymous auth session
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Wordmark (top center) */}
      <div
        style={{
          padding: "16px 0",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "15px",
          color: "var(--session-ink-faded)",
          paddingLeft: 15,
        }}
      >
        MYWALNUT
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 40px" }}>
        {/* Section label */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--session-persona)",
            marginBottom: 16,
          }}
        >
          BEFORE YOU START
        </div>

        {/* Body — 3 paragraphs */}
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--session-ink-mid)",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: "0 0 14px 0" }}>
            {PERSONA_NAME} is AI. It identifies patterns using published frameworks as a guide. It doesn&rsquo;t diagnose anything and it&rsquo;s not trying to fix how you work.
          </p>
          <p style={{ margin: "0 0 14px 0" }}>
            You&rsquo;re the authority on your own experience. Nothing goes in your manual unless you say it&rsquo;s accurate.
          </p>
          <p style={{ margin: 0 }}>
            Short answers are fine. &ldquo;I don&rsquo;t know&rdquo; is fine. You can leave and come back whenever.
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
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: ageConfirmed
                ? "none"
                : "1.5px solid var(--session-ink-whisper)",
              backgroundColor: ageConfirmed
                ? "var(--session-persona-soft)"
                : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            {ageConfirmed && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
            color: "var(--session-ink-ghost)",
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

        {/* Begin button */}
        <button
          onClick={handleSubmit}
          disabled={!isEnabled}
          style={{
            width: "100%",
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            color: isEnabled ? "var(--session-cream)" : "var(--session-ink-ghost)",
            backgroundColor: isEnabled
              ? "var(--session-persona)"
              : "var(--session-ink-hairline)",
            border: "none",
            borderRadius: 8,
            cursor: isEnabled ? "pointer" : "default",
            transition: "all 0.4s ease",
            marginBottom: 14,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Connecting..." : "Begin"}
        </button>

        {/* Legal footer */}
        <div
          style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 400,
            color: "var(--session-ink-ghost)",
            lineHeight: 1.6,
          }}
        >
          By continuing, you agree to the{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>
            Terms of Service
          </span>{" "}
          and{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>
            Privacy Policy
          </span>
          .
        </div>
      </div>
    </div>
  );
}
