"use client";

import React, { useState } from "react";
import type { Pattern } from "./ManualMockData";
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
          ? "linear-gradient(135deg, rgba(122,139,114,0.12) 0%, rgba(122,139,114,0.06) 100%)"
          : "rgba(122,139,114,0.06)",
        border: expanded
          ? "1px solid rgba(122,139,114,0.22)"
          : "1px solid rgba(122,139,114,0.08)",
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
            backgroundColor: "#7A8B72",
            opacity: 0.7,
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
            color: "#E2DAD0",
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
            stroke="#7A8B72"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line
            x1="1"
            y1="6"
            x2="11"
            y2="6"
            stroke="#7A8B72"
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
            color: "#B0A89D",
            lineHeight: 1.72,
            margin: 0,
            padding: "12px 0 14px",
          }}
        >
          {pattern.description}
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onExploreWithSage && layerId !== undefined && layerName) {
              onExploreWithSage({
                layerId,
                layerName,
                type: "pattern",
                name: pattern.name,
                content: pattern.description,
              });
            }
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 500,
            color: "#A8B89F",
            background:
              "linear-gradient(135deg, rgba(122,139,114,0.15) 0%, rgba(122,139,114,0.08) 100%)",
            border: "1px solid rgba(122,139,114,0.25)",
            borderRadius: 8,
            padding: "9px 14px 9px 12px",
            cursor: "pointer",
            transition: "border-color 0.2s ease",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{ display: "block" }}
          >
            <path
              d="M3 1.5L7 5L3 8.5"
              stroke="#A8B89F"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Explore with Sage
        </button>
      </div>
    </div>
  );
}
