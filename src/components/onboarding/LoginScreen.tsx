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
