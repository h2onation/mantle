"use client";

import React, { useState } from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

const TAB_PIP_BASE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 18,
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "baseline",
  maxWidth: 320,
  padding: "8px 18px",
  borderRadius: 8,
  color: "var(--session-manual-tab-text)",
  fontFamily: "var(--font-spectral), var(--font-serif), serif",
  fontWeight: 500,
  fontSize: 18,
  lineHeight: 1,
  letterSpacing: "-0.01em",
  whiteSpace: "nowrap",
  boxShadow: "var(--session-manual-tab-shadow)",
};

export default function PopulatedLayer({
  layer,
  onExploreWithPersona,
  readOnly,
}: PopulatedLayerProps) {
  const [descOpen, setDescOpen] = useState(false);
  const [tabHover, setTabHover] = useState(false);
  const descId = `manual-layer-desc-${layer.id}`;

  const tabActive = tabHover || descOpen;

  // The tab pip is a non-interactive <span> in readOnly mode (admin
  // viewer) and a disclosure <button> for end users.
  const tabPip = readOnly ? (
    <span style={{ ...TAB_PIP_BASE, background: "var(--session-manual-tab-bg)" }}>
      {LAYER_ROMAN[layer.id]}. {layer.name}
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setDescOpen((v) => !v)}
      onPointerEnter={() => setTabHover(true)}
      onPointerLeave={() => setTabHover(false)}
      aria-expanded={descOpen}
      aria-controls={descId}
      aria-label={
        descOpen
          ? `Hide description for Layer ${LAYER_ROMAN[layer.id]}`
          : `Show description for Layer ${LAYER_ROMAN[layer.id]}`
      }
      style={{
        all: "unset",
        ...TAB_PIP_BASE,
        background: tabActive
          ? "var(--session-manual-tab-bg-hover)"
          : "var(--session-manual-tab-bg)",
        cursor: "pointer",
        transition: "background-color 0.18s ease",
        WebkitTapHighlightColor: "transparent",
        boxSizing: "border-box",
      }}
    >
      <span>
        {LAYER_ROMAN[layer.id]}. {layer.name}
      </span>
      <span
        aria-hidden="true"
        style={{
          marginLeft: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1,
          color: "var(--session-manual-tab-chev)",
          display: "inline-block",
          transform: descOpen ? "rotate(90deg)" : "rotate(0deg)",
          transformOrigin: "center",
          transition: "transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        ›
      </span>
    </button>
  );

  return (
    <section
      style={{
        position: "relative",
        marginTop: 13,
        padding: "24px 16px 22px",
        borderRadius: 18,
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-bubble-border)",
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "var(--session-manual-plate-shadow)",
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      {tabPip}

      {!readOnly && (
        <div
          id={descId}
          style={{
            display: "grid",
            gridTemplateRows: descOpen ? "1fr" : "0fr",
            opacity: descOpen ? 1 : 0,
            transition:
              "grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.24s ease-out",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <p
              style={{
                margin: 0,
                paddingBottom: 20,
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "var(--session-ink-mid)",
                textWrap: "pretty" as React.CSSProperties["textWrap"],
              }}
            >
              {layer.about}
            </p>
          </div>
        </div>
      )}

      <div>
        {layer.entries.map((entry, idx) => (
          <EntryItem
            key={entry.id}
            entry={entry}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithPersona={onExploreWithPersona}
            readOnly={readOnly}
            isFirst={idx === 0}
          />
        ))}
      </div>
    </section>
  );
}
