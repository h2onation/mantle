"use client";

import React, { useState } from "react";
import { type Layer } from "./layer-definitions";
import LayerHeader from "./LayerHeader";
import TabPip from "./TabPip";
import { LAYER_EMPTY_STATUS, LAYER_EMPTY_INVITE } from "@/lib/manual/layers";
import type { ExplorationContext } from "@/lib/types";

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

/**
 * Empty Layer Plate — one resting state. The plate is the doorway.
 *
 * Composition (top to bottom):
 *   1. Pip tucked into the top-left edge.
 *   2. Per-layer accent hairline along the top (from LayerHeader).
 *   3. Title band: italic layer name + info chip.
 *   4. Status — italic sentence naming the absence AND what the
 *      layer is for in one breath ("Nothing about X yet").
 *   5. Invite — italic Jove-voiced sentence. The invitation in.
 *   6. "Explore with Jove" text-link — same mono-caps walnut
 *      affordance used inside populated entries.
 *
 * Visual signals of emptiness:
 *   • No entry rows under the title.
 *   • Plate has border + transparent fill, no shadow.
 *   • The prose itself names "Nothing… yet".
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
    <div
      style={{
        position: "relative",
        zIndex: popoverOpen ? 50 : "auto",
        marginTop: 13,
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
          borderRadius: 16,
          borderTopLeftRadius: 1,
          background: "transparent",
          border: "1px solid var(--session-walnut-border)",
          boxShadow: "none",
          padding: "20px var(--sp-sm) var(--sp-md)",
          overflow: "visible",
          cursor: canTap ? "pointer" : "default",
          WebkitTapHighlightColor: "transparent",
          transition: "background-color 0.18s ease",
        }}
      >
        <LayerHeader layer={layer} onPopoverToggle={setPopoverOpen} />

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
            margin: "10px 0 18px",
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
      </section>
    </div>
  );
}
