"use client";

import React, { useState } from "react";
import type { Thread } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";
import { PERSONA_NAME } from "@/lib/persona/config";

interface ThreadCardProps {
  thread: Thread;
  layerId: number;
  layerName: string;
  onExploreWithSage?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

// File still named PatternItem.tsx for diff hygiene; the future PR that removes
// the component/pattern split will rename it to ThreadCard.
export default function PatternItem({ thread, layerId, layerName, onExploreWithSage, readOnly }: ThreadCardProps) {
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
        {thread.name}
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
        {thread.body}
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
      {expanded && !readOnly && onExploreWithSage && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExploreWithSage({
              layerId,
              layerName,
              type: "entry",
              name: thread.name,
              content: thread.body,
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
