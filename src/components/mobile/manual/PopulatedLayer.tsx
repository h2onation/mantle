"use client";

import React, { useState } from "react";
import type { Layer, ManualEntry } from "./layer-definitions";
import type { ExplorationContext } from "@/lib/types";

interface PopulatedLayerProps {
  layer: Layer;
  onExploreWithSage?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

interface EntryCardProps {
  entry: ManualEntry;
  layerId: number;
  layerName: string;
  isNew?: boolean;
  onExploreWithSage?: (context: ExplorationContext) => void;
  readOnly?: boolean;
}

function EntryCard({ entry, layerId, layerName, isNew, onExploreWithSage, readOnly }: EntryCardProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);

  return (
    <div
      onClick={readOnly ? undefined : () => setExpanded(!expanded)}
      style={{
        position: "relative",
        background: expanded
          ? "var(--session-cream)"
          : "rgba(94, 112, 84, 0.04)",
        border: expanded
          ? "1px solid var(--session-sage-border)"
          : "1px solid rgba(94, 112, 84, 0.1)",
        borderRadius: 8,
        padding: "14px 16px",
        cursor: readOnly ? "default" : "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {isNew && (
        <div
          style={{
            position: "absolute",
            left: -1,
            top: 12,
            width: 3,
            height: 20,
            backgroundColor: "var(--session-sage-soft)",
            opacity: 0.4,
            borderRadius: "0 3px 3px 0",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            fontWeight: 400,
            color: "var(--session-ink)",
            lineHeight: 1.3,
          }}
        >
          {entry.name}
        </span>

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
            <line x1="6" y1="1" x2="6" y2="11" stroke="var(--session-sage-soft)" strokeWidth="1.4" strokeLinecap="round" opacity={0.5} />
            <line x1="1" y1="6" x2="11" y2="6" stroke="var(--session-sage-soft)" strokeWidth="1.4" strokeLinecap="round" opacity={0.5} />
          </svg>
        )}
      </div>

      <div
        style={{
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1) 0.05s",
        }}
      >
        <div
          style={{
            height: 1,
            background: "rgba(94, 112, 84, 0.12)",
            marginTop: 12,
            marginBottom: 0,
          }}
        />

        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.72,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-line" as const,
            }}
          >
            {entry.content}
          </div>
        </div>

        {onExploreWithSage && !readOnly && (
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
                  layerId,
                  layerName,
                  type: "entry",
                  name: entry.name,
                  content: entry.content,
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
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
                <path d="M3 1.5L7 5L3 8.5" stroke="var(--session-sage-soft)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PopulatedLayer({ layer, onExploreWithSage, readOnly }: PopulatedLayerProps) {
  return (
    <div style={{ padding: "0 0 20px" }}>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {layer.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              layerId={layer.id}
              layerName={layer.name}
              isNew={layer.isNew}
              onExploreWithSage={onExploreWithSage}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
