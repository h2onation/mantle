"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LoginScreenProps {
  onBack: () => void;
}

export const LOGIN_GLOW = { x: 45, y: 30, scale: 1.0, opacity: 0.14 };

export default function LoginScreen({ onBack }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontFamily: "var(--font-serif)",
    fontSize: "15px",
    color: "var(--color-text)",
    backgroundColor: "var(--color-input-bg)",
    border: "1px solid var(--color-divider)",
    borderRadius: "12px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.3s ease",
  };

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        padding: "0 32px",
        boxSizing: "border-box",
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontFamily: "var(--font-serif)",
          fontSize: "13.5px",
          color: "var(--color-text-ghost)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 32px 0",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      {/* WELCOME BACK label */}
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "10.5px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-accent-dim)",
          marginBottom: "8px",
        }}
      >
        WELCOME BACK
      </div>

      {/* MANTLE wordmark */}
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          letterSpacing: "0.2em",
          color: "var(--color-text)",
          marginBottom: "8px",
        }}
      >
        MANTLE
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "28px",
          fontWeight: 400,
          lineHeight: 1.22,
          color: "var(--color-text)",
          margin: "0 0 32px 0",
        }}
      >
        Log in to your manual.
      </h1>

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

      <form onSubmit={handleSubmit}>
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-input-border-focus)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-divider)"; }}
          style={{
            ...inputStyle,
            marginBottom: "24px",
          }}
        />

        {/* Submit */}
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
            marginBottom: "16px",
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "4px 0 20px",
        }}
      >
        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-divider)" }} />
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--color-text-ghost)",
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-divider)" }} />
      </div>

      {/* Google OAuth */}
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
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {/* Forgot password */}
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text-ghost)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Forgot password?
        </span>
      </div>
    </div>
  );
}
