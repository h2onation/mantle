"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Persistent feedback affordance for logged-in users. A small
// mono-caps "feedback" pill sits fixed at the top-right of the
// phone frame (next to where the TopBar's right slot would be).
// Click toggles a centered walnut-glass popover.

type Status = "idle" | "submitting" | "success" | "error";

export default function BetaFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Reset transient state when closed
  useEffect(() => {
    if (!open) {
      setStatus("idle");
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || status === "submitting") return;
    setStatus("submitting");
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        setStatus("error");
        return;
      }
      const { error } = await supabase.from("beta_feedback").insert({
        user_id: user.id,
        page_context: window.location.pathname,
        feedback_text: trimmed,
      });
      if (error) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setText("");
      setTimeout(() => setOpen(false), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Trigger — persistent mono-caps pill, top-right of the phone
          frame. Sits at the same y-axis as the TopBar's left button
          (top:22) so it visually anchors to the header bar without
          being part of TopBar's flex layout. */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        title="Send feedback"
        style={{
          position: "absolute",
          top: 22,
          right: 22,
          zIndex: 110,
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          lineHeight: 1,
          color: "var(--session-ink-mid)",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--session-walnut-border)",
          borderRadius: 0,
          padding: "0 0 2px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          transition: "color 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "var(--session-ink)";
          el.style.borderBottomColor = "var(--session-walnut)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "var(--session-ink-mid)";
          el.style.borderBottomColor = "var(--session-walnut-border)";
        }}
      >
        feedback
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "var(--session-backdrop)",
              zIndex: 250,
            }}
          />

          {/* Centered popover */}
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Send feedback"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 251,
              width: "min(320px, calc(100% - 32px))",
              background: "var(--session-walnut-surface)",
              border: "1px solid var(--session-bubble-border)",
              borderRadius: 18,
              padding: 20,
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              boxShadow: "var(--session-plate-shadow)",
            }}
          >
            {status === "success" ? (
              <div
                style={{
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontSize: 15,
                  color: "var(--session-ink)",
                  padding: "16px 4px",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                Thank you for your feedback.
              </div>
            ) : status === "error" ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 15,
                    color: "var(--session-ink)",
                    padding: "8px 4px",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  Didn&apos;t go through. Try again?
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 12,
                  }}
                >
                  <button
                    onClick={handleSubmit}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "2.4px",
                      textTransform: "uppercase",
                      color: "var(--session-ink)",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--session-ink)",
                      padding: "0 0 2px",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    Retry
                  </button>
                </div>
              </>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--session-walnut-meta)",
                  }}
                >
                  Beta feedback
                </p>
                <h2
                  style={{
                    margin: "6px 0 12px",
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 20,
                    fontWeight: 500,
                    color: "var(--session-ink)",
                    letterSpacing: "-0.3px",
                  }}
                >
                  Tell us what&apos;s on your mind<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
                </h2>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="I noticed..."
                  rows={5}
                  disabled={status === "submitting"}
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 14,
                    color: "var(--session-ink)",
                    background: "rgba(0,0,0,0.20)",
                    border: "1px solid var(--session-walnut-border-soft)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    resize: "none",
                    outline: "none",
                    boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  <button
                    onClick={() => setOpen(false)}
                    disabled={status === "submitting"}
                    style={{
                      fontFamily: "var(--font-spectral), var(--font-serif), serif",
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "var(--session-ink-mid)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={status === "submitting" || text.trim().length === 0}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "2.4px",
                      textTransform: "uppercase",
                      color: "var(--session-ink)",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--session-ink)",
                      padding: "4px 0",
                      cursor: "pointer",
                      opacity:
                        status === "submitting" || text.trim().length === 0
                          ? 0.5
                          : 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {status === "submitting" ? "Sending…" : "Send ›"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
