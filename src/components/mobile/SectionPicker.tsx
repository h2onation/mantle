"use client";

import { LAYERS } from "@/lib/manual/layers";

interface SectionPickerProps {
  onSelect: (sectionName: string) => void;
  disabled: boolean;
}

/**
 * The guided-intake section picker. Renders the five canonical Manual sections
 * (from layers.ts — the single source of truth, so the names can't drift) as
 * navy accent cards. Shown under the tee-up turn when the prompt emits the
 * ---sections--- marker.
 *
 * A tap routes through `sendChipResponse`, so the selection reaches the prompt
 * as a marked `[selected from options] <section name>` message — exactly like a
 * chip, no separate selection pathway. The CATEGORY OPEN block then orients
 * that section and drills to a focus.
 */
export default function SectionPicker({ onSelect, disabled }: SectionPickerProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginTop: "12px",
        animation: "mwFadeIn 0.3s ease-out both",
      }}
    >
      {LAYERS.map((layer) => (
        <button
          key={layer.slug}
          onClick={() => onSelect(layer.name)}
          disabled={disabled}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            textAlign: "left",
            width: "100%",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
            backgroundColor: "var(--session-cream-bright)",
            border: "1px solid var(--session-persona-border)",
            borderLeft: "3px solid var(--session-persona)",
            borderRadius: "8px",
            padding: "12px 14px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "16px",
              fontWeight: 500,
              lineHeight: 1.3,
              color: "var(--session-persona)",
            }}
          >
            {layer.name}
          </span>
          <span
            style={{
              fontSize: "13px",
              lineHeight: 1.4,
              color: "var(--session-ink-soft)",
            }}
          >
            {layer.tagline}
          </span>
        </button>
      ))}
    </div>
  );
}
