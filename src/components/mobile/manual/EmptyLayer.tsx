"use client";

import React from "react";
import type { Layer } from "./layer-definitions";
import LayerTooltip from "./LayerTooltip";
import type { ExplorationContext } from "@/lib/types";

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function EmptyLayer({ layer, onExploreWithSage }: EmptyLayerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0",
        borderBottom: "1px solid var(--session-ink-hairline)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 400,
          color: "var(--session-ink-whisper)",
          lineHeight: 1.3,
        }}
      >
        {layer.name}
      </span>

      {/* Info button wrapped in tooltip */}
      <LayerTooltip
        text={layer.about}
        showSageAction={true}
        onExploreWithSage={onExploreWithSage ? () => onExploreWithSage({
          layerId: layer.id,
          layerName: layer.name,
          type: "empty_layer",
          content: layer.about,
        }) : undefined}
      >
        <button
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--session-ink-ghost)",
            background: "none",
            border: "1px solid var(--session-ink-hairline)",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Explore
        </button>
      </LayerTooltip>
    </div>
  );
}
