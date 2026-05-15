"use client";

import React from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";

// Inline copy for the empty body. The layer.about strings (from
// src/lib/manual/layers.ts) are written for prompt context and read too
// long on the Manual page. These are the short, scannable lines from the
// design spec — Roman base copy with italic example phrases after the
// em-dash. Layer 1-5, indexed by layer.id.
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

export default function EmptyLayer({ layer, onExploreWithPersona, readOnly }: EmptyLayerProps) {
  const descriptor = EMPTY_DESCRIPTORS[layer.id] ?? { lead: layer.about, phrases: "" };
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
        marginBottom: 22,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          padding: "13px 18px 11px",
          background: "linear-gradient(180deg, rgba(180,125,75,0.46) 0%, rgba(135,88,52,0.34) 100%)",
          borderBottom: "1px solid var(--session-walnut-border)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.10em",
            color: "var(--session-walnut-meta)",
            marginRight: 12,
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          {LAYER_ROMAN[layer.id]}.
        </span>
        <h2
          style={{
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--session-ink)",
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {layer.name}
        </h2>
      </div>

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
          padding: "16px 18px 18px",
          background: "var(--session-walnut-tint)",
          cursor: canTap ? "pointer" : "default",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <p
          style={{
            margin: "0 0 14px",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15.5,
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--session-ink)",
          }}
        >
          {descriptor.lead}
          {descriptor.phrases ? (
            <>
              {" — "}
              <em style={{ fontStyle: "italic", color: "var(--session-ink)" }}>{descriptor.phrases}</em>
            </>
          ) : null}
          .
        </p>
        <p
          style={{
            margin: 0,
            paddingTop: 12,
            borderTop: "1px dotted var(--session-hair-faint)",
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.3,
            textAlign: "right",
            letterSpacing: "0.005em",
          }}
        >
          <span style={{ color: "var(--session-ink-faded)", fontWeight: 400 }}>Nothing documented yet</span>
          <span style={{ color: "var(--session-ink-faded)", margin: "0 4px" }}>—</span>
          <span style={{ color: "var(--session-ink)", fontWeight: 500 }}>
            explore with Jove
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-mono)",
                fontStyle: "normal",
                color: "var(--session-walnut)",
                fontSize: 15,
                marginLeft: 5,
                display: "inline-block",
                verticalAlign: -1,
              }}
            >
              →
            </span>
          </span>
        </p>
      </div>
    </section>
  );
}
