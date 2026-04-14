"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LoginScreenProps {
  onBack: () => void;
  initialMode?: "login" | "signup";
}

export default function LoginScreen({ onBack, initialMode = "login" }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [notAllowlisted, setNotAllowlisted] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "reset_link_expired") {
      setError("This reset link has expired or was already used. Please request a new one.");
    }
  }, []);

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotAllowlisted(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data?.error === "not_allowlisted") {
        setNotAllowlisted(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "An error occurred");
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + "/auth/callback?next=/reset-password",
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("rate") || message.toLowerCase().includes("limit")) {
        setError("Too many attempts. Please wait a few minutes.");
      } else {
        // Always show success to prevent email enumeration
        setResetSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  // Back button shared styles
  const backButtonStyle = {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 4,
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--session-ink-ghost)",
    background: "none",
    border: "none",
    cursor: "pointer" as const,
    padding: 0,
    marginBottom: 28,
  };

  const backArrow = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M7.5 2.5L4 6L7.5 9.5" stroke="var(--session-ink-ghost)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

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

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 28px",
          boxSizing: "border-box",
        }}
      >
        {mode === "forgot" && (
          <>
            {/* Back button — returns to login mode */}
            <button
              onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
              style={backButtonStyle}
            >
              {backArrow}
              Back
            </button>

            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--session-ink)",
                margin: "0 0 32px 0",
              }}
            >
              Reset password
            </h1>

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

            {resetSent ? (
              <>
                <p
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 15,
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.5,
                    margin: "0 0 32px 0",
                  }}
                >
                  If an account exists with this email, you&apos;ll receive a reset link shortly. Check your inbox.
                </p>
                <button
                  onClick={() => { setMode("login"); setResetSent(false); setError(""); }}
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
                    cursor: "pointer",
                    transition: "opacity 0.2s",
                  }}
                >
                  Back to log in
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotSubmit}>
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
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
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
                  }}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            )}
          </>
        )}

        {mode === "login" && (
          <>
            {/* Back button */}
            <button
              onClick={onBack}
              style={backButtonStyle}
            >
              {backArrow}
              Back
            </button>

            {/* Welcome back title */}
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--session-ink)",
                margin: "0 0 32px 0",
              }}
            >
              Welcome back
            </h1>

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

            <form onSubmit={handleSubmit}>
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
                style={{
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
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
                style={{
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--session-ink)",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--session-ink-whisper)",
                  borderRadius: 0,
                  padding: "12px 0",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 12,
                }}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-persona-soft)"; }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = "var(--session-ink-whisper)"; }}
              />

              {/* Forgot password link */}
              <div style={{ textAlign: "right", marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setResetSent(false); setResetEmail(email); }}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--session-ink-ghost)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Log in button */}
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
                {loading ? "Logging in..." : "Log in"}
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

            {/* Google OAuth */}
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

            {/* Sign up link */}
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--session-ink-ghost)",
                textAlign: "center",
                marginTop: 24,
              }}
            >
              No account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--session-persona)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Create account
              </button>
            </p>
          </>
        )}

        {mode === "signup" && (
          <>
            {/* Back button */}
            <button
              onClick={() => { setMode("login"); setError(""); }}
              style={backButtonStyle}
            >
              {backArrow}
              Back
            </button>

            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--session-ink)",
                margin: "0 0 32px 0",
              }}
            >
              Create account
            </h1>

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

            {notAllowlisted && (
              <div
                style={{
                  border: "1px solid var(--session-ink-whisper)",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 15,
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.5,
                    margin: "0 0 12px 0",
                  }}
                >
                  We&apos;re in early access right now. Join the waitlist to get notified when there&apos;s a spot.
                </p>
                <a
                  href="/waitlist"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--session-persona)",
                    textDecoration: "none",
                  }}
                >
                  Join the waitlist →
                </a>
              </div>
            )}

            <form onSubmit={handleSignup}>
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
                style={{
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
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
                minLength={6}
                style={{
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
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
                }}
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--session-ink-ghost)",
                textAlign: "center",
                marginTop: 24,
              }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--session-persona)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Log in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
