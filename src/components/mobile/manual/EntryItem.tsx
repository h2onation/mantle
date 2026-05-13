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
}

export default function EntryItem({ entry, layerId, layerName, onExploreWithPersona, readOnly }: EntryCardProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);

  const toggle = readOnly ? undefined : () => setExpanded((v) => !v);

  return (
    <div
      style={{
        background: "var(--session-walnut-surface)",
        border: "1px solid var(--session-walnut-border)",
        borderRadius: "12px",
        padding: "14px 18px",
        marginBottom: 10,
        backdropFilter: "blur(20px) saturate(130%)",
        WebkitBackdropFilter: "blur(20px) saturate(130%)",
      }}
    >
      {/* Title row — clickable with chevron */}
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
              transition: "transform 0.2s ease",
              color: "var(--session-ink-ghost)",
            }}
          >
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Body — shown when expanded */}
      {(expanded || readOnly) && (
        <div
          style={{
            marginTop: 10,
            fontFamily: "var(--font-spectral), var(--font-serif), serif",
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.65,
            color: "var(--session-ink-soft)",
            whiteSpace: "pre-line" as const,
          }}
        >
          {entry.body}
          {entry.soWhat && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--session-hair-soft)",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.6,
                color: "var(--session-ink-mid)",
                fontStyle: "italic",
              }}
            >
              {entry.soWhat}
            </div>
          )}
        </div>
      )}

      {/* Explore further — walnut mono-caps TextBtn pattern */}
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
            gap: "var(--sp-xs)",
            cursor: "pointer",
            marginTop: 14,
            paddingBottom: 2,
            borderBottom: "1px solid var(--session-walnut)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "var(--session-walnut)",
          }}
          aria-label={`Explore further with ${PERSONA_NAME}`}
        >
          <span>Explore further</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
