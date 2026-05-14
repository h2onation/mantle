"use client";

import React, { useState } from "react";
import type { Entry } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";
import { PERSONA_NAME } from "@/lib/persona/config";

interface EntryCardProps {
  entry: Entry;
  layerId: number;
  layerName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  readOnly?: boolean;
  isLast?: boolean;
  // Legacy prop — kept so AdminManualView's prior signature stays valid
  // until its callers are migrated. Has no visual effect anymore; the
  // dotted divider is now driven by isLast.
  showDivider?: boolean;
}

export default function EntryItem({
  entry,
  layerId,
  layerName,
  onExploreWithPersona,
  readOnly,
  isLast,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);
  const toggle = readOnly ? undefined : () => setExpanded((v) => !v);

  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px dotted var(--session-hair)",
      }}
    >
      <div
        onClick={toggle}
        role={readOnly ? undefined : "button"}
        aria-expanded={readOnly ? undefined : expanded}
        aria-label={readOnly ? undefined : expanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 14px",
          gap: 12,
          alignItems: "baseline",
          padding: expanded ? "16px 0 6px" : "13px 0",
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
            fontSize: expanded ? 19.5 : 15.5,
            lineHeight: expanded ? 1.25 : 1.35,
            letterSpacing: expanded ? "-0.01em" : "-0.005em",
            color: "var(--session-ink)",
            fontFeatureSettings: '"liga","dlig","kern"',
            transition: "font-size 0.18s ease, line-height 0.18s ease",
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
        <div style={{ padding: "0 22px 16px 0" }}>
          <div
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--session-ink)",
              whiteSpace: "pre-line" as const,
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
                marginTop: 12,
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
    </div>
  );
}
