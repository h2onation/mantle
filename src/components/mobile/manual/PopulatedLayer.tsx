"use client";

import React, { useState } from "react";
import type { Layer } from "./ManualMockData";
import PatternItem from "./PatternItem";
import LayerTooltip from "./LayerTooltip";

interface ExplorationContext {
  layerId: number;
  layerName: string;
  type: "pattern" | "component" | "empty_layer";
  name?: string;
  content: string;
}

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function PopulatedLayer({ layer, onExploreWithSage }: PopulatedLayerProps) {
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  return (
    <div
      style={{
        background: "linear-gradient(175deg, #302C27 0%, #2A2622 100%)",
        borderRadius: 14,
        padding: "26px 22px 22px",
        border: "1px solid rgba(212, 203, 192, 0.07)",
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.25), 0 0 1px rgba(212,203,192,0.1), inset 0 1px 0 rgba(212,203,192,0.05)",
        position: "relative",
        ...(layer.isNew
          ? { animation: "layerFadeUp 0.5s ease-out both" }
          : {}),
      }}
    >
      {/* New-content accent bar */}
      {layer.isNew && (
        <>
          <style>{`
            @keyframes layerFadeUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 16,
              bottom: 16,
              width: 3,
              backgroundColor: "#7A8B72",
              borderRadius: "0 2px 2px 0",
              boxShadow: "0 0 8px rgba(122,139,114,0.3)",
            }}
          />
        </>
      )}
      {/* Title row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 520,
            color: "#EDE6DC",
            lineHeight: 1.3,
          }}
        >
          {layer.name}
        </span>

        {/* Info button wrapped in tooltip */}
        <LayerTooltip text={layer.about} showSageAction={false}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "rgba(122, 139, 114, 0.12)",
              border: "1px solid rgba(122, 139, 114, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ display: "block" }}
            >
              <circle cx="5" cy="2" r="1" fill="#8A9B82" />
              <line
                x1="5"
                y1="4.5"
                x2="5"
                y2="8.5"
                stroke="#8A9B82"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </LayerTooltip>
      </div>

      {/* Narrative */}
      <div
        onClick={() => setNarrativeOpen(!narrativeOpen)}
        style={{ cursor: "pointer" }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            lineHeight: 1.78,
            fontWeight: 410,
            color: "#C8BFB4",
            ...(narrativeOpen
              ? { whiteSpace: "pre-line" as const }
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }),
          }}
        >
          {layer.component!.narrative}
        </div>

        {/* Explore with Sage — visible when expanded */}
        {narrativeOpen && onExploreWithSage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExploreWithSage({
                layerId: layer.id,
                layerName: layer.name,
                type: "component",
                content: layer.component!.narrative,
              });
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
              marginTop: 14,
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
        )}

        {/* Continue reading / Show less */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 470,
              color: "#8A9B82",
            }}
          >
            {narrativeOpen ? "Show less" : "Continue reading"}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{
              display: "block",
              transition: "transform 0.3s ease",
              transform: narrativeOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="#8A9B82"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Patterns section */}
      {layer.patterns.length > 0 && (
        <>
          {/* Divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(to right, rgba(122,139,114,0.2) 0%, rgba(122,139,114,0.05) 80%, transparent 100%)",
              marginTop: 18,
              marginBottom: 16,
            }}
          />

          {/* Pattern cards */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {layer.patterns.map((pattern) => (
              <PatternItem
                key={pattern.id}
                pattern={pattern}
                isNew={layer.isNew}
                layerId={layer.id}
                layerName={layer.name}
                onExploreWithSage={onExploreWithSage}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
