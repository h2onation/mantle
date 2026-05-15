"use client";

import type { ManualEntry } from "@/lib/types";
import { buildLayers } from "@/components/mobile/manual/layer-definitions";
import PopulatedLayer from "@/components/mobile/manual/PopulatedLayer";
import EmptyLayer from "@/components/mobile/manual/EmptyLayer";

export default function AdminManualView({
  entries,
}: {
  entries: ManualEntry[];
}) {
  const layers = buildLayers(entries);
  const populatedLayers = layers.filter((l) => l.entries.length > 0);
  const emptyLayers = layers.filter((l) => l.entries.length === 0);
  const isEmpty = populatedLayers.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink-mid)",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        No manual entries yet
      </div>
    );
  }

  return (
    // Flex column with gap — each Plate's tab pip protrudes from its
    // top edge, so subsequent Plates need vertical clearance above
    // their box. The `gap` provides it; padding-top gives the first
    // Plate's pip room within the parent.
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-md)",
        paddingTop: 18,
      }}
    >
      {populatedLayers.map((layer) => (
        <PopulatedLayer key={layer.id} layer={layer} readOnly />
      ))}
      {emptyLayers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              margin: "8px 0 0",
            }}
          >
            UPCOMING
          </div>
          {emptyLayers.map((layer) => (
            <EmptyLayer key={layer.id} layer={layer} readOnly />
          ))}
        </>
      )}
    </div>
  );
}
