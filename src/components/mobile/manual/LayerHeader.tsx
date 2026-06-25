"use client";

import { type Layer } from "./layer-definitions";
import LayerIcon from "./LayerIcon";

interface LayerHeaderProps {
  layer: Layer;
  /** Populated read view: the entry count drives the count chip + the
   *  collapse chevron. Omitted on the readOnly admin/PDF path (which renders
   *  open and non-collapsible, so no chevron). */
  count?: number;
  collapsed?: boolean;
  /** readOnly (admin / PDF) suppresses the interactive cues — no "Start →" on
   *  empty tiles, no chevron on populated ones. */
  readOnly?: boolean;
}

/**
 * Section tile header — the same row anatomy Home's section index uses: a
 * rounded-square emblem (navy for sections with content, walnut for empty),
 * the section name and its tagline, and a right-edge cue. Populated tiles show
 * the entry count + a collapse chevron; empty tiles show "Start →". No plate,
 * no Roman numeral, no info popover — the tile is the surface and Home and the
 * Manual now speak one visual language.
 */
export default function LayerHeader({
  layer,
  count,
  collapsed,
  readOnly,
}: LayerHeaderProps) {
  const isEmpty = layer.entries.length === 0;

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 13 }}>
      {/* Emblem — navy for started sections, walnut for empty. */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          background: isEmpty
            ? "var(--session-walnut-tint)"
            : "var(--session-persona-tint)",
          color: isEmpty ? "var(--session-walnut)" : "var(--session-persona)",
        }}
      >
        <LayerIcon layerId={layer.id} size={18} />
      </span>

      {/* Name + tagline (tagline omitted for the held group, which has none). */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-serif), serif",
            fontSize: 16,
            color: "var(--session-ink)",
            lineHeight: 1.25,
          }}
        >
          {layer.name}
        </span>
        {layer.tagline && (
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontFamily: "var(--font-serif), serif",
              fontSize: 13,
              color: "var(--session-ink-mid)",
              lineHeight: 1.35,
            }}
          >
            {layer.tagline}
          </span>
        )}
      </span>

      {/* Right cue: "Start →" on empty tiles; count + chevron on populated. */}
      {isEmpty
        ? !readOnly && (
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--session-walnut)",
              }}
            >
              Start →
            </span>
          )
        : count !== undefined && (
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "var(--session-ink-faded)",
                }}
              >
                {count} {count === 1 ? "entry" : "entries"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  lineHeight: 1,
                  color: "var(--session-walnut)",
                  display: "inline-block",
                  transform: collapsed ? "rotate(90deg)" : "rotate(-90deg)",
                  transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                ›
              </span>
            </span>
          )}
    </header>
  );
}
