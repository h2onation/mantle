"use client";

import React, { useState } from "react";
import type { Pattern } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";

interface PatternItemProps {
  pattern: Pattern;
  isNew?: boolean;
  layerId?: number;
  layerName?: string;
  onExploreWithSage?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

export default function PatternItem({ pattern, isNew, layerId, layerName, onExploreWithSage, readOnly }: PatternItemProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);

  return (
    <div
      onClick={readOnly ? undefined : () => setExpanded(!expanded)}
      style={{
        position: "relative",
        background: expanded
          ? "rgba(45, 55, 80, 0.08)"
          : "var(--session-navy-bg)",
        border: expanded
          ? "1px solid var(--session-navy-border)"
          : "1px solid rgba(45, 55, 80, 0.08)",
        borderRadius: 8,
        padding: "14px 16px",
        cursor: readOnly ? "default" : "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {/* New-content accent bar */}
      {isNew && (
        <div
          style={{
            position: "absolute",
            left: -1,
            top: 12,
            width: 3,
            height: 20,
            backgroundColor: "var(--session-navy-label)",
            opacity: 0.4,
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
        <div>
          {/* PATTERN label */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 7,
              fontWeight: 500,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-navy-label)",
              lineHeight: 1,
              display: "block",
              marginBottom: 6,
            }}
          >
            PATTERN
          </span>
          {/* Pattern name */}
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 480,
              color: "var(--session-navy-label)",
              opacity: 0.6,
              lineHeight: 1.3,
            }}
          >
            {pattern.name}
          </span>
        </div>

        {/* Plus/close icon (hidden in readOnly) */}
        {!readOnly && (
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
              stroke="var(--session-navy-label)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity={0.4}
            />
            <line
              x1="1"
              y1="6"
              x2="11"
              y2="6"
              stroke="var(--session-navy-label)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity={0.4}
            />
          </svg>
        )}
      </div>

      {/* Expandable content */}
      <div
        style={{
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.05s",
        }}
      >
        {/* Content divider */}
        <div
          style={{
            height: 1,
            background: "var(--session-navy-divider)",
            marginTop: 12,
            marginBottom: 0,
          }}
        />

        {/* Body text with mask-image truncation */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.72,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-line" as const,
              ...(expanded
                ? {}
                : {
                    maxHeight: 120,
                    overflow: "hidden",
                    maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                  }),
            }}
          >
            {pattern.description}
          </div>
        </div>

        {/* Explore further — only when expanded and not readOnly */}
        {onExploreWithSage && layerId !== undefined && layerName && !readOnly && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--session-navy-divider)",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExploreWithSage({
                  layerId,
                  layerName,
                  type: "pattern",
                  name: pattern.name,
                  content: pattern.description,
                });
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--session-navy-btn)",
                background: "none",
                border: "1px solid var(--session-navy-border)",
                borderRadius: 16,
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              Explore further
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                style={{ display: "block" }}
              >
                <path
                  d="M3 1.5L7 5L3 8.5"
                  stroke="var(--session-navy-btn)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
