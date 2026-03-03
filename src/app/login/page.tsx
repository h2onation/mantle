"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      setTransitioning(true);
      router.push("/");
      router.refresh();
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handleDevLogin() {
    setIsSignUp(false);
    setEmail("test@test.com");
    setPassword("testtest");
    setError("");
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (transitioning) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--color-void)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          animation: "mantleFadeIn 0.4s ease-out",
        }}
      >
        <div style={{ position: "relative", width: "40px", height: "40px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid transparent",
                borderTopColor: i === 0 ? "var(--color-accent)" : i === 1 ? "var(--color-text-ghost)" : "var(--color-divider)",
                animation: `mantleSpinner ${1.2 + i * 0.3}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                animationDirection: i === 1 ? "reverse" : "normal",
                transform: `scale(${1 - i * 0.2})`,
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "14px",
            color: "var(--color-text-ghost)",
            margin: 0,
          }}
        >
          Forming...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-void)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "var(--color-surface)",
          borderRadius: "16px",
          padding: "40px 32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "32px",
              color: "var(--color-text)",
              margin: "0 0 8px 0",
              fontWeight: 400,
            }}
          >
            Mantle
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              color: "var(--color-text-dim)",
              margin: 0,
            }}
          >
            Understand how you operate.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            marginBottom: "24px",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid var(--color-divider)",
          }}
        >
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(""); }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: !isSignUp ? "var(--color-accent)" : "var(--color-void)",
              color: !isSignUp ? "var(--color-void)" : "var(--color-text-dim)",
              transition: "all 0.2s",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(""); }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderLeft: "1px solid var(--color-divider)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: isSignUp ? "var(--color-accent)" : "var(--color-void)",
              color: isSignUp ? "var(--color-void)" : "var(--color-text-dim)",
              transition: "all 0.2s",
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <p
            style={{
              color: "#B5564D",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              margin: "0 0 16px 0",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: "12px",
                backgroundColor: "var(--color-void)",
                border: "1px solid var(--color-divider)",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                color: "var(--color-text)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              marginBottom: "12px",
              backgroundColor: "var(--color-void)",
              border: "1px solid var(--color-divider)",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: "var(--color-text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              marginBottom: "20px",
              backgroundColor: "var(--color-void)",
              border: "1px solid var(--color-divider)",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: "var(--color-text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "var(--color-accent)",
              color: "var(--color-void)",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading
              ? "Loading..."
              : isSignUp
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "20px 0",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-divider)" }} />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--color-text-ghost)",
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-divider)" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "transparent",
            color: "var(--color-text)",
            border: "1px solid var(--color-divider)",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          Continue with Google
        </button>

        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={handleDevLogin}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "transparent",
              color: "var(--color-text-ghost)",
              border: "1px solid var(--color-divider)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 400,
              fontFamily: "var(--font-mono)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 0.5,
              transition: "opacity 0.2s",
            }}
          >
            Dev Login
          </button>
        )}
      </div>
    </div>
  );
}
