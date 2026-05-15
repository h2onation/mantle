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
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {populatedLayers.map((layer) => (
          <PopulatedLayer key={layer.id} layer={layer} readOnly />
        ))}
      </div>
      {emptyLayers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              margin: "32px 0 8px",
            }}
          >
            UPCOMING
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {emptyLayers.map((layer) => (
              <EmptyLayer key={layer.id} layer={layer} readOnly />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
