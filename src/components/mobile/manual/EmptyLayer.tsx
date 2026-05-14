"use client";

import React from "react";
import type { Layer } from "./layer-definitions";

const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

interface EmptyLayerProps {
  layer: Layer;
  readOnly?: boolean;
}

export default function EmptyLayer({ layer }: EmptyLayerProps) {
  return (
    <section
      style={{
        marginBottom: 6,
        padding: "9px 18px",
        borderRadius: 12,
        border: "1px solid rgba(170,120,82,0.06)",
        background: "rgba(115,72,42,0.04)",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(220,170,120,0.22)",
            marginRight: 10,
            flexShrink: 0,
          }}
        >
          {ROMAN[layer.id]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 14,
            fontWeight: 400,
            color: "rgba(245,243,238,0.28)",
          }}
        >
          {layer.name}
        </span>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color: "rgba(245,243,238,0.22)",
        }}
      >
        0
      </span>
    </section>
  );
}
