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
        background: "var(--session-cream)",
        border: "0.5px solid var(--session-ink-hairline)",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        marginBottom: 10,
      }}
    >
      {/* Title — the scannable line */}
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--session-ink)",
          lineHeight: 1.4,
          marginBottom: 8,
        }}
      >
        {entry.name}
      </div>

      {/* Body — clamped when collapsed, full when expanded */}
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.7,
          color: "var(--session-ink-soft)",
          whiteSpace: "pre-line" as const,
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
      >
        {entry.body}
      </div>

      {/* Read more / Show less */}
      {!readOnly && (
        <button
          onClick={toggle}
          style={{
            display: "block",
            marginTop: 10,
            padding: 0,
            background: "none",
            border: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--session-ink-ghost)",
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {/* Explore further — preserved Sage flow, restyled as a subtle text link */}
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
            display: "block",
            marginTop: 6,
            padding: 0,
            background: "none",
            border: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--session-ink-ghost)",
            cursor: "pointer",
          }}
        >
          Explore further with {PERSONA_NAME} →
        </button>
      )}
    </div>
  );
}
