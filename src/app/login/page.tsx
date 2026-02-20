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
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
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

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F5F0E8",
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
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "40px 32px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "32px",
              color: "#2C2C2C",
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
              color: "#8C8478",
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
            border: "1px solid #E5DFD5",
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
              backgroundColor: !isSignUp ? "#5C6B5E" : "#FAF7F2",
              color: !isSignUp ? "#FFFFFF" : "#8C8478",
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
              borderLeft: "1px solid #E5DFD5",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: isSignUp ? "#5C6B5E" : "#FAF7F2",
              color: isSignUp ? "#FFFFFF" : "#8C8478",
              transition: "all 0.2s",
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <p
            style={{
              color: "#B5756A",
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
                backgroundColor: "#FAF7F2",
                border: "1px solid #E5DFD5",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                color: "#2C2C2C",
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
              backgroundColor: "#FAF7F2",
              border: "1px solid #E5DFD5",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: "#2C2C2C",
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
              backgroundColor: "#FAF7F2",
              border: "1px solid #E5DFD5",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "var(--font-sans)",
              color: "#2C2C2C",
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
              backgroundColor: "#5C6B5E",
              color: "#FFFFFF",
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
          <div style={{ flex: 1, height: "1px", backgroundColor: "#E5DFD5" }} />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "#8C8478",
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#E5DFD5" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "transparent",
            color: "#2C2C2C",
            border: "1px solid #2C2C2C",
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
      </div>
    </div>
  );
}
