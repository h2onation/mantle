"use client";

import { useState, useRef, useCallback } from "react";
import { buildLayers } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import MobileSoundSelector, { SoundIndicator } from "./MobileSoundSelector";
import MeadowZone from "./MeadowZone";
import type { ManualComponent, ExplorationContext } from "@/lib/types";

interface MobileManualProps {
  components: ManualComponent[];
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function MobileManual({ components, onExploreWithSage }: MobileManualProps) {
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(components);
  const isEmpty = layers.every((l) => l.component === null && l.patterns.length === 0);

  const handleCloseSoundMenu = useCallback(() => {
    setShowSoundMenu(false);
  }, []);

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

        {/* Sound indicator — right */}
        <div
          style={{
            minWidth: "44px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <SoundIndicator compact onTap={() => setShowSoundMenu(!showSoundMenu)} />
          <MobileSoundSelector open={showSoundMenu} onClose={handleCloseSoundMenu} />
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 24px 120px",
          position: "relative",
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "22px",
            fontWeight: 400,
            color: "var(--color-text)",
            margin: 0,
            letterSpacing: "-0.3px",
            lineHeight: 1.3,
          }}
        >
          Your Manual
        </h1>

        {/* Empty state atmospheric text */}
        {isEmpty && (
          <>
            <style>{`
              @keyframes manualAtmoFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "15px",
                color: "rgba(212, 203, 192, 0.32)",
                margin: "16px 0 0 0",
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
            layers.map((layer) => <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />)
          ) : (
            <>
              {/* Populated layers */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {layers
                  .filter((l) => l.component !== null || l.patterns.length > 0)
                  .map((layer) => (
                    <MeadowZone key={layer.id}>
                      <PopulatedLayer layer={layer} onExploreWithSage={onExploreWithSage} />
                    </MeadowZone>
                  ))}
              </div>

              {/* Empty layers below populated */}
              {layers.some((l) => l.component === null && l.patterns.length === 0) && (
                <div style={{ marginTop: 12 }}>
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
