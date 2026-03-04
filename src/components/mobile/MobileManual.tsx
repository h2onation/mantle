"use client";

import { useRef } from "react";
import { buildLayers } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import type { ManualComponent, ExplorationContext } from "@/lib/types";

interface MobileManualProps {
  components: ManualComponent[];
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function MobileManual({ components, onExploreWithSage }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(components);
  const isEmpty = layers.every((l) => l.component === null && l.patterns.length === 0);
  const populatedLayers = layers.filter((l) => l.component !== null || l.patterns.length > 0);
  const emptyLayers = layers.filter((l) => l.component === null && l.patterns.length === 0);

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
        {/* Left spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            letterSpacing: "15px",
            textTransform: "uppercase",
            paddingLeft: "15px",
          }}
        >
          MANTLE
        </span>

        {/* Right spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />
      </div>

      {/* Scroll fade overlay */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: 0,
          right: 0,
          height: "48px",
          zIndex: 1,
          pointerEvents: "none",
          background: "linear-gradient(to bottom, rgba(200,185,140,0.18) 0%, rgba(200,185,140,0.06) 40%, transparent 100%)",
        }}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 0,
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
          position: "relative",
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: 0,
            padding: "16px 20px 28px",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
          }}
        >
          Your Manual
        </h1>

        {/* Empty state atmospheric text */}
        {isEmpty && (
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "15px",
              color: "var(--session-ink-ghost)",
              margin: "0 0 0 0",
              padding: "0 20px",
              maxWidth: 310,
              lineHeight: 1.6,
              letterSpacing: "-0.1px",
              animation: "manualAtmoFadeIn 1.8s ease-out 0.5s both",
            }}
          >
            Sage is learning how you operate. Your manual will take shape as you
            talk.
          </p>
        )}

        {/* Layer list */}
        <div style={{ marginTop: isEmpty ? 32 : 0, position: "relative" }}>
          {isEmpty ? (
            <div style={{ padding: "0 20px" }}>
              {layers.map((layer) => <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />)}
            </div>
          ) : (
            <>
              {/* Populated layers — with horizontal padding */}
              <div style={{ padding: "0 16px" }}>
                {populatedLayers.map((layer) => (
                  <PopulatedLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                ))}
              </div>

              {/* Upcoming label + empty layers below populated */}
              {emptyLayers.length > 0 && (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      fontWeight: 500,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "var(--session-ink-faded)",
                      margin: 0,
                      padding: "20px 20px 10px",
                    }}
                  >
                    UPCOMING
                  </p>
                  <div style={{ padding: "0 20px" }}>
                    {emptyLayers.map((layer) => (
                      <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
