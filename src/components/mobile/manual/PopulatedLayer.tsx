"use client";

import { useState } from "react";
import { type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import LayerHeader from "./LayerHeader";
import type { ManualEntry } from "@/lib/types";

type UpdateEntryResult =
  | { ok: true; entry: ManualEntry }
  | { ok: false; error: string };

interface PopulatedLayerProps {
  layer: Layer;
  onUpdateEntry?: (
    entryId: string,
    edits: { name?: string | null; content?: string }
  ) => Promise<UpdateEntryResult>;
  readOnly?: boolean;
}

/**
 * A layer in the Manual: an editorial header (Roman numeral + caps name +
 * hairline rule + entry count + collapse chevron) that toggles a stack of
 * entry cards. Collapsed by default so the Manual reads as an overview
 * first; tap a layer to read its entries. "Go deeper with Jove" lives on
 * Home now, so the read view stays a clean read + edit. The admin/PDF
 * (readOnly) path renders everything open and non-collapsible.
 */
export default function PopulatedLayer({
  layer,
  onUpdateEntry,
  readOnly,
}: PopulatedLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(!readOnly);
  const open = readOnly || !collapsed;

  return (
    <section
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <div
        role={readOnly ? undefined : "button"}
        aria-expanded={readOnly ? undefined : open}
        aria-label={
          readOnly
            ? undefined
            : `${open ? "Collapse" : "Expand"} ${layer.name}, ${layer.entries.length} ${
                layer.entries.length === 1 ? "entry" : "entries"
              }`
        }
        onClick={readOnly ? undefined : () => setCollapsed((c) => !c)}
        style={{
          cursor: readOnly ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <LayerHeader
          layer={layer}
          onPopoverToggle={setPopoverOpen}
          count={readOnly ? undefined : layer.entries.length}
          collapsed={collapsed}
        />
      </div>

      {open && (
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
              onUpdateEntry={onUpdateEntry}
              readOnly={readOnly}
              alwaysOpen
            />
          ))}
        </div>
      )}
    </section>
  );
}
