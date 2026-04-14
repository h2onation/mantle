"use client";

import { useState } from "react";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "added" }
  | { kind: "already_listed" }
  | { kind: "error"; message: string };

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submitting = state.kind === "submitting";
  const showForm = state.kind !== "added" && state.kind !== "already_listed";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: source || undefined }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setState({
          kind: "error",
          message: "Too many attempts. Please wait a few minutes and try again.",
        });
        return;
      }
      if (!res.ok) {
        if (data?.error === "invalid_email") {
          setState({ kind: "error", message: "Please enter a valid email." });
        } else {
          setState({
            kind: "error",
            message: "Something went wrong. Please try again.",
          });
        }
        return;
      }

      if (data?.status === "already_listed") {
        setState({ kind: "already_listed" });
      } else {
        setState({ kind: "added" });
      }
      setEmail("");
      setSource("");
    } catch {
      setState({
        kind: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  // ── Confirmation states ────────────────────────────────────────────
  if (state.kind === "added") {
    return (
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          color: "var(--session-ink-mid)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        You&apos;re on the list. We&apos;ll reach out when there&apos;s a spot.
      </p>
    );
  }

  if (state.kind === "already_listed") {
    return (
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          color: "var(--session-ink-mid)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        You&apos;re already on the list. We&apos;ll reach out.
      </p>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      {state.kind === "error" && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--session-error)",
            margin: "0 0 16px 0",
          }}
        >
          {state.message}
        </p>
      )}

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
        autoComplete="email"
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
          e.currentTarget.style.borderBottomColor = "var(--session-persona-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = "var(--session-ink-whisper)";
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
        WHAT BROUGHT YOU HERE?
      </label>
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={2}
        maxLength={500}
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
          resize: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = "var(--session-persona-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = "var(--session-ink-whisper)";
        }}
      />

      {showForm && (
        <button
          type="submit"
          disabled={submitting}
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
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {submitting ? "Submitting..." : "Join the waitlist"}
        </button>
      )}
    </form>
  );
}
