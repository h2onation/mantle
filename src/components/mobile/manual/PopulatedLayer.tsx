"use client";

import React, { useEffect, useRef, useState } from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";
import EntryItem from "./EntryItem";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

export default function PopulatedLayer({ layer, onExploreWithPersona, readOnly }: PopulatedLayerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [popoverOpen]);

  return (
    <section
      style={{
        marginBottom: 22,
        overflow: "visible",
        ...(layer.isNew ? { animation: "layerFadeUp 0.5s ease-out both" } : {}),
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
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
            flex: 1,
            minWidth: 0,
          }}
        >
          {layer.name}
        </h2>
        {!readOnly && (
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            <button
              ref={buttonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPopoverOpen((v) => !v);
              }}
              aria-label={`About Layer ${layer.id}`}
              aria-expanded={popoverOpen}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1px solid var(--session-walnut-meta)",
                color: popoverOpen ? "var(--session-ink)" : "var(--session-walnut-meta)",
                background: popoverOpen ? "var(--session-walnut-highlight)" : "transparent",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: 11,
                lineHeight: "15px",
                textAlign: "center",
                padding: 0,
                cursor: "pointer",
                transition: "background .18s ease, color .18s ease",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              i
            </button>
            {popoverOpen && (
              <div
                ref={popoverRef}
                role="dialog"
                aria-label={`Layer ${layer.id} description`}
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: -6,
                  width: 270,
                  background: "var(--session-parchment)",
                  border: "1px solid var(--session-walnut-border)",
                  borderRadius: 8,
                  boxShadow: "var(--session-popover-shadow)",
                  padding: "14px 16px 15px",
                  zIndex: 20,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: 12,
                    width: 11,
                    height: 11,
                    background: "var(--session-parchment)",
                    borderTop: "1px solid var(--session-walnut-border)",
                    borderLeft: "1px solid var(--session-walnut-border)",
                    transform: "rotate(45deg)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 7,
                    width: 21,
                    height: 1.5,
                    background: "var(--session-parchment)",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontStyle: "normal",
                    fontWeight: 500,
                    fontSize: 9,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "var(--session-walnut)",
                    marginBottom: 8,
                  }}
                >
                  LAYER {layer.id}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-spectral), var(--font-serif), serif",
                    fontStyle: "normal",
                    fontWeight: 400,
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--session-ink)",
                  }}
                >
                  {layer.about}
                </p>
              </div>
            )}
          </span>
        )}
      </div>

      <div style={{ padding: "4px 18px 6px" }}>
        {layer.entries.map((entry, index) => (
          <EntryItem
            key={entry.id}
            entry={entry}
            layerId={layer.id}
            layerName={layer.name}
            onExploreWithPersona={onExploreWithPersona}
            readOnly={readOnly}
            isLast={index === layer.entries.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
