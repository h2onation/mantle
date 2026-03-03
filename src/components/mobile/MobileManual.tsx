"use client";

import { useRef } from "react";
import { buildLayers } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import MeadowZone from "./MeadowZone";
import type { ManualComponent, ExplorationContext } from "@/lib/types";

interface MobileManualProps {
  components: ManualComponent[];
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function MobileManual({ components, onExploreWithSage }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(components);
  const isEmpty = layers.every((l) => l.component === null && l.patterns.length === 0);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {/* Left spacer (no hamburger) */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          MANTLE
        </span>

        {/* Right spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 0,
          paddingBottom: 120,
          position: "relative",
          maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.1) 3%, rgba(0,0,0,0.5) 8%, black 16%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.1) 3%, rgba(0,0,0,0.5) 8%, black 16%)",
        }}
      >
        {/* Page title — keeps its own horizontal padding */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "22px",
            fontWeight: 400,
            color: "var(--color-text)",
            margin: 0,
            padding: "24px 24px 0",
            letterSpacing: "-0.3px",
            lineHeight: 1.3,
          }}
        >
          Your Manual
        </h1>

        {/* Empty state atmospheric text */}
        {isEmpty && (
          <>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "15px",
                color: "rgba(212, 203, 192, 0.32)",
                margin: "16px 0 0 0",
                padding: "0 24px",
                maxWidth: 310,
                lineHeight: 1.6,
                letterSpacing: "-0.1px",
                animation: "manualAtmoFadeIn 1.8s ease-out 0.5s both",
              }}
            >
              Sage is learning how you operate. Your manual will take shape as you
              talk.
            </p>
          </>
        )}

        {/* Layer list */}
        <div style={{ marginTop: isEmpty ? 32 : 24, position: "relative" }}>
          {isEmpty ? (
            <div style={{ padding: "0 24px" }}>
              {layers.map((layer) => <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />)}
            </div>
          ) : (
            <>
              {/* Populated layers — edge to edge, no gap */}
              {layers
                .filter((l) => l.component !== null || l.patterns.length > 0)
                .map((layer) => (
                  <MeadowZone key={layer.id}>
                    <PopulatedLayer layer={layer} onExploreWithSage={onExploreWithSage} />
                  </MeadowZone>
                ))}

              {/* Empty layers below populated — padded */}
              {layers.some((l) => l.component === null && l.patterns.length === 0) && (
                <div style={{ marginTop: 12, padding: "0 24px" }}>
                  {layers
                    .filter((l) => l.component === null && l.patterns.length === 0)
                    .map((layer) => (
                      <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
