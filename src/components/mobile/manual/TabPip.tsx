"use client";

import React from "react";
import { LAYER_ROMAN } from "./layer-definitions";

interface TabPipProps {
  layerId: number;
  /** Kept on the prop signature for backward compatibility with
   *  existing callers; the pip no longer renders the name. */
  layerName?: string;
}

/**
 * Manual page tab pip — narrow chapter mark that tucks against the
 * top edge of a Plate. The pip carries only the ordinal ("LAYER III")
 * so the layer name can live in the plate body as the section title.
 * Shared between the Manual page and the in-chat checkpoint trigger
 * card.
 *
 * Theme-stable hardcoded walnut: cream-on-walnut needs a fixed dark
 * walnut behind it; deriving from tokens would shift hue across themes.
 *
 * Positioned by the host. Recommended host wrapper:
 *   <span style={{ display: "inline-block", marginLeft: 16,
 *                  marginBottom: -2, position: "relative", zIndex: 2 }}>
 *     <TabPip layerId={...} />
 *   </span>
 * (the bottom edge tucks 2px into the plate so the seam fades).
 */
export default function TabPip({ layerId }: TabPipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 7,
        background:
          "linear-gradient(180deg, rgb(148,98,60) 0%, rgb(118,76,44) 100%)",
        color: "rgba(248, 240, 220, 0.97)",
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        padding: "6px 12px 7px",
        boxShadow:
          "0 -1px 4px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,225,190,0.18)",
        border: "1px solid rgba(60, 36, 14, 0.45)",
        borderBottom: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          textTransform: "uppercase",
          fontSize: 9,
          letterSpacing: "0.32em",
          color: "rgba(248, 232, 200, 0.55)",
          fontWeight: 500,
          lineHeight: 1,
          paddingLeft: "0.32em",
        }}
      >
        LAYER
      </span>
      <span
        style={{
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontStyle: "normal",
          fontWeight: 500,
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: "0.03em",
          fontFeatureSettings: '"lnum"',
        }}
      >
        {LAYER_ROMAN[layerId]}
      </span>
    </span>
  );
}
