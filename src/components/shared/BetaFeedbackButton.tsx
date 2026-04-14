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
        title="Send feedback"
        style={{
          position: "absolute",
          // Sit inside the 40-44px header spacer slot (header padding
          // is 12px top, 16-24px right). Anchor to the right edge of
          // that slot.
          top: 16,
          right: 20,
          zIndex: 110,
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--session-ink-ghost)",
          background: "none",
          border: "none",
          borderRadius: 999,
          padding: 0,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--session-ink-mid)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--session-ink-ghost)";
        }}
      >
        {/* Speech bubble glyph — subtle, matches the hairline weight
            of the hamburger menu on the opposite side of the header. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 4.25a1.75 1.75 0 0 1 1.75-1.75h7.5a1.75 1.75 0 0 1 1.75 1.75v5a1.75 1.75 0 0 1-1.75 1.75H7L4 13.5v-2.75a1.75 1.75 0 0 1-1.5-1.73v-4.77z" />
        </svg>
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
                    background: "var(--session-persona)",
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
