"use client";

import { useState } from "react";
import { type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import LayerHeader from "./LayerHeader";
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
 * A layer in the Manual: an editorial header (brass Roman numeral +
 * caps name + hairline rule + info chip) followed by a stack of entry
 * cards. Each entry is its own card (see EntryItem) rather than a row
 * inside a plate — the page reads as a sequence of titled sections.
 *
 * When the header's info popover opens the host gets z-index 50 so the
 * popover paints above sibling layers that come after in document order.
 */
export default function PopulatedLayer({
  layer,
  onExploreWithPersona,
  onUpdateEntry,
  readOnly,
}: PopulatedLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <section
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {layer.entries.map((entry) => (
          <EntryItem
            key={entry.id}
            entry={entry}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithPersona={onExploreWithPersona}
            onUpdateEntry={onUpdateEntry}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}
