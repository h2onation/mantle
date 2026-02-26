"use client";

import React, { useState, useRef } from "react";
import {
  getEmptyState,
  getPartialState,
  getUpdatedState,
  getMatureState,
} from "./manual/ManualMockData";
import type { Layer } from "./manual/ManualMockData";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import type { ManualComponent, ExplorationContext } from "@/lib/types";

interface MobileManualProps {
  components: ManualComponent[];
  onExploreWithSage?: (context: ExplorationContext) => void;
}

type MockState = "empty" | "partial" | "updated" | "mature";

const STATE_GETTERS: Record<MockState, () => Layer[]> = {
  empty: getEmptyState,
  partial: getPartialState,
  updated: getUpdatedState,
  mature: getMatureState,
};

const STATE_LABELS: { key: MockState; label: string }[] = [
  { key: "empty", label: "E" },
  { key: "partial", label: "P" },
  { key: "updated", label: "U" },
  { key: "mature", label: "M" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MobileManual({ components, onExploreWithSage }: MobileManualProps) {
  const [activeState, setActiveState] = useState<MockState>("partial");
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = STATE_GETTERS[activeState]();
  const isEmpty = layers.every((l) => l.component === null);

  function handleStateChange(state: MockState) {
    setActiveState(state);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      ref={scrollRef}
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "40px 24px 120px",
        position: "relative",
      }}
    >
      {/* Glow breathing animation */}
      <style>{`
        @keyframes manualGlowPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Ambient glow — primary */}
      <div
        style={{
          position: "absolute",
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 450,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(200,150,60,0.25) 0%, transparent 70%)",
          filter: "blur(25px)",
          pointerEvents: "none",
          animation: "manualGlowPulse 7s ease-in-out infinite",
        }}
      />

      {/* Ambient glow — secondary */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 380,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(180,130,50,0.12) 0%, transparent 70%)",
          filter: "blur(35px)",
          pointerEvents: "none",
        }}
      />

      {/* Ambient glow — hotspot */}
      <div
        style={{
          position: "absolute",
          top: -20,
          left: "50%",
          transform: "translateX(-50%)",
          width: 240,
          height: 200,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(210,170,80,0.18) 0%, transparent 70%)",
          filter: "blur(18px)",
          pointerEvents: "none",
          animation: "manualGlowPulse 7s ease-in-out infinite",
          animationDelay: "4s",
        }}
      />

      {/* Dev state switcher */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          gap: 4,
          zIndex: 10,
        }}
      >
        {STATE_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleStateChange(key)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "4px 8px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              background:
                activeState === key
                  ? "rgba(226, 224, 219, 0.12)"
                  : "rgba(226, 224, 219, 0.04)",
              color:
                activeState === key
                  ? "var(--color-text)"
                  : "var(--color-text-ghost)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
          position: "relative",
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
      )}

      {/* Atmospheric text fade-in animation */}
      <style>{`
        @keyframes manualAtmoFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Layer list */}
      <div style={{ marginTop: isEmpty ? 32 : 24, position: "relative" }}>
        {isEmpty ? (
          layers.map((layer) => <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />)
        ) : (
          <>
            {/* Populated layers */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {layers
                .filter((l) => l.component !== null)
                .map((layer) => (
                  <PopulatedLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                ))}
            </div>

            {/* Empty layers below populated */}
            {layers.some((l) => l.component === null) && (
              <div style={{ marginTop: 12 }}>
                {layers
                  .filter((l) => l.component === null)
                  .map((layer) => (
                    <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
