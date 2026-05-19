"use client";

import React, { useState } from "react";
import { type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import LayerHeader from "./LayerHeader";
import TabPip from "./TabPip";
import type { ExplorationContext, ManualEntry } from "@/lib/types";

type UpdateEntryResult =
  | { ok: true; entry: ManualEntry }
  | { ok: false; error: string };

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  onUpdateEntry?: (
    entryId: string,
    edits: { name?: string | null; content?: string }
  ) => Promise<UpdateEntryResult>;
  readOnly?: boolean;
}

/**
 * Walnut-glass Plate with the chapter pip tucked against the top
 * edge, an italic title band inside, and a stack of entries beneath.
 *
 * Pip lives as a sibling above the plate (not inside it). The plate
 * itself keeps overflow:visible and borderTopLeftRadius:1 so the
 * pip's bottom edge tucks 2px into the plate seam without clipping.
 * The italic Spectral layer name and info chip live inside the plate
 * body via LayerHeader. A per-layer accent hairline runs along the
 * plate's top edge — warmer at Layer I, cooler at Layer V.
 *
 * When the info popover opens, the host gets z-index 50 so the
 * popover paints above sibling Plates that come after in document
 * order.
 */
export default function PopulatedLayer({
  layer,
  onExploreWithPersona,
  onUpdateEntry,
  readOnly,
}: PopulatedLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        marginTop: 13,
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <span
        style={{
          display: "inline-block",
          marginLeft: 16,
          marginBottom: -2,
          position: "relative",
          zIndex: 2,
        }}
      >
        <TabPip layerId={layer.id} />
      </span>

      <section
        style={{
          position: "relative",
          borderRadius: 16,
          borderTopLeftRadius: 1,
          background: "var(--session-walnut-surface)",
          border: "1px solid var(--session-bubble-border)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "var(--session-plate-shadow)",
          padding: "20px var(--sp-sm) var(--sp-md)",
          overflow: "visible",
        }}
      >
        <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

        <div style={{ borderTop: "1px solid var(--session-hair-soft)", paddingTop: 2 }}>
          {layer.entries.map((entry, index) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              layerId={layer.id}
              layerName={layer.name}
              onExploreWithPersona={onExploreWithPersona}
              onUpdateEntry={onUpdateEntry}
              readOnly={readOnly}
              isLast={index === layer.entries.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
