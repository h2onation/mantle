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
    localStorage.setItem("mantle_pending_conversion", "true");
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (linkError) {
      localStorage.removeItem("mantle_pending_conversion");
      setError(linkError.message);
    }
    // If no error, browser redirects to Google
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontFamily: "var(--font-serif)",
    fontSize: "15px",
    color: "var(--color-text)",
    backgroundColor: "rgba(255,255,255,0.025)",
    border: "1px solid var(--color-divider)",
    borderRadius: "12px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.3s ease",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        backgroundColor: "var(--color-backdrop-heavy)",
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
          backgroundColor: "var(--color-void)",
          borderRadius: "16px",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        {/* Headline */}
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "24px",
            fontWeight: 400,
            color: "var(--color-text)",
            margin: "0 0 8px 0",
            lineHeight: 1.2,
          }}
        >
          Save your manual
        </h2>

        {/* Body */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "14px",
            color: "var(--color-text-dim)",
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          Create an account to keep your progress. Access your manual from any device.
        </p>

        {error && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-error)",
              margin: "0 0 16px 0",
            }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleEmailSubmit}>
          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-input-border-focus)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-divider)"; }}
            style={{
              ...inputStyle,
              marginBottom: "12px",
            }}
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-input-border-focus)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-divider)"; }}
            style={{
              ...inputStyle,
              marginBottom: "20px",
            }}
          />

          {/* Create account button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              fontFamily: "var(--font-serif)",
              fontSize: "15px",
              fontWeight: 400,
              color: "var(--color-void)",
              backgroundColor: "var(--color-accent-strong)",
              border: "none",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
              marginBottom: "12px",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Google OAuth button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--color-text)",
            backgroundColor: "transparent",
            border: "1px solid var(--color-divider)",
            borderRadius: "12px",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 18 18">
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
              fontSize: "13px",
              color: "var(--color-text-ghost)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              marginBottom: "16px",
            }}
          >
            Not now
          </button>
        </div>

        {/* Disclaimer */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--color-text-ghost)",
            margin: 0,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Already have an account? Your current session will continue &mdash; create a new account to save this work.
        </p>
      </div>
    </div>
  );
}
