"use client";

import React from "react";
import type { Layer } from "./ManualMockData";
import LayerTooltip from "./LayerTooltip";

interface EmptyLayerProps {
  layer: Layer;
}

export default function EmptyLayer({ layer }: EmptyLayerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0",
        borderBottom: "1px solid rgba(212, 203, 192, 0.04)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          fontWeight: 430,
          color: "rgba(212, 203, 192, 0.28)",
          lineHeight: 1.3,
        }}
      >
        {layer.name}
      </span>

      {/* Info button wrapped in tooltip */}
      <LayerTooltip text={layer.about} showSageAction={true}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "rgba(212, 203, 192, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{ display: "block" }}
          >
            <circle cx="5" cy="2" r="1" fill="rgba(212, 203, 192, 0.25)" />
            <line
              x1="5"
              y1="4.5"
              x2="5"
              y2="8.5"
              stroke="rgba(212, 203, 192, 0.25)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </LayerTooltip>
    </div>
  );
}
