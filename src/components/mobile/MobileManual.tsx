"use client";

import React from "react";

interface ManualComponent {
  id: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
  created_at?: string;
}

interface MobileManualProps {
  components: ManualComponent[];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const parts: (string | React.ReactElement)[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let keyIdx = 0;
    while ((match = regex.exec(para)) !== null) {
      if (match.index > lastIndex) {
        parts.push(para.slice(lastIndex, match.index));
      }
      parts.push(<strong key={keyIdx++}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < para.length) {
      parts.push(para.slice(lastIndex));
    }
    const withBreaks: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part === "string") {
        const lines = part.split("\n");
        lines.forEach((line, j) => {
          if (j > 0) withBreaks.push(<br key={`br-${keyIdx++}`} />);
          withBreaks.push(line);
        });
      } else {
        withBreaks.push(part);
      }
    }
    return (
      <p key={i} style={{ margin: i === 0 ? 0 : "12px 0 0 0" }}>
        {withBreaks}
      </p>
    );
  });
}

// Layer types that might appear
const LAYER_TYPES: Record<number, string> = {
  1: "DRIVE",
  2: "PATTERN",
  3: "ATTACHMENT",
};

export default function MobileManual({ components }: MobileManualProps) {
  const hasComponents = components.length > 0;

  // Sort: layer ascending, then by created_at
  const sorted = [...components].sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    if (a.created_at && b.created_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return 0;
  });

  // Find layers that don't have any components yet
  const existingLayers = new Set(components.map((c) => c.layer));
  const upcomingLayers = [1, 2, 3].filter((l) => !existingLayers.has(l));

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "40px 24px 56px",
        position: "relative",
      }}
    >
      {/* Faint glow */}
      <div
        style={{
          position: "fixed",
          top: "5%",
          right: "20%",
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)",
          opacity: 0.03,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          color: "var(--color-text-ghost)",
          letterSpacing: "3px",
          textTransform: "uppercase",
          margin: "0 0 40px 0",
        }}
      >
        MANUAL{hasComponents ? ` · ${components.length} CONFIRMED` : ""}
      </p>

      {/* Empty state */}
      {!hasComponents && upcomingLayers.length === 3 && (
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            color: "var(--color-text-ghost)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Your manual will form as you go.
        </p>
      )}

      {/* Confirmed components */}
      {sorted.map((comp, i) => (
        <div key={comp.id}>
          {/* Divider between components */}
          {i > 0 && (
            <div
              style={{
                height: "1px",
                background: "linear-gradient(90deg, var(--color-accent-ghost), transparent)",
                marginBottom: "40px",
              }}
            />
          )}

          {/* Label */}
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-accent)",
              opacity: 0.7,
              letterSpacing: "2px",
              textTransform: "uppercase",
              margin: "0 0 14px 0",
            }}
          >
            {String(i + 1).padStart(2, "0")} — {comp.type?.toUpperCase() || "COMPONENT"}
          </p>

          {/* Passage */}
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "16px",
              color: "var(--color-text)",
              lineHeight: 1.8,
              letterSpacing: "-0.1px",
            }}
          >
            {renderMarkdown(comp.content)}
          </div>

          {/* Date + "Still true?" */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "10px",
              marginBottom: "40px",
            }}
          >
            {comp.created_at && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "var(--color-text-ghost)",
                  letterSpacing: "1px",
                }}
              >
                {formatDate(comp.created_at)}
              </span>
            )}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--color-accent-dim)",
                letterSpacing: "1px",
              }}
            >
              Still true?
            </span>
          </div>
        </div>
      ))}

      {/* Upcoming layers */}
      {upcomingLayers.map((layer) => (
        <div key={`upcoming-${layer}`} style={{ opacity: 0.3 }}>
          {(hasComponents || upcomingLayers[0] !== layer) && (
            <div
              style={{
                height: "1px",
                background: "linear-gradient(90deg, var(--color-accent-ghost), transparent)",
                marginBottom: "40px",
              }}
            />
          )}
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-accent)",
              opacity: 0.7,
              letterSpacing: "2px",
              textTransform: "uppercase",
              margin: "0 0 14px 0",
            }}
          >
            {String(components.length + upcomingLayers.indexOf(layer) + 1).padStart(2, "0")} — {LAYER_TYPES[layer] || "COMPONENT"}
          </p>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "14px",
              color: "var(--color-text-ghost)",
              fontStyle: "italic",
              margin: "0 0 40px 0",
            }}
          >
            Forming...
          </p>
        </div>
      ))}
    </div>
  );
}
