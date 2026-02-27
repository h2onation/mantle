"use client";

import React, { useState } from "react";
import type { Layer } from "./layer-definitions";
import PatternItem from "./PatternItem";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function PopulatedLayer({ layer, onExploreWithSage }: PopulatedLayerProps) {
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  return (
    <div
      style={{
        padding: "2px 0 6px",
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
              backgroundColor: "#5E7054",
              borderRadius: "0 2px 2px 0",
              boxShadow: "0 0 8px rgba(94,112,84,0.3)",
            }}
          />
        </>
      )}
      {/* Layer label */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "#2A3326",
            lineHeight: 1.3,
          }}
        >
          {layer.name}
        </span>
      </div>

      {/* Narrative (only if component exists) */}
      {layer.component && (
        <div
          onClick={() => setNarrativeOpen(!narrativeOpen)}
          style={{ cursor: "pointer" }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              lineHeight: 1.75,
              fontWeight: 400,
              letterSpacing: "-0.1px",
              color: "#2A3326",
              position: "relative",
              ...(narrativeOpen
                ? { whiteSpace: "pre-line" as const }
                : {
                    maxHeight: 110,
                    overflow: "hidden",
                  }),
            }}
          >
            {/* Fade-out gradient when collapsed */}
            {!narrativeOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  background: "linear-gradient(to bottom, transparent, #E4EDE0)",
                  pointerEvents: "none",
                }}
              />
            )}
            {layer.component.narrative}
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
                color: "rgba(94, 112, 84, 0.65)",
                background:
                  "linear-gradient(135deg, rgba(94,112,84,0.1) 0%, rgba(94,112,84,0.05) 100%)",
                border: "1px solid rgba(94,112,84,0.2)",
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
                  stroke="rgba(94, 112, 84, 0.65)"
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
              marginTop: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(94, 112, 84, 0.55)",
              }}
            >
              {narrativeOpen ? "Show less" : "Continue reading"}
            </span>
            <svg
              width="8"
              height="8"
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
                stroke="#5E7054"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Patterns section */}
      {layer.patterns.length > 0 && (
        <>
          {/* Divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(to right, rgba(94,112,84,0.15) 0%, rgba(94,112,84,0.05) 80%, transparent 100%)",
              marginTop: 12,
              marginBottom: 10,
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
