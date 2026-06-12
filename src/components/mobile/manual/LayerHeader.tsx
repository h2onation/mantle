"use client";

import React, { useEffect, useRef, useState } from "react";
import { type Layer } from "./layer-definitions";
import { LAYER_ROMAN } from "./layer-definitions";

interface LayerHeaderProps {
  layer: Layer;
  /** Called when the description popover toggles open/closed. Hosts
   *  use this to elevate the layer's stacking context so the popover
   *  paints above sibling layers that come after in document order. */
  onPopoverToggle?: (open: boolean) => void;
}

/**
 * Layer header — the demo's editorial masthead per layer: a brass
 * Roman numeral, the layer name in caps, a hairline rule running to
 * the right edge, and the info chip (description popover) anchored at
 * the far right. No plate, no chapter tab — the header sits directly
 * on the page and the entries hang beneath it as individual cards.
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
    <header
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        marginBottom: 14,
      }}
    >
      {/* Brass Roman numeral — the chapter mark, set in the display serif. */}
      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-serif), serif",
          fontStyle: "italic",
          fontSize: 30,
          lineHeight: 1,
          color: "var(--session-walnut)",
          minWidth: 34,
          flexShrink: 0,
          fontFeatureSettings: '"lnum"',
        }}
      >
        {LAYER_ROMAN[layer.id]}.
      </span>

      {/* Layer name — caps, the section label. */}
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-sans), sans-serif",
          fontWeight: 700,
          fontSize: 12.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--session-ink)",
          flexShrink: 0,
          transform: "translateY(-1px)",
        }}
      >
        {layer.name}
      </h2>

      {/* Hairline rule running to the right edge. */}
      <span
        aria-hidden="true"
        style={{
          flex: 1,
          height: 1,
          minWidth: 12,
          background: "var(--session-hair-soft)",
          transform: "translateY(-4px)",
        }}
      />

      {/* Info chip + description popover. */}
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
            background: open ? "var(--session-walnut-highlight)" : "transparent",
            color: open ? "var(--session-ink)" : "var(--session-walnut-meta)",
            border: `1px solid ${
              open ? "var(--session-walnut-meta-strong)" : "var(--session-walnut-meta)"
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
  );
}
