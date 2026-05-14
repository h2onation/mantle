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
  showDivider?: boolean;
}

export default function EntryItem({ entry, layerId, layerName, onExploreWithPersona, readOnly, showDivider }: EntryCardProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);

  const toggle = readOnly ? undefined : () => setExpanded((v) => !v);

  return (
    <div
      style={{
        padding: "14px 18px",
        background: "var(--session-walnut-surface)",
        ...(showDivider ? { borderTop: "1px solid rgba(170,120,82,0.14)" } : {}),
      }}
    >
      <div
        onClick={toggle}
        role={readOnly ? undefined : "button"}
        aria-expanded={readOnly ? undefined : expanded}
        aria-label={readOnly ? undefined : expanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: readOnly ? "default" : "pointer",
          gap: "12px",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 16,
            fontWeight: expanded ? 500 : 400,
            color: "var(--session-ink)",
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {entry.name}
          <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
        </span>
        {!readOnly && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              color: "var(--session-ink-ghost)",
            }}
          >
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {(expanded || readOnly) && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 15,
              fontWeight: 400,
              lineHeight: 1.65,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-line" as const,
            }}
          >
            {entry.body}
          </div>

          {expanded && !readOnly && onExploreWithPersona && (
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
                gap: "4px",
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
