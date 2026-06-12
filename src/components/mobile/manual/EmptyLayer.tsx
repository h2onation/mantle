"use client";

import React, { useState } from "react";
import { type Layer } from "./layer-definitions";
import LayerHeader from "./LayerHeader";
import { LAYER_EMPTY_STATUS, LAYER_EMPTY_INVITE } from "@/lib/manual/layers";
import type { ExplorationContext } from "@/lib/types";

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

/**
 * Empty layer — the editorial header (numeral + name + rule + info)
 * followed by a single quiet, tappable card that names the absence and
 * invites the user in. The card is a doorway: hairline border, no fill,
 * no shadow, so it reads as not-yet-written next to the solid entry
 * cards of populated layers.
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
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
      }}
    >
      <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

      <div
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
          borderRadius: 10,
          background: "transparent",
          border: "1px solid var(--session-hair-soft)",
          padding: "16px 18px",
          cursor: canTap ? "pointer" : "default",
          WebkitTapHighlightColor: "transparent",
          transition: "background-color 0.18s ease, border-color 0.18s ease",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.42,
            letterSpacing: "-0.003em",
            color: "var(--session-ink-soft)",
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          {LAYER_EMPTY_STATUS[layer.id]}
        </p>

        <p
          style={{
            margin: "10px 0 16px",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--session-ink-mid)",
            textWrap: "pretty" as React.CSSProperties["textWrap"],
          }}
        >
          {LAYER_EMPTY_INVITE[layer.id]}
        </p>

        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            paddingBottom: 2,
            borderBottom: "1px solid var(--session-walnut)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "var(--session-walnut)",
            fontWeight: 500,
          }}
        >
          Explore with Jove
          <span aria-hidden="true" style={{ marginLeft: 5 }}>›</span>
        </span>
      </div>
    </section>
  );
}
