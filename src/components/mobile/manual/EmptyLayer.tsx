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
    <section style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 8,
          paddingLeft: 4,
          paddingRight: 4,
          borderBottom: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(220, 170, 120, 0.55)",
          }}
        >
          Layer {ROMAN[layer.id]} · {layer.name}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          0
        </span>
      </div>
    </section>
  );
}
