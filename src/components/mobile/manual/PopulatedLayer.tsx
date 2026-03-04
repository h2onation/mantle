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
    <div style={{ padding: "0 0 20px" }}>
      {/* Card */}
      <div
        style={{
          background: "linear-gradient(170deg, var(--session-cream) 0%, #EFEADF 100%)",
          border: "1px solid var(--session-sage-border)",
          borderRadius: 8,
          boxShadow: "0 8px 44px rgba(185,170,110,0.22), 0 2px 8px rgba(26,22,20,0.04)",
          padding: "18px 18px 16px",
          position: "relative",
          ...(layer.isNew
            ? { animation: "layerFadeUp 0.5s ease-out both" }
            : {}),
        }}
      >
        {/* Layer title */}
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--session-ink)",
            letterSpacing: "-0.3px",
            lineHeight: 1.2,
            margin: "0 0 16px 0",
          }}
        >
          {layer.name}
        </h2>

        {/* Narrative (only if component exists) */}
        {layer.component && (
          <div>
            <div
              onClick={() => setNarrativeOpen(!narrativeOpen)}
              style={{ cursor: "pointer" }}
            >
              {/* Body text with mask-image truncation */}
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 14,
                  lineHeight: 1.75,
                  fontWeight: 400,
                  letterSpacing: "-0.1px",
                  color: "var(--session-ink-soft)",
                  whiteSpace: "pre-line" as const,
                  ...(narrativeOpen
                    ? {}
                    : {
                        maxHeight: 172,
                        overflow: "hidden",
                        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                      }),
                }}
              >
                {layer.component.narrative}
              </div>

              {/* Continue reading / less toggle */}
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "var(--session-ink-ghost)",
                  display: "inline-block",
                  marginTop: narrativeOpen ? 6 : 2,
                  cursor: "pointer",
                }}
              >
                {narrativeOpen ? "↑ less" : ". . . continue reading"}
              </span>
            </div>

            {/* Explore further — only when expanded */}
            {narrativeOpen && onExploreWithSage && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(94, 112, 84, 0.1)",
                  animation: "fadeIn 0.3s ease",
                }}
              >
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
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--session-sage-soft)",
                    background: "none",
                    border: "1px solid var(--session-sage-border)",
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
                      stroke="var(--session-sage-soft)"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Patterns section */}
        {layer.patterns.length > 0 && (
          <>
            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "var(--session-ink-hairline)",
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
    </div>
  );
}
