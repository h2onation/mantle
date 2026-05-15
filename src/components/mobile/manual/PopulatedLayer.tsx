"use client";

import React, { useState } from "react";
import { type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import LayerHeader from "./LayerHeader";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

/**
 * Walnut-glass Plate with a tab pip protruding from the top edge, an
 * info chip for the Layer description, and a stack of entries beneath.
 *
 * The Plate uses --session-plate-shadow (theme-tuned: deep multi-layer
 * drop in Hearth, gentle ink shadow in Bloom) to lift it off the
 * gradient. The tab pip and info chip both protrude from the top
 * edge, vertically centered on the edge line, so the Plate reads as a
 * bound section with its title pinned to a manila tab.
 *
 * When the info popover opens, the host Plate gets z-index 50 so the
 * popover paints above the next Plate in document order — without
 * this, sibling Plates would cover it.
 */
export default function PopulatedLayer({
  layer,
  onExploreWithPersona,
  readOnly,
}: PopulatedLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <section
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        borderRadius: 18,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-bubble-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "var(--session-plate-shadow)",
        padding: "26px var(--sp-sm) var(--sp-md)",
        marginTop: 13,
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

      <div>
        {layer.entries.map((entry, index) => (
          <EntryItem
            key={entry.id}
            entry={entry}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithPersona={onExploreWithPersona}
            readOnly={readOnly}
            isLast={index === layer.entries.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
