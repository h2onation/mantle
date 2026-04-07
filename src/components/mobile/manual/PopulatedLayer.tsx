"use client";

import React from "react";
import type { Layer } from "./layer-definitions";
import PatternItem from "./PatternItem";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithSage?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

export default function PopulatedLayer({ layer, onExploreWithSage, readOnly }: PopulatedLayerProps) {
  const count = layer.threads.length;
  const countLabel = count === 1 ? "1 entry" : `${count} entries`;

  return (
    <section
      style={{
        marginBottom: 32,
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      {/* Section header — flat */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "0.5px solid var(--session-ink-hairline)",
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 500,
            color: "var(--session-ink)",
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
          {countLabel}
        </span>
      </div>

      {/* Thread cards */}
      <div>
        {layer.threads.map((thread) => (
          <PatternItem
            key={thread.id}
            thread={thread}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithSage={onExploreWithSage}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}
