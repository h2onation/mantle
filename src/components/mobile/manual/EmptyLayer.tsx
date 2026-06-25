"use client";

import { type Layer, SECTION_TILE_STYLE } from "./layer-definitions";
import LayerHeader from "./LayerHeader";
import type { ExplorationContext } from "@/lib/types";

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

/**
 * Empty section — a white tile in the same material as Home, whose entire
 * surface taps through to start the section with Jove. Emblem in walnut, the
 * section name + tagline, and a "Start →" cue. Mirrors Home's empty section
 * rows exactly, so the Manual and Home read as one product.
 */
export default function EmptyLayer({
  layer,
  onExploreWithPersona,
  readOnly,
}: EmptyLayerProps) {
  const canTap = !readOnly && !!onExploreWithPersona;

  const handleTap = canTap
    ? () => {
        onExploreWithPersona!({
          layerId: layer.id,
          layerName: layer.name,
          type: "empty_layer",
          content: layer.about,
        });
      }
    : undefined;

  return (
    <section
      onClick={handleTap}
      role={canTap ? "button" : undefined}
      tabIndex={canTap ? 0 : undefined}
      aria-label={canTap ? `Start ${layer.name} with Jove` : undefined}
      onKeyDown={
        canTap
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTap!();
              }
            }
          : undefined
      }
      style={{
        ...SECTION_TILE_STYLE,
        cursor: canTap ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <LayerHeader layer={layer} readOnly={readOnly} />
    </section>
  );
}
