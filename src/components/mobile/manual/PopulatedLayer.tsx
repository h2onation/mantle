"use client";

import React from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import type { ExplorationContext } from "@/lib/types";

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
        borderRadius: 12,
        border: "1px solid var(--session-walnut-border)",
        overflow: "hidden",
        backdropFilter: "blur(20px) saturate(130%)",
        WebkitBackdropFilter: "blur(20px) saturate(130%)",
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 18px 11px",
          background: "linear-gradient(180deg, rgba(180,125,75,0.46) 0%, rgba(135,88,52,0.34) 100%)",
          borderBottom: "1px solid rgba(170,120,82,0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "rgba(220,175,130,0.70)",
              marginRight: 10,
              flexShrink: 0,
            }}
          >
            {LAYER_ROMAN[layer.id]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255,250,242,0.96)",
              letterSpacing: "-0.2px",
              lineHeight: 1.3,
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
            color: "rgba(220,175,130,0.55)",
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          {count}
        </span>
      </div>

      {layer.entries.map((entry, index) => (
        <EntryItem
          key={entry.id}
          entry={entry}
          layerId={layer.id}
          layerName={layer.name}
          onExploreWithPersona={onExploreWithPersona}
          readOnly={readOnly}
          showDivider={index > 0}
        />
      ))}
    </section>
  );
}
