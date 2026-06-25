"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";
import { formatLayerEyebrow, sectionName } from "@/lib/manual/layers";

import type { CheckpointAction } from "@/lib/persona/config";

interface CheckpointEdits {
  editedContent?: string | null;
  editedName?: string | null;
}

/** Drives the overlay's visible phase from outside.
 *  - "idle": show actions surface, accept input
 *  - "pending": API call in flight, show composing animation
 *  - "success": API succeeded, show confirmed cover, then close
 *  - "error": API failed, return to actions with an error line */
export type ConfirmStatus = "idle" | "pending" | "success" | "error";

interface CheckpointOverlayProps {
  open: boolean;
  checkpoint: ActiveCheckpoint;
  refinementCeilingActive: boolean;
  confirmStatus?: ConfirmStatus;
  errorMessage?: string | null;
  onAction: (action: CheckpointAction, edits?: CheckpointEdits) => void;
  onClose: () => void;
}

type Phase = "actions" | "composing" | "confirmed";

export default function CheckpointOverlay({
  open,
  checkpoint,
  refinementCeilingActive,
  confirmStatus = "idle",
  errorMessage,
  onAction,
  onClose,
}: CheckpointOverlayProps) {
  const [phase, setPhase] = useState<Phase>("actions");
  const [editing, setEditing] = useState(false);
  const editedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const moduleRef = useRef<HTMLDivElement>(null);

  // onClose is supplied by the parent as an inline arrow function, so its
  // identity changes on every parent render. The auto-close timer and the
  // keyboard handler must NOT depend on it directly — during the post-confirm
  // stream the parent re-renders many times per second, which would restart
  // the timer indefinitely and leave the overlay stuck on the confirmed
  // cover. The ref keeps the latest closure without triggering effect reruns.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setPhase("actions");
      setEditing(false);
      editedRef.current = false;
    }
  }, [open]);

  // Drive the phase from confirmStatus. The actions surface stays put for
  // idle and error (error renders inline below the buttons). Pending and
  // success drive the composing/confirmed transitions; success then
  // auto-closes after the celebration so the trigger card transitions
  // out of view cleanly.
  useEffect(() => {
    if (!open) return;
    if (confirmStatus === "pending") {
      setPhase("composing");
      return;
    }
    if (confirmStatus === "success") {
      setPhase("confirmed");
      const t = setTimeout(() => onCloseRef.current(), 1600);
      return () => clearTimeout(t);
    }
    if (confirmStatus === "error") {
      setPhase("actions");
    }
  }, [confirmStatus, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape always dismisses, regardless of phase. The previous gate ("only
  // when phase === 'actions'") meant a stuck confirmed-cover had no escape
  // hatch if the auto-close timer failed for any reason.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleConfirm = useCallback(() => {
    // Only forward edits when the user actually entered edit mode at some
    // point during this overlay session — otherwise the rendered-markdown
    // round-trip via innerText could falsely flag a diff against the raw
    // markdown source.
    const edits: CheckpointEdits = {};
    if (editedRef.current) {
      const rawContent = bodyRef.current?.innerText?.trim() ?? "";
      const rawName = headlineRef.current?.innerText?.trim() ?? "";
      if (rawContent) edits.editedContent = rawContent;
      if (rawName && rawName !== (checkpoint.name?.trim() ?? "")) {
        edits.editedName = rawName;
      }
    }

    if (editing) setEditing(false);

    // Hand straight off to the saving cover — no press animation.
    setPhase("composing");
    onAction("confirmed", edits);
  }, [editing, onAction, checkpoint.name]);

  const handleRefine = useCallback(() => {
    onAction("refined");
    onClose();
  }, [onAction, onClose]);

  const handleReject = useCallback(() => {
    onAction("rejected");
    onClose();
  }, [onAction, onClose]);

  const handleDefer = useCallback(() => {
    onAction("deferred");
    onClose();
  }, [onAction, onClose]);

  const toggleEdit = useCallback(() => {
    setEditing((prev) => {
      const next = !prev;
      if (next) {
        editedRef.current = true;
        setTimeout(() => bodyRef.current?.focus(), 50);
      }
      return next;
    });
  }, []);

  if (!open) return null;

  const eyebrowText = formatLayerEyebrow(checkpoint.section);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review suggested entry"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 1,
        animation: "cpOverlayIn 0.3s ease forwards",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={phase === "actions" ? onClose : undefined}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--session-backdrop-heavy)",
        }}
      />

      {/* Module */}
      <div
        ref={moduleRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          width: "calc(100% - 40px)",
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          background: "var(--session-walnut-surface)",
          border: "1px solid var(--session-bubble-border)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "var(--session-plate-shadow)",
          overflow: "hidden",
          animation: "cpModuleIn 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      >
        {/* Entry section (scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "26px 24px 20px",
            scrollbarWidth: "none",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-walnut-meta-strong)",
              lineHeight: 1,
            }}
          >
            {eyebrowText}
          </p>

          {checkpoint.name && (
            <h3
              ref={headlineRef}
              contentEditable={editing}
              suppressContentEditableWarning
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-spectral), var(--font-persona), serif",
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: "-0.3px",
                color: "var(--session-ink)",
                outline: "none",
                borderBottom: editing
                  ? "1px solid var(--session-walnut-border)"
                  : "1px solid transparent",
                paddingBottom: editing ? 4 : 0,
                transition: "border-color 0.2s, padding-bottom 0.2s",
              }}
            >
              {checkpoint.name}
            </h3>
          )}

          <div
            ref={bodyRef}
            contentEditable={editing}
            suppressContentEditableWarning
            style={{
              marginTop: 18,
              fontFamily: "var(--font-spectral), var(--font-persona), serif",
              fontSize: 17,
              lineHeight: 1.65,
              letterSpacing: "-0.05px",
              color: "var(--session-ink)",
              textWrap: "pretty" as React.CSSProperties["textWrap"],
              outline: "none",
              minHeight: 60,
              border: editing
                ? "1px solid var(--session-walnut-border)"
                : "1px solid transparent",
              borderRadius: 8,
              padding: editing ? "12px 14px" : 0,
              background: editing
                ? "var(--session-walnut-surface-soft)"
                : "transparent",
              transition: "all 0.25s ease",
            }}
          >
            {renderMarkdown(checkpoint.composedContent || checkpoint.content)}
          </div>

          {/* Edit hint */}
          <p
            style={{
              fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
              fontSize: 12,
              color: "var(--session-ink-ghost)",
              marginTop: 8,
              maxHeight: editing ? 30 : 0,
              overflow: "hidden",
              opacity: editing ? 1 : 0,
              transition: "all 0.3s ease",
            }}
          >
            Tap the text to make changes. Your words, your Manual.
          </p>
        </div>

        {/* Actions section */}
        {phase === "actions" && (
          <div
            style={{
              padding: "16px 24px 24px",
              borderTop: "1px solid var(--session-walnut-border-soft)",
              background: "var(--session-walnut-surface-soft)",
              flexShrink: 0,
              animation: "cpFadeIn 0.3s ease forwards",
            }}
          >
            {confirmStatus === "error" && errorMessage && (
              <p
                role="alert"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "1.6px",
                  textTransform: "uppercase",
                  color: "var(--session-ink)",
                  margin: "0 0 12px 0",
                  textAlign: "center",
                }}
              >
                {errorMessage}
              </p>
            )}
            {refinementCeilingActive ? (
              <>
                <p
                  style={{
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.5,
                    margin: "0 0 var(--sp-sm) 0",
                  }}
                >
                  Close but not quite is fine. Want me to put it in as it is, or
                  let it go and we come back to it?
                </p>
                <button
                  onClick={handleConfirm}
                  style={{
                    width: "100%",
                    padding: "15px 20px",
                    fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--session-ink)",
                    background: "var(--session-walnut-border)",
                    border: "1px solid var(--session-walnut-border)",
                    borderRadius: 12,
                    cursor: "pointer",
                    letterSpacing: "0.2px",
                    transition: "all 0.25s ease",
                  }}
                >
                  Add to my Manual as-is
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  <button onClick={handleDefer} style={linkStyle}>
                    let it go
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleConfirm}
                  style={{
                    width: "100%",
                    padding: "15px 20px",
                    fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--session-ink)",
                    background: "var(--session-walnut-border)",
                    border: "1px solid var(--session-walnut-border)",
                    borderRadius: 12,
                    cursor: "pointer",
                    letterSpacing: "0.2px",
                    transition: "all 0.25s ease",
                  }}
                >
                  Add to my Manual
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  <button
                    onClick={toggleEdit}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: editing
                        ? "var(--session-walnut-meta-strong)"
                        : "var(--session-walnut-meta)",
                      background: editing
                        ? "var(--session-walnut-highlight)"
                        : "none",
                      border: `1px solid ${editing ? "var(--session-walnut-meta)" : "var(--session-walnut-border)"}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {editing ? "Done" : "Edit"}
                  </button>
                  <span style={dotStyle}>·</span>
                  <button onClick={handleRefine} style={linkStyle}>
                    Jove, let&rsquo;s rework together
                  </button>
                  <span style={dotStyle}>·</span>
                  <button onClick={handleReject} style={linkStyle}>
                    Discard
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Saving cover — the single save screen. It appears the moment the
         *  user confirms (composing) and stays through success (confirmed),
         *  so there is no separate inline "saving" line below the entry. The
         *  label reads "Adding…" while the save is in flight, then "Added".
         *  Must fully obscure the entry behind it: `--session-walnut-surface`
         *  alone is 20% opaque in Hearth and 90% in Bloom — both leak entry
         *  text through. Layered background stacks the walnut tint over
         *  `--session-cream` (opaque in both themes) so the cover keeps its
         *  warm Manual feel while being fully opaque. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(var(--session-walnut-surface), var(--session-walnut-surface)), var(--session-cream)",
            borderRadius: 20,
            zIndex: 5,
            opacity: phase === "confirmed" || phase === "composing" ? 1 : 0,
            pointerEvents:
              phase === "confirmed" || phase === "composing" ? "auto" : "none",
            transition: "opacity 0.5s ease",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display), var(--font-serif), serif",
              fontSize: 28,
              color: "var(--session-walnut)",
              marginBottom: 14,
              ...(phase === "confirmed"
                ? { animation: "cpConfirmPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }
                : {}),
            }}
          >
            ❦
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "2.2px",
              textTransform: "uppercase",
              color: "var(--session-walnut)",
            }}
          >
            {phase === "confirmed" ? "Added to your Manual" : "Adding to your Manual…"}
          </span>
          {checkpoint.section && (
            <span
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 15,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
                marginTop: 8,
              }}
            >
              {sectionName(checkpoint.section)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
  fontSize: 14,
  color: "var(--session-ink-faded)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "8px 12px",
  borderRadius: 8,
  transition: "all 0.2s",
};

const dotStyle: React.CSSProperties = {
  color: "var(--session-ink-whisper)",
  fontSize: 10,
};
