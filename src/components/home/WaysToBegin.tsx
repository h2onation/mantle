"use client";

import { useState } from "react";
import type { ConversationMode } from "@/lib/persona/config";
import { LineIcon, IC_CHAT, IC_LIST, IC_UPLOAD } from "@/components/home/LineIcon";

// The "ways to begin" entry-point doors, shared by MobileHome and DesktopHome.
// The three doors (icon, title, description, cue, mode) live here ONCE; both
// platforms render the same cards with the same anatomy. `variant` controls
// only the grid — desktop lays the three out across a row, mobile stacks them
// in one column — never the card itself.

interface WaysToBeginProps {
  onStartConversation: (mode: ConversationMode) => void;
  // Which doors are live (per-mode feature gates, read server-side). A door
  // whose mode is false renders dimmed + non-interactive with a "Coming soon"
  // tag. Situation is always true. Defaults to all-on if omitted.
  enabledModes?: Record<ConversationMode, boolean>;
  variant?: "mobile" | "desktop";
}

const DOORS: {
  key: string;
  icon: string;
  title: string;
  desc: string;
  cue: string;
  mode: ConversationMode;
}[] = [
  {
    key: "situation",
    icon: IC_CHAT,
    title: "Bring a situation",
    desc: "A reaction that surprised you, a conflict that keeps repeating.",
    cue: "Start",
    mode: "situation",
  },
  {
    key: "guided",
    icon: IC_LIST,
    title: "Guided",
    desc: "Walk through it step by step with Jove.",
    cue: "Begin",
    mode: "guided-intake",
  },
  {
    key: "upload",
    icon: IC_UPLOAD,
    title: "Upload",
    desc: "Bring something you’ve already written.",
    cue: "Add",
    mode: "upload",
  },
];

export default function WaysToBegin({
  onStartConversation,
  enabledModes,
  variant = "mobile",
}: WaysToBeginProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isDesktop = variant === "desktop";

  return (
    <section aria-label="Ways to begin" style={{ marginTop: isDesktop ? 26 : 12 }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-walnut-meta)",
        }}
      >
        Ways to begin
      </p>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
          gap: 12,
        }}
      >
        {DOORS.map((w) => {
          // A door is disabled when its mode's gate is off (Situation is always
          // on). Disabled doors are dimmed, non-interactive, and tagged
          // "Coming soon" instead of showing the start cue.
          const disabled = enabledModes ? !enabledModes[w.mode] : false;
          const isHovered = !disabled && hovered === w.key;
          return (
          <button
            key={w.key}
            disabled={disabled}
            aria-label={disabled ? `${w.title} — coming soon` : w.title}
            onClick={disabled ? undefined : () => onStartConversation(w.mode)}
            onMouseEnter={disabled ? undefined : () => setHovered(w.key)}
            onMouseLeave={disabled ? undefined : () => setHovered(null)}
            style={{
              all: "unset",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.55 : 1,
              display: "flex",
              // Desktop stacks the card (icon over title over cue); mobile lays
              // it out as a compact row (icon · text · arrow) to save height.
              flexDirection: isDesktop ? "column" : "row",
              alignItems: isDesktop ? "flex-start" : "center",
              gap: isDesktop ? 12 : 13,
              boxSizing: "border-box",
              padding: isDesktop ? "18px 18px 15px" : "12px 14px",
              borderRadius: 14,
              background: isHovered
                ? "var(--session-cream-bright)"
                : "var(--session-cream)",
              border: `1px solid ${
                isHovered
                  ? "var(--session-walnut-border-soft)"
                  : "var(--session-hair-soft)"
              }`,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: isDesktop ? 34 : 32,
                height: isDesktop ? 34 : 32,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: "var(--session-walnut-tint)",
                color: "var(--session-walnut)",
              }}
            >
              <LineIcon d={w.icon} size={isDesktop ? 18 : 17} />
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-serif), serif",
                  fontSize: isDesktop ? 16 : 15,
                  color: "var(--session-ink)",
                  lineHeight: 1.2,
                }}
              >
                {w.title}
              </span>
              <span
                style={{
                  marginTop: isDesktop ? 4 : 2,
                  fontFamily: "var(--font-serif), serif",
                  fontSize: isDesktop ? 13 : 12.5,
                  lineHeight: 1.35,
                  color: "var(--session-ink-mid)",
                  ...(isDesktop
                    ? {}
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }),
                }}
              >
                {w.desc}
              </span>
            </span>
            {disabled ? (
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: isDesktop ? 9 : 9.5,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color: "var(--session-walnut-meta)",
                  border: "1px solid var(--session-hair-soft)",
                  borderRadius: 999,
                  padding: "3px 8px",
                }}
              >
                Coming soon
              </span>
            ) : (
              <span
                aria-hidden={isDesktop ? undefined : true}
                style={{
                  flexShrink: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: isDesktop ? 9.5 : 13,
                  letterSpacing: isDesktop ? "1px" : "0",
                  textTransform: "uppercase",
                  color: "var(--session-walnut)",
                }}
              >
                {isDesktop ? `${w.cue} →` : "→"}
              </span>
            )}
          </button>
          );
        })}
      </div>
    </section>
  );
}
