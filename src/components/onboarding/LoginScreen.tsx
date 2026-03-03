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
    fontFamily: "Georgia, serif",
    fontSize: "15px",
    color: "#E8E4DD",
    backgroundColor: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.06)",
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
          fontFamily: "Georgia, serif",
          fontSize: "13.5px",
          color: "rgba(232,228,221,0.3)",
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
          fontFamily: "Arial, sans-serif",
          fontSize: "10.5px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(139,157,119,0.5)",
          marginBottom: "8px",
        }}
      >
        WELCOME BACK
      </div>

      {/* MANTLE wordmark */}
      <div
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "20px",
          letterSpacing: "0.2em",
          color: "#E8E4DD",
          marginBottom: "8px",
        }}
      >
        MANTLE
      </div>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "28px",
          fontWeight: 400,
          lineHeight: 1.22,
          color: "#E8E4DD",
          margin: "0 0 32px 0",
        }}
      >
        Log in to your manual.
      </h1>

      {error && (
        <p
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            color: "#B5564D",
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,157,119,0.25)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(139,157,119,0.25)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
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
            fontFamily: "Georgia, serif",
            fontSize: "15px",
            fontWeight: 400,
            color: "#1A1A18",
            backgroundColor: "rgba(139,157,119,0.55)",
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
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            color: "rgba(232,228,221,0.3)",
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
