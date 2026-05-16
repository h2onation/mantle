"use client";

import React from "react";
import { LAYER_ROMAN } from "./layer-definitions";

interface TabPipProps {
  layerId: number;
  layerName: string;
}

/**
 * Manual page tab pip — the walnut chip that protrudes from the top
 * edge of a Plate carrying `I. Layer Name`. Shared between the Manual
 * page (LayerHeader) and the in-chat checkpoint trigger card so both
 * surfaces wear the same chapter mark and the user reads them as the
 * same artifact at different lifecycle stages.
 *
 * Theme-stable hardcoded walnut: cream-on-walnut needs a fixed dark
 * walnut behind it; deriving from tokens would shift hue across themes.
 *
 * Positioned by the host (absolute, on the top edge). The pip itself
 * has no positioning of its own beyond block-level layout — the host
 * applies `position: absolute; top: 0; left: 18px; transform:
 * translateY(-50%)` (or equivalent) to anchor it to the Plate's edge.
 */
export default function TabPip({ layerId, layerName }: TabPipProps) {
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: 320,
        borderRadius: 7,
        background: "rgb(135, 90, 55)",
        color: "rgba(245, 243, 238, 0.96)",
        fontFamily: "var(--font-spectral), var(--font-serif), serif",
        fontStyle: "normal",
        fontWeight: 500,
        fontSize: 15.5,
        lineHeight: 1,
        letterSpacing: "-0.003em",
        padding: "7px 13px",
        whiteSpace: "nowrap",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)",
      }}
    >
      {LAYER_ROMAN[layerId]}. {layerName}
    </span>
  );
}
