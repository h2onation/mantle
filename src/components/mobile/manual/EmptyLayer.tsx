"use client";

import React from "react";
import type { Layer } from "./layer-definitions";

interface EmptyLayerProps {
  layer: Layer;
  // Kept for prop-shape compatibility with PopulatedLayer callers; unused now
  // that the Explore button has been removed.
  readOnly?: boolean;
}

export default function EmptyLayer({ layer }: EmptyLayerProps) {
  return (
    <section style={{ marginBottom: 32 }}>
      {/* Section header — muted, flat */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "0.5px solid var(--session-ink-hairline)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 500,
            color: "var(--session-ink-mid)",
            margin: 0,
            letterSpacing: "-0.1px",
            lineHeight: 1.3,
          }}
        >
          {layer.name}
        </h2>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--session-ink-ghost)",
            lineHeight: 1.3,
          }}
        >
          0 entries
        </span>
      </div>
    </section>
  );
}
