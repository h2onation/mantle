"use client";

import type { ManualComponent } from "@/lib/types";
import { buildLayers } from "@/components/mobile/manual/layer-definitions";
import PopulatedLayer from "@/components/mobile/manual/PopulatedLayer";
import EmptyLayer from "@/components/mobile/manual/EmptyLayer";

export default function AdminManualView({
  components,
}: {
  components: ManualComponent[];
}) {
  const layers = buildLayers(components);
  const populatedLayers = layers.filter((l) => l.threads.length > 0);
  const emptyLayers = layers.filter((l) => l.threads.length === 0);
  const isEmpty = populatedLayers.length === 0;

  if (isEmpty) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--session-ink-ghost)",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        No manual entries yet
      </div>
    );
  }

  return (
    <div>
      {populatedLayers.map((layer) => (
        <PopulatedLayer key={layer.id} layer={layer} readOnly />
      ))}
      {emptyLayers.length > 0 && (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
              margin: "16px 0 8px",
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
