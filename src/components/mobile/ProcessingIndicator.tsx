"use client";

import React from "react";

interface ProcessingIndicatorProps {
  tier: "normal" | "deeper" | "heavy";
  text: string | null;
}

const ANIMATION_MAP = {
  normal: "sageBreathNormal 3s ease-in-out infinite",
  deeper: "sageBreathDeeper 4.5s ease-in-out infinite",
  heavy: "sageBreathHeavy 6s ease-in-out infinite",
} as const;

const COLOR_MAP = {
  normal: "var(--color-orb-normal)",
  deeper: "var(--color-orb-deeper)",
  heavy: "var(--color-orb-heavy)",
} as const;

export default function ProcessingIndicator({
  tier,
  text,
}: ProcessingIndicatorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "4px 0",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: COLOR_MAP[tier],
          animation: ANIMATION_MAP[tier],
        }}
      />
      {text && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "7px",
            color: "var(--color-text-ghost)",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            lineHeight: 1,
            animation: "sageTextFadeIn 0.8s ease-out",
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
