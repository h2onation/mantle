"use client";

import React, { useState } from "react";

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
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(
    new Set()
  );

  // Group by layer into { component, patterns }
  const byLayer = new Map<
    number,
    { component: ManualComponent | null; patterns: ManualComponent[] }
  >();
  for (const layer of ALL_LAYERS) {
    byLayer.set(layer, { component: null, patterns: [] });
  }
  for (const comp of components) {
    const layerData = byLayer.get(comp.layer);
    if (!layerData) continue;
    if (comp.type === "component") {
      layerData.component = comp;
    } else {
      layerData.patterns.push(comp);
    }
  }
  // Sort patterns by created_at
  byLayer.forEach((data) => {
    data.patterns.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      return 0;
    });
  });

  // Progress: count layers that have a confirmed component
  const layersWithComponents = Array.from(byLayer.values()).filter(
    (d) => d.component !== null
  ).length;
  const progressPercent = Math.round((layersWithComponents / 5) * 100);

  const togglePattern = (id: string) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        position: "relative",
      }}
    >
      {/* Decorative glow behind hero */}
      <div
        style={{
          position: "fixed",
          top: "6%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)",
          opacity: 0.04,
          pointerEvents: "none",
        }}
      />

      {/* Scrollable content */}
      <div style={{ padding: "32px 24px 56px" }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          {/* Left: lock + YOUR MANUAL */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ opacity: 0.6 }}
            >
              <rect
                x="2.5"
                y="5.5"
                width="7"
                height="5"
                rx="1"
                stroke="var(--color-text-ghost)"
                strokeWidth="1"
              />
              <path
                d="M4 5.5V4C4 2.9 4.9 2 6 2v0C7.1 2 8 2.9 8 4V5.5"
                stroke="var(--color-text-ghost)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--color-text-ghost)",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              YOUR MANUAL
            </span>
          </div>

          {/* Right: Share (display-only) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              opacity: 0.4,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M3.5 7v2.5a1 1 0 001 1h3a1 1 0 001-1V7"
                stroke="var(--color-text-ghost)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 2v5.5"
                stroke="var(--color-text-ghost)"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <path
                d="M4 4L6 2L8 4"
                stroke="var(--color-text-ghost)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "var(--color-text-ghost)",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              Share
            </span>
          </div>
        </div>

        {/* Hero: The Core */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "28px",
            fontWeight: 400,
            color: "var(--color-text)",
            margin: "0 0 10px 0",
            letterSpacing: "-0.5px",
            lineHeight: 1.3,
          }}
        >
          The Core
        </h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text-dim)",
            lineHeight: 1.6,
            margin: "0 0 24px 0",
          }}
        >
          Five layers of how you operate. Validated by you, grounded in how you
          actually show up.
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              height: "3px",
              borderRadius: "1.5px",
              backgroundColor: "var(--color-divider)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                backgroundColor: "var(--color-accent)",
                borderRadius: "1.5px",
                transition: "width 0.6s ease",
              }}
            />
          </div>
        </div>

        {/* Progress labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-text-ghost)",
              letterSpacing: "1px",
            }}
          >
            {progressPercent}%
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--color-text-ghost)",
              letterSpacing: "2px",
            }}
          >
            {layersWithComponents} OF 5 LAYERS COMPLETE
          </span>
        </div>

        {/* Empty state message */}
        {components.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "16px",
              color: "var(--color-text-ghost)",
              fontStyle: "italic",
              textAlign: "center",
              margin: "0 0 40px 0",
              padding: "20px 0",
            }}
          >
            Your manual will form as you go.
          </p>
        )}

        {/* Layer sections */}
        {ALL_LAYERS.map((layer, layerIdx) => {
          const layerData = byLayer.get(layer)!;
          const { component, patterns } = layerData;
          const hasContent = component !== null || patterns.length > 0;

          return (
            <div
              key={layer}
              style={!hasContent ? { opacity: 0.3 } : undefined}
            >
              {/* Divider between layers */}
              {layerIdx > 0 && (
                <div
                  style={{
                    height: "1px",
                    background:
                      "linear-gradient(90deg, var(--color-accent-ghost), transparent)",
                    margin: "40px 0",
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
                  margin: "0 0 16px 0",
                }}
              >
                {String(layer).padStart(2, "0")} — {LAYER_NAMES[layer]}
              </p>

              {/* Empty layer placeholder */}
              {!hasContent && (
                <p
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "14px",
                    color: "var(--color-text-ghost)",
                    fontStyle: "italic",
                    margin: 0,
                  }}
                >
                  Forming...
                </p>
              )}

              {/* Component description */}
              {component && (
                <div
                  style={{
                    marginBottom: patterns.length > 0 ? "0" : "0",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "16px",
                      color: "var(--color-text)",
                      lineHeight: 1.8,
                      letterSpacing: "-0.1px",
                    }}
                  >
                    {renderMarkdown(component.content)}
                  </div>

                  {/* Date + Still true? */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "10px",
                    }}
                  >
                    {component.created_at && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          color: "var(--color-text-ghost)",
                          letterSpacing: "1px",
                        }}
                      >
                        {formatDate(component.created_at)}
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
              )}

              {/* Patterns section */}
              {patterns.length > 0 && (
                <div style={{ marginTop: component ? "28px" : "0" }}>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--color-text-ghost)",
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      margin: "0 0 12px 0",
                    }}
                  >
                    PATTERNS
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {patterns.map((pattern, pIdx) => {
                      const isExpanded = expandedPatterns.has(pattern.id);

                      return (
                        <div key={pattern.id}>
                          {/* Card header — always visible */}
                          <button
                            onClick={() => togglePattern(pattern.id)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "14px 16px",
                              background: "var(--color-warm)",
                              border: "none",
                              borderRadius: isExpanded
                                ? "12px 12px 0 0"
                                : "12px",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "9px",
                                  color: "var(--color-text-ghost)",
                                  letterSpacing: "1px",
                                  minWidth: "18px",
                                }}
                              >
                                {String(pIdx + 1).padStart(2, "0")}
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: "15px",
                                  fontStyle: "italic",
                                  color: "var(--color-text)",
                                  letterSpacing: "-0.1px",
                                }}
                              >
                                {pattern.name || "Unnamed pattern"}
                              </span>
                            </div>

                            {/* Chevron */}
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              style={{
                                transform: isExpanded
                                  ? "rotate(90deg)"
                                  : "rotate(0deg)",
                                transition: "transform 0.2s ease",
                                flexShrink: 0,
                              }}
                            >
                              <path
                                d="M5 3L9.5 7L5 11"
                                stroke="var(--color-text-ghost)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div
                              style={{
                                padding: "16px",
                                background: "var(--color-warm)",
                                borderTop:
                                  "1px solid var(--color-divider)",
                                borderRadius: "0 0 12px 12px",
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: "14px",
                                  color: "var(--color-text-dim)",
                                  lineHeight: 1.75,
                                  letterSpacing: "-0.1px",
                                }}
                              >
                                {renderMarkdown(pattern.content)}
                              </div>

                              {pattern.created_at && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "12px",
                                    marginTop: "12px",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "8px",
                                      color: "var(--color-text-ghost)",
                                      letterSpacing: "1px",
                                    }}
                                  >
                                    {formatDate(pattern.created_at)}
                                  </span>
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
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
