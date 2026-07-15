"use client";

import { useState } from "react";
import { LineIcon, moduleIconPath } from "@/components/home/LineIcon";
import type { HomeModule } from "@/lib/modules";

// The "ways to begin" module cards, shared by MobileHome and DesktopHome.
// Modules are founder-authored rows (the `modules` table, edited at
// /admin/modules) — each one is simultaneously a door in and a section of
// the Manual. Only ENABLED modules arrive here (served by
// /api/onboarding-status), so there is no disabled/"Coming soon" state:
// a disabled module simply isn't in the list. `variant` controls only the
// grid — desktop lays cards across a row, mobile stacks them — never the
// card itself.

interface WaysToBeginProps {
  modules: HomeModule[];
  onStartConversation: (slug: string) => void;
  // Confirmed-entry count per module slug — each card shows what has
  // accumulated inside its module (door and Manual section are one thing).
  entryCounts?: Record<string, number>;
  // Section label above the cards. Admin-editable app copy.
  label: string;
  variant?: "mobile" | "desktop";
}

export default function WaysToBegin({
  modules,
  onStartConversation,
  entryCounts,
  label,
  variant = "mobile",
}: WaysToBeginProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isDesktop = variant === "desktop";

  // Only enabled modules are doors; disabled ones still show in the Manual.
  const doors = modules.filter((m) => m.enabled);
  if (doors.length === 0) return null;

  return (
    <section aria-label={label} style={{ marginTop: isDesktop ? 26 : 12 }}>
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
        {label}
      </p>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isDesktop
            ? `repeat(${Math.min(doors.length, 3)}, 1fr)`
            : "1fr",
          gap: 12,
        }}
      >
        {doors.map((m) => {
          const isHovered = hovered === m.slug;
          const count = entryCounts?.[m.slug] ?? 0;
          return (
            <button
              key={m.slug}
              aria-label={m.name}
              onClick={() => onStartConversation(m.slug)}
              onMouseEnter={() => setHovered(m.slug)}
              onMouseLeave={() => setHovered(null)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                // Desktop stacks the card (icon over title over cue); mobile
                // lays it out as a compact row (icon · text · arrow).
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
                <LineIcon d={moduleIconPath(m.icon)} size={isDesktop ? 18 : 17} />
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
                  {m.name}
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
                  {m.description}
                </span>
                {count > 0 && (
                  <span
                    style={{
                      marginTop: isDesktop ? 6 : 3,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "var(--session-walnut-meta)",
                    }}
                  >
                    {count === 1 ? "1 entry" : `${count} entries`}
                  </span>
                )}
              </span>
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
                {isDesktop ? `${m.cue} →` : "→"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
