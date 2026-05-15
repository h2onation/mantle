"use client";

import React, { useEffect, useRef, useState } from "react";
import { LAYER_ROMAN, type Layer } from "./layer-definitions";

interface LayerHeaderProps {
  layer: Layer;
  /** Called when the description popover toggles open/closed. Hosts
   *  use this to elevate the Plate's stacking context so the popover
   *  paints above sibling Plates that come after in document order. */
  onPopoverToggle?: (open: boolean) => void;
}

/**
 * Tab pip + info chip + description popover. Shared between
 * PopulatedLayer and EmptyLayer — both wear the same Layer header
 * regardless of body content.
 *
 * The tab pip protrudes from the top edge of the host Plate (left,
 * absolutely positioned with translateY(-50%)). The info chip mirrors
 * it on the right. Clicking the chip opens a popover anchored below
 * with the Layer's description text.
 */
export default function LayerHeader({ layer, onPopoverToggle }: LayerHeaderProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      {/* Tab pip — walnut chip protruding from the top-left edge.
          Theme-stable hardcoded walnut: cream-on-walnut needs a fixed
          dark walnut behind it; deriving from tokens would shift hue. */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 18,
          transform: "translateY(-50%)",
          maxWidth: 320,
          borderRadius: 8,
          background: "rgb(135, 90, 55)",
          color: "rgba(245, 243, 238, 0.96)",
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontStyle: "normal",
          fontWeight: 500,
          fontSize: 18,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          padding: "8px 18px",
          whiteSpace: "nowrap",
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        {LAYER_ROMAN[layer.id]}. {layer.name}
      </span>

      {/* Info chip — subtle outlined "i" at the top-right. Same position
          on every Plate (populated or empty) so the eye doesn't reorient. */}
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
          position: "absolute",
          top: 12,
          right: 14,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: open ? "var(--session-walnut-highlight)" : "transparent",
          color: open ? "var(--session-ink)" : "var(--session-walnut-meta)",
          border: `1px solid ${
            open
              ? "var(--session-walnut-meta-strong)"
              : "var(--session-walnut-meta)"
          }`,
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 12,
          lineHeight: 1,
          padding: "0 0 2px 0",
          cursor: "pointer",
          transition:
            "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease",
          WebkitTapHighlightColor: "transparent",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        i
      </button>

      {/* Description popover — always rendered for smooth transition,
          gated by opacity + pointer-events. Anchored below the info chip
          with a small arrow notch. */}
      <div
        ref={popoverRef}
        id={`layer-${layer.id}-desc`}
        role="dialog"
        aria-label={`Layer ${layer.id} description`}
        aria-hidden={!open}
        style={{
          position: "absolute",
          top: 36,
          right: 8,
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
        {/* Notch arrow — uses two layered spans (rotated square + bg
            cover) to draw a chevron pointing up to the info chip. */}
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
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 9,
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
            textWrap: "pretty" as React.CSSProperties["textWrap"],
          }}
        >
          {layer.about}
        </p>
      </div>
    </>
  );
}
