"use client";

import { useState } from "react";
import type { ConversationMode } from "@/lib/persona/config";
import { LineIcon, IC_CHAT, IC_LIST, IC_UPLOAD } from "@/components/home/LineIcon";
import { APP_COPY_DEFAULTS, type AppCopy } from "@/lib/persona/app-copy";

// The "ways to begin" entry-point doors, shared by MobileHome and DesktopHome.
// The three doors (icon + mode) live here ONCE; both platforms render the same
// cards with the same anatomy. `variant` controls only the grid — desktop lays
// the three out across a row, mobile stacks them in one column — never the card
// itself. The door COPY (title / description / button) is admin-editable and
// arrives via appCopy.doors[mode].

interface WaysToBeginProps {
  onStartConversation: (mode: ConversationMode) => void;
  // Which doors are live (per-mode feature gates, read server-side). A door
  // whose mode is false renders dimmed + non-interactive with a "Coming soon"
  // tag. All three modes are gate-backed. Defaults to all-on if omitted.
  enabledModes?: Record<ConversationMode, boolean>;
  // Admin-editable door + section copy. Defaults to the shipped strings.
  appCopy?: AppCopy;
  variant?: "mobile" | "desktop";
}

// Door identity (icon + which conversation mode it opens). The visible text
// lives in appCopy.doors[mode]; `key` is a stable React/hover id.
const DOORS: { key: string; icon: string; mode: ConversationMode }[] = [
  { key: "guided", icon: IC_LIST, mode: "guided-intake" },
  { key: "situation", icon: IC_CHAT, mode: "situation" },
  { key: "upload", icon: IC_UPLOAD, mode: "upload" },
];

export default function WaysToBegin({
  onStartConversation,
  enabledModes,
  appCopy = APP_COPY_DEFAULTS,
  variant = "mobile",
}: WaysToBeginProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isDesktop = variant === "desktop";

  // Live doors first, "Coming soon" doors after — so the thing a user can
  // actually do leads (if only Situation is live, it's the first card). Within
  // each group the base DOORS order holds. No gates → base order untouched.
  const orderedDoors = enabledModes
    ? [
        ...DOORS.filter((w) => enabledModes[w.mode]),
        ...DOORS.filter((w) => !enabledModes[w.mode]),
      ]
    : DOORS;

  return (
    <section aria-label={appCopy.waysToBeginLabel} style={{ marginTop: isDesktop ? 26 : 12 }}>
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
        {appCopy.waysToBeginLabel}
      </p>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
          gap: 12,
        }}
      >
        {orderedDoors.map((w) => {
          // A door is disabled when its mode's gate is off. Disabled doors are
          // dimmed, non-interactive, and tagged "Coming soon" instead of
          // showing the start cue.
          const disabled = enabledModes ? !enabledModes[w.mode] : false;
          const isHovered = !disabled && hovered === w.key;
          const copy = appCopy.doors[w.mode];
          return (
          <button
            key={w.key}
            disabled={disabled}
            aria-label={disabled ? `${copy.title} — coming soon` : copy.title}
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
                {copy.title}
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
                {copy.desc}
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
                {isDesktop ? `${copy.cue} →` : "→"}
              </span>
            )}
          </button>
          );
        })}
      </div>
    </section>
  );
}
