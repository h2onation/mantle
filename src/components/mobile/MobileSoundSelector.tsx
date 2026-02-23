"use client";

import { useEffect, useRef } from "react";
import { useAudio } from "@/components/providers/AudioProvider";

const SOUND_OPTIONS: { label: string; value: string | null }[] = [
  { label: "Water", value: "water" },
  { label: "Piano", value: "piano" },
  { label: "Birdsong", value: "birds" },
  { label: "Off", value: null },
];

interface MobileSoundSelectorProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileSoundSelector({
  open,
  onClose,
}: MobileSoundSelectorProps) {
  const { isPlaying, currentTrack, play, stop } = useAudio();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => {
      document.removeEventListener("mousedown", handleTap);
      document.removeEventListener("touchstart", handleTap);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSelect(value: string | null) {
    if (value === null) {
      await stop();
    } else {
      await play(value);
    }
    onClose();
  }

  return (
    <div
      ref={cardRef}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "4px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "12px",
        padding: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: "120px",
        zIndex: 20,
      }}
    >
      {SOUND_OPTIONS.map((option) => {
        const isActive =
          option.value === null
            ? !isPlaying
            : isPlaying && currentTrack === option.value;
        return (
          <button
            key={option.label}
            onClick={() => handleSelect(option.value)}
            style={{
              width: "100%",
              padding: "10px 8px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              letterSpacing: "0.2px",
              color: isActive
                ? "var(--color-accent)"
                : "var(--color-text-ghost)",
              textAlign: "left",
              borderRadius: "6px",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Shared indicator button used by MobileSession
export function SoundIndicator({
  onTap,
  compact,
}: {
  onTap: () => void;
  compact?: boolean;
}) {
  const { isPlaying, currentTrack } = useAudio();

  const LABELS: Record<string, string> = {
    water: "WATER",
    piano: "PIANO",
    birds: "BIRDSONG",
  };

  const label =
    isPlaying && currentTrack ? LABELS[currentTrack] || "MUSIC" : null;

  return (
    <button
      onClick={onTap}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: "8px",
        color: "var(--color-text-ghost)",
        letterSpacing: "2px",
        padding: "8px",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      🎧{!compact && label ? ` ${label}` : ""}
    </button>
  );
}
