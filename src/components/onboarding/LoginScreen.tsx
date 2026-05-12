"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TopBar from "@/components/shared/TopBar";

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
        setResetSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
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
    boxSizing: "border-box" as const,
    letterSpacing: "-0.05px",
  };

  const labelStyle = {
    display: "block" as const,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    color: "var(--session-walnut-meta)",
  };

  const textBtnStyle = {
    all: "unset" as const,
    cursor: loading ? ("not-allowed" as const) : ("pointer" as const),
    display: "flex" as const,
    justifyContent: "space-between" as const,
    width: "100%",
    padding: "10px 0",
    borderBottom: "1px solid var(--session-ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "2.4px",
    textTransform: "uppercase" as const,
    color: "var(--session-ink)",
    opacity: loading ? 0.6 : 1,
    boxSizing: "border-box" as const,
  };

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderBottomColor = "var(--session-walnut)";
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderBottomColor = "var(--session-walnut-border)";
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <TopBar onBack={onBack} />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 28px",
          boxSizing: "border-box",
          // The form is shorter than the available phone-frame height
          // on desktop; centering vertically keeps it balanced. When
          // content exceeds the container (small viewports) the
          // min-height + scroll pattern still works.
        }}
      >
        {/* ── Forgot password mode ── */}
        {mode === "forgot" && (
          <>
            <div style={{ paddingTop: 32 }}>
              <p style={{ margin: 0, ...labelStyle }}>Account recovery</p>
              <h1
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontSize: 32,
                  fontWeight: 500,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                  color: "var(--session-ink)",
                }}
              >
                Reset password<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
              </h1>
            </div>

            {error && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--session-error)", margin: "16px 0 0" }}>
                {error}
              </p>
            )}

            <div
              style={{
                marginTop: 28,
                padding: "20px 22px 22px",
                borderRadius: 18,
                background: "var(--session-walnut-surface)",
                border: "1px solid var(--session-walnut-border)",
                backdropFilter: "blur(28px) saturate(140%)",
                WebkitBackdropFilter: "blur(28px) saturate(140%)",
              }}
            >
              {resetSent ? (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-spectral), var(--font-serif), serif",
                      fontSize: 15,
                      color: "var(--session-ink-soft)",
                      lineHeight: 1.62,
                      margin: "0 0 24px 0",
                    }}
                  >
                    If an account exists with this email, you&apos;ll receive a reset link shortly. Check your inbox.
                  </p>
                  <button
                    onClick={() => { setMode("login"); setResetSent(false); setError(""); }}
                    style={textBtnStyle}
                  >
                    <span>Back to sign in</span>
                    <span aria-hidden="true">&rsaquo;</span>
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgotSubmit}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                    style={{ ...inputStyle, marginBottom: 22 }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                  <button type="submit" disabled={loading} style={textBtnStyle}>
                    <span>{loading ? "Sending..." : "Send reset link"}</span>
                    <span aria-hidden="true">&rsaquo;</span>
                  </button>
                </form>
              )}
            </div>

            <p
              style={{
                margin: "20px 0 0",
                textAlign: "center",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
              }}
            >
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  color: "var(--session-ink)",
                  borderBottom: "1px solid var(--session-walnut-light)",
                  paddingBottom: 1,
                }}
              >
                Back to sign in
              </button>
            </p>
          </>
        )}

        {/* ── Login mode ── */}
        {mode === "login" && (
          <>
            <div style={{ paddingTop: 32 }}>
              <p style={{ margin: 0, ...labelStyle }}>Welcome back</p>
              <h1
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontSize: 36,
                  fontWeight: 400,
                  letterSpacing: "-0.8px",
                  lineHeight: 1.05,
                  color: "var(--session-ink)",
                }}
              >
                Sign in<span style={{ color: "var(--session-walnut)" }}>.</span>
              </h1>
            </div>

            {error && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--session-error)", margin: "16px 0 0" }}>
                {error}
              </p>
            )}

            {/* Form plate */}
            <div
              style={{
                marginTop: 28,
                padding: "20px 22px 22px",
                borderRadius: 18,
                background: "var(--session-walnut-surface)",
                border: "1px solid var(--session-walnut-border)",
                backdropFilter: "blur(28px) saturate(140%)",
                WebkitBackdropFilter: "blur(28px) saturate(140%)",
              }}
            >
              <form onSubmit={handleSubmit}>
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
                  autoComplete="current-password"
                  style={{ ...inputStyle, marginBottom: 12 }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />

                <div style={{ textAlign: "right", marginBottom: 22 }}>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setResetSent(false); setResetEmail(email); }}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      fontFamily: "var(--font-spectral), var(--font-serif), serif",
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--session-ink-mid)",
                    }}
                  >
                    forgot password
                  </button>
                </div>

                <button type="submit" disabled={loading} style={textBtnStyle}>
                  <span>{loading ? "Signing in..." : "Sign in"}</span>
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              </form>
            </div>

            {/* OR divider + Google */}
            <div style={{ marginTop: 20, padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
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
                  marginTop: 14,
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
            </div>

            {/* Create account link */}
            <p
              style={{
                margin: "24px 0 40px",
                textAlign: "center",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
              }}
            >
              No account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  color: "var(--session-ink)",
                  borderBottom: "1px solid var(--session-walnut-light)",
                  paddingBottom: 1,
                }}
              >
                Create one
              </button>
            </p>
          </>
        )}

        {/* ── Signup mode ── */}
        {mode === "signup" && (
          <>
            <div style={{ paddingTop: 32 }}>
              <p style={{ margin: 0, ...labelStyle }}>Get started</p>
              <h1
                style={{
                  margin: "8px 0 0",
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontSize: 36,
                  fontWeight: 400,
                  letterSpacing: "-0.8px",
                  lineHeight: 1.05,
                  color: "var(--session-ink)",
                }}
              >
                Create account<span style={{ color: "var(--session-walnut)" }}>.</span>
              </h1>
            </div>

            {error && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--session-error)", margin: "16px 0 0" }}>
                {error}
              </p>
            )}

            {notAllowlisted && (
              <div
                style={{
                  marginTop: 16,
                  padding: "16px 20px",
                  borderRadius: 18,
                  background: "var(--session-walnut-surface)",
                  border: "1px solid var(--session-walnut-border)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 15,
                    color: "var(--session-ink-soft)",
                    lineHeight: 1.62,
                    margin: "0 0 12px 0",
                  }}
                >
                  We&apos;re in early access right now. Join the waitlist to get notified when there&apos;s a spot.
                </p>
                <a
                  href="/waitlist"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "var(--session-walnut)",
                    textDecoration: "none",
                  }}
                >
                  Join the waitlist &rsaquo;
                </a>
              </div>
            )}

            {/* Form plate */}
            <div
              style={{
                marginTop: 28,
                padding: "20px 22px 22px",
                borderRadius: 18,
                background: "var(--session-walnut-surface)",
                border: "1px solid var(--session-walnut-border)",
                backdropFilter: "blur(28px) saturate(140%)",
                WebkitBackdropFilter: "blur(28px) saturate(140%)",
              }}
            >
              <form onSubmit={handleSignup}>
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

                <button type="submit" disabled={loading} style={textBtnStyle}>
                  <span>{loading ? "Creating account..." : "Create account"}</span>
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              </form>
            </div>

            {/* Sign in link */}
            <p
              style={{
                margin: "24px 0 40px",
                textAlign: "center",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
              }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  color: "var(--session-ink)",
                  borderBottom: "1px solid var(--session-walnut-light)",
                  paddingBottom: 1,
                }}
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
