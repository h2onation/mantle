"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * Landing contact form. Writes to the existing waitlist capture
 * (POST /api/waitlist → waitlist table, IP rate-limited, deduped). Name is
 * folded into the free-text `source` for now; a dedicated `name` column lands
 * with the admin-notification work. On success we show the same quiet
 * confirmation the mockup used.
 */
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setState({ kind: "submitting" });

    const source =
      [name.trim() && `Name: ${name.trim()}`, message.trim()]
        .filter(Boolean)
        .join("\n\n") || undefined;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
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
        setState({
          kind: "error",
          message:
            data?.error === "invalid_email"
              ? "Please enter a valid email."
              : "Something went wrong. Please try again.",
        });
        return;
      }
      // "added" or "already_listed" both land as a received confirmation.
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="confirm">
        Got it. I read every one.
        <br />— Jeff
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {state.kind === "error" && <p className="form-error">{state.message}</p>}

      <div className="field">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="contact-msg">What brought you here?</label>
        <textarea
          id="contact-msg"
          name="msg"
          placeholder="Anything you want to share"
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <button className="send" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
