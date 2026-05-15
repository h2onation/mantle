"use client";

import React, { useState } from "react";
import { type Layer } from "./layer-definitions";
import LayerHeader from "./LayerHeader";
import type { ExplorationContext } from "@/lib/types";

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

/**
 * Empty Layer Plate — same vocabulary as PopulatedLayer (tab pip + info
 * chip + walnut-glass surface), but the box-shadow is suppressed and
 * the body is two short italic lines: a quiet status and the on-brand
 * CTA. The whole Plate is the tap target.
 *
 * Why no shadow: the Hearth three-layer drop says "this Plate has
 * weight on it"; an empty Plate hasn't accumulated anything yet, so it
 * reads as subordinate to a populated one. Same family, less lift.
 *
 * Why no descriptor in the body: it lives behind the info chip, same
 * place it lives on populated Plates. The eye doesn't reorient when
 * scanning across five Layers — only the body line(s) differ.
 */
export default function EmptyLayer({
  layer,
  onExploreWithPersona,
  readOnly,
}: EmptyLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
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
      aria-label={canTap ? `Explore ${layer.name} with Jove` : undefined}
      tabIndex={canTap ? 0 : undefined}
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
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        borderRadius: 18,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-walnut-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        // Shadow suppressed — see comment above.
        boxShadow: "none",
        padding: "26px var(--sp-sm) var(--sp-md)",
        marginTop: 13,
        cursor: canTap ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
        transition: "background-color 0.18s ease",
      }}
    >
      <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

      <div style={{ padding: "var(--sp-xs) 0 var(--sp-tight)" }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.4,
            letterSpacing: 0,
            color: "var(--session-ink-mid)",
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          No patterns discovered yet.
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 15,
            lineHeight: 1.3,
            letterSpacing: "0.005em",
            color: "var(--session-walnut-meta-strong)",
          }}
        >
          Explore with Jove
        </p>
      </div>
    </section>
  );
}
