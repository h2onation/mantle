"use client";

import { useState } from "react";

interface ExtractionGate {
  // The only surviving gate field. distinct_contexts is read at save time by
  // the composer (not a gate); the rest of the old ripeness scorecard was
  // removed with the Jove-pushed checkpoint path (2026-07-03).
  distinct_contexts?: number;
}

export interface ExtractionSnapshot {
  depth?: string;
  mode?: string;
  checkpoint_gate?: ExtractionGate;
  sage_brief?: string;
}

export default function ExtractionPanel({
  snapshot,
  forceExpanded,
}: {
  snapshot: ExtractionSnapshot;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const isExpanded = forceExpanded || expanded;

  const gate = snapshot.checkpoint_gate;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          letterSpacing: "1px",
          textTransform: "uppercase" as const,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {isExpanded ? "▾" : "▸"} EXTRACTION
      </button>

      {isExpanded && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            color: "var(--session-ink-faded)",
            background: "var(--session-linen)",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 6,
            padding: 8,
            marginTop: 4,
            lineHeight: 1.6,
          }}
        >
          <div>
            Depth: {snapshot.depth || "none"} | Mode: {snapshot.mode || "none"}
          </div>
          {typeof gate?.distinct_contexts === "number" && (
            <div>Distinct contexts: {gate.distinct_contexts}</div>
          )}
          {snapshot.sage_brief && (
            <div style={{ marginTop: 2 }}>
              Brief: {snapshot.sage_brief.substring(0, 200)}
              {snapshot.sage_brief.length > 200 ? "..." : ""}
            </div>
          )}

          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              marginTop: 6,
              letterSpacing: "0.5px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {showRaw ? "▾ RAW JSON" : "▸ RAW JSON"}
          </button>
          {showRaw && (
            <div
              style={{
                marginTop: 4,
                whiteSpace: "pre-wrap",
                overflow: "auto",
                maxHeight: 300,
                fontSize: "var(--size-meta)",
              }}
            >
              {JSON.stringify(snapshot, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
