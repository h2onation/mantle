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
      play(value).catch(() => {
        // Autoplay blocked — sound state is still set via localStorage
      });
    }

    setTimeout(() => onSelect(value), 500);
  }

  return (
    <div
      style={{
        maxWidth: "calc(100vw - 48px)",
        width: "100%",
        backgroundColor: "var(--color-surface)",
        borderRadius: "16px",
        padding: "32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        border: "1px solid var(--color-divider)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          color: "var(--color-text)",
          margin: "0 0 24px 0",
        }}
      >
        Choose background music for your session.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
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
                  ? "var(--color-accent-ghost)"
                  : "var(--color-void)",
                border: `1px solid ${
                  isSelected
                    ? "var(--color-accent)"
                    : isHovered
                    ? "var(--color-text-ghost)"
                    : "var(--color-divider)"
                }`,
                borderRadius: "12px",
                padding: "16px 24px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "15px",
                color: "var(--color-text)",
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
