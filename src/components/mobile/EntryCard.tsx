"use client";

import React from "react";

/**
 * Welcome-screen entry-mode card. Three of these render side-by-side
 * (Navigate a situation / Guided intake / Upload) on a new-conversation
 * screen — they were ~80% duplicate JSX before extraction (ADR-042 §
 * Phase 1.7). Same outer button shape, same icon-circle pattern, same
 * chevron; only the icon SVG, title, subtitle, and onClick handler
 * differ per card.
 *
 * Pre-conversation affordance — not subject to ADR-018 (which keeps
 * in-conversation message rendering inside MobileSession).
 */
export interface EntryCardProps {
  /** Icon glyph rendered inside the 36×36 persona-muted circle. Caller
   *  provides the SVG; this component handles the container styling. */
  icon: React.ReactNode;
  /** Card title — serif, 14.5px. Shown as the primary affordance label. */
  title: string;
  /** Card subtitle — sans, 11.5px, ink-mid. One short clarifying line. */
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function EntryCard({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: EntryCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px 18px",
        backgroundColor: "var(--session-walnut-surface)",
        border: "1px solid var(--session-walnut-border)",
        borderRadius: "14px",
        cursor: "pointer",
        textAlign: "left" as const,
        width: "100%",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          backgroundColor: "var(--session-persona-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "14.5px",
            color: "var(--session-ink)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "11.5px",
            color: "var(--session-ink-mid)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M6 4l4 4-4 4"
          stroke="var(--session-ink-ghost)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
