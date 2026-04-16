"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthPromptModalProps {
  onDismiss: () => void;
  onSuccess: () => void;
}

export default function AuthPromptModal({ onDismiss, onSuccess }: AuthPromptModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email,
        password,
      });
      if (updateError) throw updateError;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    // Store flag so we can detect the conversion on redirect return
    localStorage.setItem("mw_pending_conversion", "true");
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (linkError) {
      localStorage.removeItem("mw_pending_conversion");
      setError(linkError.message);
    }
    // If no error, browser redirects to Google
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-heading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        backgroundColor: "var(--session-backdrop-heavy)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          backgroundColor: "var(--session-cream)",
          borderRadius: 12,
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        {/* Headline */}
        <h2
          id="auth-prompt-heading"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: "0 0 8px 0",
            lineHeight: 1.2,
          }}
        >
          Keep your manual
        </h2>

        {/* Body */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14,
            color: "var(--session-ink-mid)",
            margin: "0 0 28px 0",
            lineHeight: 1.5,
          }}
        >
          Create an account so you don&rsquo;t lose what you&rsquo;ve built.
        </p>

        {error && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--session-error)",
              margin: "0 0 16px 0",
            }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleEmailSubmit}>
          {/* Email label */}
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-faded)",
              marginBottom: 8,
            }}
          >
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            style={{
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              color: "var(--session-ink)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid var(--session-ink-whisper)",
              borderRadius: 0,
              padding: "12px 0",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 28,
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-persona-soft)"; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-ink-whisper)"; }}
          />

          {/* Password label */}
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-faded)",
              marginBottom: 8,
            }}
          >
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
            style={{
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              color: "var(--session-ink)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid var(--session-ink-whisper)",
              borderRadius: 0,
              padding: "12px 0",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 32,
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-persona-soft)"; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-ink-whisper)"; }}
          />

          {/* Create account button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px 0",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 500,
              color: "var(--session-cream)",
              backgroundColor: "var(--session-persona)",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
              marginBottom: 20,
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--session-ink-hairline)" }} />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--session-ink-ghost)",
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--session-ink-hairline)" }} />
        </div>

        {/* Google OAuth button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--session-ink-mid)",
            backgroundColor: "transparent",
            border: "1px solid var(--session-ink-whisper)",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Dismiss */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={onDismiss}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--session-ink-ghost)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              marginBottom: 16,
            }}
          >
            Not now
          </button>
        </div>

        {/* Disclaimer */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "var(--session-ink-mid)",
            margin: 0,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Already have an account? Your current session will continue. Create a new account to save this work.
        </p>
      </div>
    </div>
  );
}
