"use client";

import React, { useEffect, useRef, useState } from "react";
import { type Layer } from "./layer-definitions";

interface LayerHeaderProps {
  layer: Layer;
  /** Called when the description popover toggles open/closed. Hosts
   *  use this to elevate the Plate's stacking context so the popover
   *  paints above sibling Plates that come after in document order. */
  onPopoverToggle?: (open: boolean) => void;
}

/**
 * Per-layer accent gradient (warmer at I, cooler at V). Quiet thread
 * across the plate's top edge so the eye registers progress across
 * the five layers without needing more chrome.
 */
const LAYER_ACCENT: Record<number, [string, string]> = {
  1: ["rgba(220,140,80,0.80)", "rgba(220,140,80,0)"],
  2: ["rgba(210,160,100,0.72)", "rgba(210,160,100,0)"],
  3: ["rgba(200,170,130,0.65)", "rgba(200,170,130,0)"],
  4: ["rgba(170,150,135,0.58)", "rgba(170,150,135,0)"],
  5: ["rgba(150,140,140,0.52)", "rgba(150,140,140,0)"],
};

/**
 * Renders a per-layer accent hairline along the plate's top edge,
 * plus a title band (italic Spectral name + info chip with
 * description popover).
 *
 * The pip lives outside this component — it's rendered by the host
 * (PopulatedLayer / EmptyLayer) as a sibling above the plate so it
 * can tuck against the plate's top edge without being clipped.
 *
 * Host plate must use position: relative; overflow: visible;
 * border-top-left-radius: 1px.
 */
export default function LayerHeader({ layer, onPopoverToggle }: LayerHeaderProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const accent = LAYER_ACCENT[layer.id] ?? LAYER_ACCENT[1];

  function setOpenAndNotify(next: boolean) {
    setOpen(next);
    onPopoverToggle?.(next);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpenAndNotify(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenAndNotify(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, ${accent[0]} 0%, ${accent[0]} 18%, ${accent[1]} 100%)`,
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 22,
            lineHeight: 1.14,
            letterSpacing: "-0.012em",
            color: "var(--session-ink)",
            fontFeatureSettings: '"liga","dlig","kern","swsh"',
            flex: 1,
            minWidth: 0,
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          {layer.name}
        </h2>

        <span style={{ position: "relative", flexShrink: 0, transform: "translateY(-2px)" }}>
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenAndNotify(!open);
            }}
            aria-expanded={open}
            aria-controls={`layer-${layer.id}-desc`}
            aria-label={`About Layer ${layer.id}`}
            style={{
              all: "unset",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: open
                ? "var(--session-walnut-highlight)"
                : "transparent",
              color: open
                ? "var(--session-ink)"
                : "var(--session-walnut-meta)",
              border: `1px solid ${
                open
                  ? "var(--session-walnut-meta-strong)"
                  : "var(--session-walnut-meta)"
              }`,
              cursor: "pointer",
              transition:
                "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease",
              WebkitTapHighlightColor: "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="2" height="9" viewBox="0 0 2 9" fill="currentColor" aria-hidden="true">
              <circle cx="1" cy="1" r="1" />
              <rect x="0" y="3.5" width="2" height="5.5" rx="1" />
            </svg>
          </button>

          <div
            ref={popoverRef}
            id={`layer-${layer.id}-desc`}
            role="dialog"
            aria-label={`Layer ${layer.id} description`}
            aria-hidden={!open}
            style={{
              position: "absolute",
              top: 36,
              right: 0,
              width: 270,
              background: "var(--session-parchment)",
              border: "1px solid var(--session-walnut-border)",
              borderRadius: 10,
              padding: "14px 16px 16px",
              boxShadow: "var(--session-popover-shadow)",
              zIndex: 60,
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
              transform: open ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -6,
                right: 14,
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
                display: "block",
                fontFamily: "var(--font-mono), monospace",
                fontWeight: 500,
                fontSize: 9,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--session-walnut)",
                marginBottom: 8,
              }}
            >
              About this layer
            </span>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontWeight: 400,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--session-ink)",
                textWrap: "pretty" as React.CSSProperties["textWrap"],
              }}
            >
              {layer.about}
            </p>
          </div>
        </span>
      </header>
    </>
  );
}
