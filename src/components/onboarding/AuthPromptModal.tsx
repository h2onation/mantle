"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/shared/Modal";

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
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--font-spectral), var(--font-serif), serif",
    fontSize: 16,
    color: "var(--session-ink)",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "1px solid var(--session-walnut-border)",
    borderRadius: 0,
    padding: "10px 0 6px",
    outline: "none",
    boxSizing: "border-box",
    letterSpacing: "-0.05px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "var(--session-walnut-meta)",
  };

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderBottomColor = "var(--session-walnut)";
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderBottomColor = "var(--session-walnut-border)";
  }

  return (
    <Modal open onClose={onDismiss} ariaLabelledBy="auth-prompt-heading">
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
        Save your conversation
      </p>
      <h2
        id="auth-prompt-heading"
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 22,
          fontWeight: 500,
          color: "var(--session-ink)",
          lineHeight: 1.25,
          letterSpacing: "-0.3px",
        }}
      >
        Keep your manual
        <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
      </h2>
      <p
        style={{
          margin: "12px 0 18px",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 15.5,
          color: "var(--session-ink-soft)",
          lineHeight: 1.62,
          letterSpacing: "-0.05px",
        }}
      >
        Create an account so you don&rsquo;t lose what you&rsquo;ve built.
      </p>

      {error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--session-error-text)",
            margin: "0 0 14px 0",
          }}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleEmailSubmit}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
          style={{ ...inputStyle, marginBottom: 14 }}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={6}
          style={{ ...inputStyle, marginBottom: 22 }}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            all: "unset",
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
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            boxSizing: "border-box",
          }}
        >
          <span>{loading ? "Creating account..." : "Create account"}</span>
          <span aria-hidden="true">›</span>
        </button>
      </form>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "20px 0 14px",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--session-walnut-border)" }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--session-walnut-border)" }} />
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        style={{
          all: "unset",
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "12px 0",
          borderRadius: 12,
          background: "var(--session-oauth-surface)",
          border: "1px solid var(--session-oauth-border)",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 14,
          color: "var(--session-ink)",
          boxSizing: "border-box",
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

      <p
        style={{
          margin: "18px 0 0",
          textAlign: "center",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 14,
          fontStyle: "italic",
          color: "var(--session-ink-mid)",
        }}
      >
        <button
          onClick={onDismiss}
          style={{
            all: "unset",
            cursor: "pointer",
            color: "var(--session-ink-mid)",
            fontStyle: "italic",
          }}
        >
          maybe later
        </button>
      </p>
    </Modal>
  );
}
