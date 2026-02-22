"use client";

import { useState } from "react";
import { useAudio } from "@/components/providers/AudioProvider";

interface SoundCardProps {
  onSelect: (sound: string | null) => void;
}

const OPTIONS: { label: string; value: string | null }[] = [
  { label: "Water", value: "water" },
  { label: "Piano", value: "piano" },
  { label: "Birdsong", value: "birds" },
  { label: "No sound", value: null },
];

export default function SoundCard({ onSelect }: SoundCardProps) {
  const [selected, setSelected] = useState<string | null | undefined>(
    undefined
  );
  const [hovered, setHovered] = useState<string | null | undefined>(undefined);
  const { play } = useAudio();

  function handleClick(value: string | null) {
    setSelected(value);

    if (value !== null) {
      play(value);
    }

    setTimeout(() => onSelect(value), 500);
  }

  return (
    <div
      style={{
        maxWidth: "520px",
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        padding: "48px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          color: "var(--color-text-primary)",
          margin: "0 0 24px 0",
        }}
      >
        Set your environment.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          const isHovered =
            hovered === (option.value ?? "__null__") && !isSelected;

          return (
            <button
              key={option.label}
              onClick={() => handleClick(option.value)}
              onMouseEnter={() =>
                setHovered(option.value ?? "__null__")
              }
              onMouseLeave={() => setHovered(undefined)}
              disabled={selected !== undefined}
              style={{
                backgroundColor: isSelected
                  ? "rgba(92, 107, 94, 0.1)"
                  : "var(--color-bg-input)",
                border: `1px solid ${
                  isSelected
                    ? "var(--color-accent)"
                    : isHovered
                    ? "var(--color-text-muted)"
                    : "var(--color-border)"
                }`,
                borderRadius: "12px",
                padding: "16px 24px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "15px",
                color: "var(--color-text-primary)",
                cursor: selected !== undefined ? "default" : "pointer",
                transition: "border-color 0.15s ease, background-color 0.15s ease",
                textAlign: "left",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
