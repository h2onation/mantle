"use client";

import React, { useState } from "react";
import type { Pattern } from "./layer-definitions";
import ExploreWithSageButton from "@/components/shared/ExploreWithSageButton";
import type { ExplorationContext } from "@/lib/types";

interface PatternItemProps {
  pattern: Pattern;
  isNew?: boolean;
  layerId?: number;
  layerName?: string;
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function PatternItem({ pattern, isNew, layerId, layerName, onExploreWithSage }: PatternItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        position: "relative",
        background: expanded
          ? "linear-gradient(135deg, var(--cp-pattern-bg-active) 0%, var(--cp-pattern-bg) 100%)"
          : "var(--cp-pattern-bg)",
        border: expanded
          ? "1px solid var(--cp-pattern-border-active)"
          : "1px solid var(--cp-pattern-border)",
        borderRadius: 10,
        padding: "15px 16px",
        cursor: "pointer",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* New-content pattern accent */}
      {isNew && (
        <div
          style={{
            position: "absolute",
            left: -1,
            top: 12,
            width: 3,
            height: 20,
            backgroundColor: "var(--cp-text-accent)",
            opacity: 0.5,
            borderRadius: "0 3px 3px 0",
          }}
        />
      )}
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            fontWeight: 480,
            color: "var(--cp-pattern-name)",
            lineHeight: 1.3,
          }}
        >
          {pattern.name}
        </span>

        {/* Plus/close icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            display: "block",
            flexShrink: 0,
            transition: "transform 0.3s ease",
            transform: expanded ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <line
            x1="6"
            y1="1"
            x2="6"
            y2="11"
            stroke="rgba(94, 112, 84, 0.5)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line
            x1="1"
            y1="6"
            x2="11"
            y2="6"
            stroke="rgba(94, 112, 84, 0.5)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Expandable content */}
      <div
        style={{
          maxHeight: expanded ? 350 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.05s",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14,
            color: "var(--cp-pattern-content)",
            lineHeight: 1.72,
            margin: 0,
            padding: "12px 0 14px",
          }}
        >
          {pattern.description}
        </p>

        {onExploreWithSage && layerId !== undefined && layerName && (
          <ExploreWithSageButton
            onClick={() =>
              onExploreWithSage({
                layerId,
                layerName,
                type: "pattern",
                name: pattern.name,
                content: pattern.description,
              })
            }
          />
        )}
      </div>
    </div>
  );
}
