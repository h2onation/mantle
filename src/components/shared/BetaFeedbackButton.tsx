"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Persistent feedback button for logged-in users. Renders inside the
// phone-frame so it stays anchored to the app on desktop. The admin
// overlay (z-index 300) covers this button while it's open, so we
// don't need extra logic to hide it on the admin "page".

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
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        style={{
          position: "absolute",
          right: 14,
          // Clear MobileNav (~50px) + iOS safe area
          bottom: "calc(62px + env(safe-area-inset-bottom, 0px))",
          zIndex: 110,
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid var(--session-ink-hairline)",
          borderRadius: 999,
          padding: "6px 11px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          boxShadow: "0 1px 2px rgba(26, 22, 20, 0.04)",
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Send feedback"
          style={{
            position: "absolute",
            right: 14,
            bottom: "calc(100px + env(safe-area-inset-bottom, 0px))",
            zIndex: 111,
            width: "min(280px, calc(100% - 28px))",
            background: "var(--session-cream)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 8px 24px rgba(26, 22, 20, 0.12)",
          }}
        >
          {status === "success" ? (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-ink)",
                padding: "8px 4px",
                textAlign: "center",
              }}
            >
              Thanks for the feedback
            </div>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                disabled={status === "submitting"}
                style={{
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--session-ink)",
                  background: "rgba(255, 255, 255, 0.7)",
                  border: "1px solid var(--session-ink-hairline)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  lineHeight: 1.5,
                }}
              />
              {status === "error" && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--session-error)",
                    letterSpacing: "1px",
                    marginTop: 6,
                  }}
                >
                  Couldn&apos;t send. Try again.
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  onClick={() => setOpen(false)}
                  disabled={status === "submitting"}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--session-ink-ghost)",
                    background: "none",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={status === "submitting" || text.trim().length === 0}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--session-cream)",
                    background: "var(--session-sage)",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    opacity:
                      status === "submitting" || text.trim().length === 0
                        ? 0.5
                        : 1,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {status === "submitting" ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
