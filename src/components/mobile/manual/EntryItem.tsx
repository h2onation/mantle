"use client";

import React, { useState } from "react";
import type { Entry } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";
import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryItemProps {
  entry: Entry;
  layerId: number;
  layerName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
  isLast?: boolean;
}

/**
 * One Manual entry inside a PopulatedLayer Plate.
 *
 * Title: italic Spectral 18px regular — the thread headline. Sized
 * between the Layer header (22px on the tab pip) and the body (16px),
 * so the hierarchy reads Layer > Pattern > Body. Regular weight (not
 * medium) — italic alone carries the title differentiation; adding
 * weight on top reads as a UI label rather than a literary section
 * title. Line-height 1.4 (loose for italic) so titles like "I Spit
 * the Signal Back Before Anyone Hears It" can wrap to two lines
 * without cramping. No size jitter between collapsed and expanded —
 * the chevron rotation carries state.
 *
 * Body: Spectral 16px / 1.65 / ink-soft — comfortable long-form
 * reading register (Apple Books / Substack scale). Ink-soft softens
 * the contrast so the cream doesn't read as bold against the walnut
 * Plate background.
 *
 * Between siblings (not before the first entry, not after the last),
 * a dotted walnut hairline indented 22px from the left anchors as an
 * editorial section break, not a row separator.
 */
export default function EntryItem({
  entry,
  layerId,
  layerName,
  onExploreWithPersona,
  readOnly,
  isLast,
}: EntryItemProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);
  const toggle = readOnly ? undefined : () => setExpanded((v) => !v);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={toggle}
        role={readOnly ? undefined : "button"}
        aria-expanded={readOnly ? undefined : expanded}
        aria-label={
          readOnly
            ? undefined
            : expanded
              ? `Collapse ${entry.name}`
              : `Expand ${entry.name}`
        }
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 14px",
          gap: 12,
          alignItems: "baseline",
          padding: "var(--sp-sm) 0",
          cursor: readOnly ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 18,
            lineHeight: 1.4,
            letterSpacing: "-0.005em",
            color: "var(--session-ink)",
            fontFeatureSettings: '"liga","dlig","kern"',
            textWrap: "balance" as React.CSSProperties["textWrap"],
          }}
        >
          {entry.name}
        </h3>
        {!readOnly && (
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1,
              textAlign: "right",
              color: "var(--session-walnut)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transformOrigin: "center",
              transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "inline-block",
            }}
          >
            ›
          </span>
        )}
      </div>

      {(expanded || readOnly) && (
        <div style={{ padding: "0 22px var(--sp-sm) 0" }}>
          <div
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-line" as const,
              textWrap: "pretty" as React.CSSProperties["textWrap"],
            }}
          >
            {entry.body}
          </div>

          {!readOnly && onExploreWithPersona && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExploreWithPersona({
                  layerId,
                  layerName,
                  type: "entry",
                  name: entry.name,
                  content: entry.body,
                });
              }}
              style={{
                all: "unset",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                marginTop: "var(--sp-sm)",
                paddingBottom: 2,
                borderBottom: "1px solid var(--session-walnut)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-walnut)",
                WebkitTapHighlightColor: "transparent",
              }}
              aria-label={`Explore further with ${PERSONA_NAME}`}
            >
              <span>Explore further</span>
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      )}

      {/* Dotted walnut hair between entries, indented 22px from the
          left. Suppressed after the last entry so the Plate closes
          cleanly. */}
      {!isLast && (
        <div
          aria-hidden="true"
          style={{
            marginLeft: 22,
            borderTop: "1px dotted var(--session-walnut-meta-soft)",
          }}
        />
      )}
    </div>
  );
}
