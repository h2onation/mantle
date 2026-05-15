"use client";

import React, { useState } from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";

// Inline copy for the empty body. The layer.about strings (from
// src/lib/manual/layers.ts) are written for prompt context and read too
// long on the Manual page. These are the short, scannable lines from
// the design spec — Roman base copy with italic example phrases after
// the em-dash. Layer 1-5, indexed by layer.id.
type EmptyDescriptor = { lead: string; phrases: string };
const EMPTY_DESCRIPTORS: Record<number, EmptyDescriptor> = {
  1: { lead: "Behavior others might misread", phrases: "silence, freezing, masking, shutdown" },
  2: { lead: "How information lands", phrases: "sensory experience, change, overload" },
  3: { lead: "What you need to function", phrases: "alone time, routine, recovery, environment" },
  4: { lead: "How you show up with people", phrases: "connection, withdrawal, conflict, care" },
  5: { lead: "Strengths in supportive conditions", phrases: "deep focus, pattern detection, sustained work" },
};

interface EmptyLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

export default function EmptyLayer({
  layer,
  onExploreWithPersona,
  readOnly,
}: EmptyLayerProps) {
  const descriptor = EMPTY_DESCRIPTORS[layer.id] ?? {
    lead: layer.about,
    phrases: "",
  };
  const canTap = !readOnly && !!onExploreWithPersona;
  const [hover, setHover] = useState(false);

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
      onPointerEnter={() => canTap && setHover(true)}
      onPointerLeave={() => setHover(false)}
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
        marginTop: 13,
        padding: "20px 16px",
        borderRadius: 18,
        // Same Plate vocabulary as populated — surface, border, glass.
        // The single differentiator is the missing shadow: an empty
        // Plate sits flush, a populated Plate lifts.
        background: hover && canTap
          ? "var(--session-walnut-surface-soft)"
          : "var(--session-walnut-surface)",
        border: "1px solid var(--session-bubble-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        cursor: canTap ? "pointer" : "default",
        transition: "background-color 0.18s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 18,
          transform: "translateY(-50%)",
          display: "inline-flex",
          alignItems: "baseline",
          maxWidth: 320,
          padding: "8px 18px",
          borderRadius: 8,
          background: "var(--session-manual-tab-bg)",
          color: "var(--session-manual-tab-text)",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontWeight: 500,
          fontSize: 18,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          boxShadow: "var(--session-manual-tab-shadow)",
        }}
      >
        {LAYER_ROMAN[layer.id]}. {layer.name}
      </span>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontWeight: 400,
          fontSize: 14.5,
          lineHeight: 1.4,
          color: "var(--session-ink-mid)",
          textWrap: "pretty" as React.CSSProperties["textWrap"],
        }}
      >
        {descriptor.lead}
        {descriptor.phrases ? (
          <>
            {" — "}
            <em style={{ fontStyle: "italic" }}>{descriptor.phrases}</em>
          </>
        ) : null}
        .
      </p>

      {canTap && (
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <span
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "italic",
              fontSize: 14.5,
              color: "var(--session-walnut)",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            explore with Jove
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-mono)",
                fontStyle: "normal",
                fontSize: 15,
                color: "var(--session-walnut)",
                display: "inline-block",
                verticalAlign: -1,
                transform: hover ? "translateX(2px)" : "translateX(0)",
                transition: "transform 0.18s ease",
              }}
            >
              →
            </span>
          </span>
        </div>
      )}
    </section>
  );
}
