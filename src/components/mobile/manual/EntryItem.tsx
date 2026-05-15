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
  /** First entry inside a Plate sits flush against the disclosure / tab pip; subsequent entries get a 20px top margin. */
  isFirst?: boolean;
  // Legacy props — kept so AdminManualView's prior signature stays
  // valid until callers are migrated. No visual effect anymore: entry
  // delineation is now margin-only, no dotted hairline.
  isLast?: boolean;
  showDivider?: boolean;
}

export default function EntryItem({
  entry,
  layerId,
  layerName,
  onExploreWithPersona,
  readOnly,
  isFirst,
}: EntryItemProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);
  const toggle = readOnly ? undefined : () => setExpanded((v) => !v);

  return (
    <div style={{ marginTop: isFirst ? 0 : 20 }}>
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
        tabIndex={readOnly ? undefined : 0}
        onKeyDown={
          readOnly
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }
        }
        style={{
          display: "grid",
          gridTemplateColumns: readOnly ? "1fr" : "1fr 14px",
          gap: 12,
          alignItems: "baseline",
          padding: expanded && !readOnly ? "16px 0 8px" : "16px 0",
          cursor: readOnly ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 17,
            lineHeight: 1.3,
            letterSpacing: "-0.005em",
            color: "var(--session-ink)",
            fontFeatureSettings: '"liga","dlig","kern"',
            textWrap: "pretty" as React.CSSProperties["textWrap"],
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
        <div style={{ paddingBottom: 14 }}>
          <div
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--session-ink)",
              whiteSpace: "pre-line" as const,
              textWrap: "pretty" as React.CSSProperties["textWrap"],
            }}
          >
            {entry.body}
          </div>

          {!readOnly && onExploreWithPersona && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
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
                aria-label={`Explore further with ${PERSONA_NAME}`}
                style={{
                  all: "unset",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 4,
                  cursor: "pointer",
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--session-walnut)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span>explore further</span>
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontStyle: "normal",
                    fontSize: 15,
                    color: "var(--session-walnut)",
                    display: "inline-block",
                    verticalAlign: -1,
                  }}
                >
                  →
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
