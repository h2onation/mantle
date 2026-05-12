"use client";

import React from "react";
import type { Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import type { ExplorationContext } from "@/lib/types";

const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

export default function PopulatedLayer({ layer, onExploreWithPersona, readOnly }: PopulatedLayerProps) {
  const count = layer.entries.length;

  return (
    <section
      style={{
        marginBottom: 22,
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 8,
          paddingLeft: 4,
          paddingRight: 4,
          marginBottom: 10,
          borderBottom: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(220, 170, 120, 0.80)",
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
            color: "var(--session-walnut-meta)",
          }}
        >
          {count}
        </span>
      </div>

      {/* Entry cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {layer.entries.map((entry) => (
          <EntryItem
            key={entry.id}
            entry={entry}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithPersona={onExploreWithPersona}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}
