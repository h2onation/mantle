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

const LAYER_NAMES: Record<number, string> = {
  1: "WHAT DRIVES YOU",
  2: "YOUR SELF PERCEPTION",
  3: "YOUR REACTION SYSTEM",
  4: "HOW YOU OPERATE",
  5: "YOUR RELATIONSHIP TO OTHERS",
};

const ALL_LAYERS = [1, 2, 3, 4, 5];

export default function MobileManual({ components }: MobileManualProps) {
  const hasComponents = components.length > 0;

  // Group components by layer
  const byLayer = new Map<number, ManualComponent[]>();
  for (const comp of components) {
    const existing = byLayer.get(comp.layer) || [];
    existing.push(comp);
    byLayer.set(comp.layer, existing);
  }

  // Within each layer, sort: component first, then patterns by created_at
  byLayer.forEach((items) => {
    items.sort((a: ManualComponent, b: ManualComponent) => {
      if (a.type === "component" && b.type !== "component") return -1;
      if (a.type !== "component" && b.type === "component") return 1;
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  });

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "40px 24px 56px",
        position: "relative",
      }}
    >
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
        MANUAL · {components.length} CONFIRMED
      </p>

      {/* Empty state */}
      {!hasComponents && (
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

      {/* All 5 layers */}
      {ALL_LAYERS.map((layer, layerIdx) => {
        const layerItems = byLayer.get(layer) || [];
        const hasContent = layerItems.length > 0;

        return (
          <div key={layer} style={!hasContent ? { opacity: 0.3 } : undefined}>
            {/* Divider between layers */}
            {layerIdx > 0 && (
              <div
                style={{
                  height: "1px",
                  background: "linear-gradient(90deg, var(--color-accent-ghost), transparent)",
                  marginBottom: "40px",
                }}
              />
            )}

            {/* Layer header */}
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
              {String(layer).padStart(2, "0")} — {LAYER_NAMES[layer]}
            </p>

            {/* Layer content or forming placeholder */}
            {!hasContent && (
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
            )}

            {/* Confirmed items within this layer */}
            {layerItems.map((comp, itemIdx) => (
              <div key={comp.id}>
                {/* Pattern sub-label (patterns show their name) */}
                {comp.type === "pattern" && comp.name && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-accent)",
                      opacity: 0.5,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      margin: itemIdx > 0 ? "24px 0 10px 0" : "0 0 10px 0",
                    }}
                  >
                    PATTERN — {comp.name.toUpperCase()}
                  </p>
                )}

                {comp.type === "pattern" && !comp.name && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-accent)",
                      opacity: 0.5,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      margin: itemIdx > 0 ? "24px 0 10px 0" : "0 0 10px 0",
                    }}
                  >
                    PATTERN
                  </p>
                )}

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
                    marginBottom: itemIdx === layerItems.length - 1 ? "40px" : "0",
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
          </div>
        );
      })}
    </div>
  );
}
