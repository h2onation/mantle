"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SeedScreen() {
  const [text, setText] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const hasText = text.trim().length > 0;
  const isEnabled = hasText && ageConfirmed && !submitting;

  async function handleSubmit() {
    if (!isEnabled) return;
    setSubmitting(true);
    setError("");

    // Store seed text and flags
    sessionStorage.setItem("mantle_seed_text", text.trim());
    localStorage.setItem("mantle_age_confirmed", "true");
    localStorage.setItem("mantle_onboarding_completed", "true");

    // Create anonymous auth session
    const supabase = createClient();
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
        MANTLE
      </div>

      {/* Spacer pushes content to bottom */}
      <div style={{ flex: 1 }} />

      {/* Content area */}
      <div style={{ padding: "0 28px 40px" }}>
        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: "-0.3px",
            color: "var(--session-ink)",
            margin: "0 0 10px 0",
          }}
        >
          Start with the thing you keep thinking about but haven&apos;t said out loud.
        </h1>

        {/* Subhead */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.5,
            color: "var(--session-ink-mid)",
            margin: "0 0 20px 0",
          }}
        >
          It doesn&apos;t need to be the biggest thing. Just the one that won&apos;t leave you alone.
        </p>

        {/* Textarea container */}
        <div
          style={{
            border: "1px solid var(--session-ink-whisper)",
            borderRadius: 8,
            padding: 16,
            height: 120,
            backgroundColor: "rgba(255, 255, 255, 0.3)",
            marginBottom: 18,
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell me..."
            style={{
              width: "100%",
              height: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.6,
              color: "var(--session-ink)",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              padding: 0,
            }}
          />
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
                ? "var(--session-sage-soft)"
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
            I am 18 or older
          </span>
        </label>

        {/* Error message */}
        {error && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--color-error)",
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
              ? "var(--session-sage)"
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
          <div>
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
          <div style={{ marginTop: 4 }}>
            Sage is an AI. This is not therapy or mental health services.
          </div>
        </div>
      </div>
    </div>
  );
}
