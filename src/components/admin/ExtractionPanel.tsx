"use client";

import { useState } from "react";

interface ExtractionGate {
  concrete_examples: number;
  has_mechanism: boolean;
  has_charged_language: boolean;
  has_behavior_driver_link: boolean;
  strongest_layer?: number;
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
  const gateMet = gate
    ? gate.concrete_examples >= 2 &&
      gate.has_mechanism &&
      gate.has_charged_language &&
      gate.has_behavior_driver_link
    : false;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
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
            fontSize: "9px",
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
          {gate && (
            <>
              <div>
                Gate: {gate.concrete_examples} examples, mechanism:{" "}
                {gate.has_mechanism ? "y" : "n"}, charged:{" "}
                {gate.has_charged_language ? "y" : "n"}, driver:{" "}
                {gate.has_behavior_driver_link ? "y" : "n"}
              </div>
              <div>
                Gate met: {gateMet ? "yes" : "no"} | Strongest: L
                {gate.strongest_layer ?? "?"}
              </div>
            </>
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
              fontSize: "8px",
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
                fontSize: "9px",
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
