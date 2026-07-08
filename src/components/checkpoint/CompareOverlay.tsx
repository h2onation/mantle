"use client";

import { useEffect } from "react";
import type { EntryCandidate } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";
import { formatLayerEyebrow } from "@/lib/manual/layers";

// COMPOSER_MODE=compare picker. Shows both composed candidates — the classic
// composer's and the conductor's — one after the other, labeled, so the founder
// can judge which entry is better for THIS conversation and pick one to carry
// into the normal review/confirm flow. Test-only surface: the whole component,
// its wiring, and COMPOSER_MODE are deleted once the A/B picks a winner.

interface CompareOverlayProps {
  open: boolean;
  candidates: EntryCandidate[];
  onPick: (candidate: EntryCandidate) => void;
  onClose: () => void;
}

const LABELS: Record<EntryCandidate["label"], string> = {
  classic: "A · Classic composer",
  conductor: "B · Conductor",
};

export default function CompareOverlay({
  open,
  candidates,
  onPick,
  onClose,
}: CompareOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare composed entries"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "cpOverlayIn 0.3s ease forwards",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--session-backdrop-heavy)",
        }}
      />

      <div
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
        <div
          style={{
            padding: "18px 24px 12px",
            borderBottom: "1px solid var(--session-walnut-border-soft)",
            flexShrink: 0,
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
            }}
          >
            Two versions — pick one
          </p>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
            scrollbarWidth: "none",
          }}
        >
          {candidates.map((candidate, i) => (
            <div
              key={candidate.label}
              style={{
                padding: "18px 24px 22px",
                borderTop:
                  i > 0 ? "1px solid var(--session-walnut-border-soft)" : "none",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "1.8px",
                  textTransform: "uppercase",
                  color: "var(--session-walnut-meta-strong)",
                }}
              >
                {LABELS[candidate.label] ?? candidate.label}
              </p>

              <p
                style={{
                  margin: "0 0 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "var(--session-ink-ghost)",
                }}
              >
                {formatLayerEyebrow(candidate.entry.section)}
              </p>

              <h3
                style={{
                  margin: "0 0 12px",
                  fontFamily: "var(--font-spectral), var(--font-persona), serif",
                  fontSize: 20,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: "-0.3px",
                  color: "var(--session-ink)",
                }}
              >
                {candidate.entry.name}
              </h3>

              <div
                style={{
                  fontFamily: "var(--font-spectral), var(--font-persona), serif",
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "var(--session-ink)",
                  textWrap: "pretty" as React.CSSProperties["textWrap"],
                }}
              >
                {renderMarkdown(candidate.entry.content)}
              </div>

              <button
                onClick={() => onPick(candidate)}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "13px 20px",
                  fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--session-ink)",
                  background: "var(--session-walnut-border)",
                  border: "1px solid var(--session-walnut-border)",
                  borderRadius: 12,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                }}
              >
                Use this one
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "12px 24px 18px",
            borderTop: "1px solid var(--session-walnut-border-soft)",
            background: "var(--session-walnut-surface-soft)",
            flexShrink: 0,
            textAlign: "center",
          }}
        >
          <button
            onClick={onClose}
            style={{
              fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
              fontSize: 14,
              color: "var(--session-ink-faded)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
            }}
          >
            Neither &mdash; close
          </button>
        </div>
      </div>
    </div>
  );
}
