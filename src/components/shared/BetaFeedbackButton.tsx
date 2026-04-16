"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Persistent feedback button for logged-in users. Sits in the
// top-right slot of the phone frame — both MobileSession and
// MobileManual headers leave a 40-44px spacer there for symmetry,
// so the button slots in cleanly without overlapping the MYWALNUT
// logo or the hamburger menu. The admin overlay (z-index 300)
// covers this button while it's open, so we don't need extra
// logic to hide it on the admin "page".

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
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        title="Send feedback"
        style={{
          position: "absolute",
          // Center the pill vertically on the same y-axis as the
          // prior 32px icon (which sat at top:16, so center y=32).
          top: 20,
          right: 16,
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--size-meta)",
          lineHeight: 1,
          color: "var(--session-ink-mid)",
          background: "none",
          border: "1px solid var(--session-ink-ghost)",
          borderRadius: 999,
          padding: "5px 12px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          transition: "color 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "var(--session-ink-soft)";
          el.style.borderColor = "var(--session-ink-mid)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = "var(--session-ink-mid)";
          el.style.borderColor = "var(--session-ink-ghost)";
        }}
      >
        feedback
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Send feedback"
          style={{
            position: "absolute",
            top: 56,
            right: 16,
            zIndex: 111,
            width: "min(280px, calc(100% - 32px))",
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
                padding: "16px 4px",
                textAlign: "center",
              }}
            >
              Thank you for your feedback.
            </div>
          ) : status === "error" ? (
            <>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: "var(--session-ink)",
                  padding: "8px 4px",
                  textAlign: "center",
                }}
              >
                Didn&apos;t go through. Try again?
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 8,
                }}
              >
                <button
                  onClick={handleSubmit}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--size-meta)",
                    fontWeight: 600,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--session-cream)",
                    background: "var(--session-persona)",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 14px",
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
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--session-ink)",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                Send feedback
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 300,
                  color: "var(--session-ink-mid)",
                  textAlign: "left",
                  lineHeight: 1.4,
                  marginBottom: 8,
                }}
              >
                What did you love,  if you caught a bug, your notes. All useful.
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="I noticed..."
                rows={6}
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  onClick={() => setOpen(false)}
                  disabled={status === "submitting"}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--size-meta)",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--session-ink-ghost)",
                    background: "none",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 8px",
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
                    fontSize: "var(--size-meta)",
                    fontWeight: 600,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--session-cream)",
                    background: "var(--session-persona)",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 14px",
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
