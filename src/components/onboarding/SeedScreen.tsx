"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GlowConfig } from "./AmbientGlow";

interface SeedScreenProps {
  onGlowChange: (config: GlowConfig) => void;
}

const BASE_GLOW: GlowConfig = { x: 55, y: 15, scale: 0.9, opacity: 0.14 };
const FOCUS_GLOW: GlowConfig = { x: 55, y: 15, scale: 0.9, opacity: 0.20 };

export default function SeedScreen({ onGlowChange }: SeedScreenProps) {
  const [text, setText] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const hasText = text.trim().length > 0;
  const isEnabled = hasText && ageConfirmed && !submitting;

  function handleFocus() {
    onGlowChange(FOCUS_GLOW);
  }

  function handleBlur() {
    onGlowChange(BASE_GLOW);
  }

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
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        height: "100%",
        padding: "72px 32px 24px",
        boxSizing: "border-box",
      }}
    >
      {/* Headline — no label above (intentional) */}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "24px",
          fontWeight: 400,
          lineHeight: 1.22,
          color: "var(--color-text)",
          margin: "0 0 14px 0",
        }}
      >
        Start with the thing you keep thinking about but haven&apos;t said out loud.
      </h1>

      {/* Body */}
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "14.5px",
          lineHeight: 1.75,
          color: "var(--color-text-dim)",
          margin: "0 0 28px 0",
        }}
      >
        It doesn&apos;t need to be the biggest thing. Just the one that won&apos;t leave you alone.
      </p>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Tell me..."
        style={{
          width: "100%",
          minHeight: "120px",
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          lineHeight: 1.75,
          color: "var(--color-text)",
          backgroundColor: "var(--color-input-bg)",
          border: "1px solid var(--color-divider)",
          borderRadius: "14px",
          padding: "16px",
          outline: "none",
          resize: "none",
          boxSizing: "border-box",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          fontStyle: text ? "normal" : "italic",
          overflow: "hidden",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--color-input-border-focus)";
          e.currentTarget.style.boxShadow = "0 0 40px var(--color-input-focus-glow)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--color-divider)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {/* Age checkbox */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "20px 0 28px 0",
          cursor: "pointer",
        }}
        onClick={() => setAgeConfirmed(!ageConfirmed)}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            border: ageConfirmed
              ? "1px solid var(--color-accent-dim)"
              : "1px solid var(--color-checkbox-border)",
            backgroundColor: ageConfirmed
              ? "var(--color-accent-glow)"
              : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
        >
          {ageConfirmed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--color-checkbox-check)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: "var(--color-text-dim)",
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
            fontSize: "13px",
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
          padding: "16px",
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 400,
          color: isEnabled ? "var(--color-void)" : "var(--color-btn-disabled-text)",
          backgroundColor: isEnabled
            ? "var(--color-accent-strong)"
            : "var(--color-btn-disabled-bg)",
          border: isEnabled
            ? "1px solid var(--color-input-border-active)"
            : "1px solid var(--color-btn-disabled-border)",
          borderRadius: "12px",
          cursor: isEnabled ? "pointer" : "default",
          transition: "all 0.4s ease",
          marginBottom: "20px",
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
          fontSize: "10.5px",
          color: "var(--color-text-ghost)",
          lineHeight: 1.65,
        }}
      >
        <div>
          By continuing, you agree to the{" "}
          <span style={{ textDecoration: "underline", color: "var(--color-text-ghost)", cursor: "pointer" }}>
            Terms of Service
          </span>{" "}
          and{" "}
          <span style={{ textDecoration: "underline", color: "var(--color-text-ghost)", cursor: "pointer" }}>
            Privacy Policy
          </span>
          .
        </div>
        <div style={{ marginTop: "4px" }}>
          Sage is an AI. This is not therapy or mental health services.
        </div>
      </div>
    </div>
  );
}
