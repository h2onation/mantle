"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?error=reset_link_expired");
        return;
      }
      setChecking(false);
    }
    checkSession();
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don\u2019t match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div
        style={{
          width: "100%",
          height: "100dvh",
          background: "var(--session-linen)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "430px",
        margin: "0 auto",
        height: "100dvh",
        background: "var(--session-linen)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Wordmark */}
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
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 400,
              color: "var(--session-ink)",
              margin: "0 0 32px 0",
            }}
          >
            {success ? "Password updated" : "Set new password"}
          </h1>

          {success ? (
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 15,
                color: "var(--session-ink-mid)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Taking you to your manual...
            </p>
          ) : (
            <>
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
                  NEW PASSWORD
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
                    marginBottom: 28,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "var(--session-persona-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "var(--session-ink-whisper)";
                  }}
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
                  CONFIRM PASSWORD
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "var(--session-persona-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "var(--session-ink-whisper)";
                  }}
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
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
