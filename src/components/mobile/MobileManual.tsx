"use client";

import { useRef, useState, useCallback } from "react";
import { buildLayers } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import type { ManualComponent, ExplorationContext } from "@/lib/types";
import { generateManualPdf } from "@/lib/utils/generate-manual-pdf";
import { shareManual } from "@/lib/utils/share-manual";

interface MobileManualProps {
  components: ManualComponent[];
  displayName: string;
  onExploreWithSage?: (context: ExplorationContext) => void;
}

export default function MobileManual({ components, displayName, onExploreWithSage }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(components);
  const isEmpty = layers.every((l) => l.component === null && l.patterns.length === 0);
  const populatedLayers = layers.filter((l) => l.component !== null || l.patterns.length > 0);
  const emptyLayers = layers.filter((l) => l.component === null && l.patterns.length === 0);
  const entryCount = components.length;

  const [showNudge, setShowNudge] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const doShare = useCallback(async () => {
    setShowNudge(false);
    setIsGenerating(true);
    // Yield a frame so the loading overlay paints before the synchronous PDF generation
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const currentLayers = buildLayers(components);
      const name = displayName || "User";
      const pdf = generateManualPdf(name, currentLayers);
      await shareManual(pdf, name);
    } catch (err) {
      console.error("[MobileManual] Share failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [displayName, components]);

  const handleShare = useCallback(() => {
    if (entryCount < 3) {
      setShowNudge(true);
    } else {
      doShare();
    }
  }, [entryCount, doShare]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {/* Left spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            letterSpacing: "15px",
            textTransform: "uppercase",
            paddingLeft: "15px",
          }}
        >
          MANTLE
        </span>

        {/* Share button — right */}
        <div style={{ minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {entryCount > 0 && (
            <button
              onClick={handleShare}
              disabled={isGenerating}
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: isGenerating ? "default" : "pointer",
                padding: 0,
                opacity: isGenerating ? 0.4 : 0.55,
                transition: "opacity 0.2s ease",
              }}
              aria-label="Share manual"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 3v10M10 3l3.5 3.5M10 3L6.5 6.5"
                  stroke="var(--session-ink)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 12v3a2 2 0 002 2h8a2 2 0 002-2v-3"
                  stroke="var(--session-ink)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scroll fade overlay */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: 0,
          right: 0,
          height: "48px",
          zIndex: 1,
          pointerEvents: "none",
          background: "linear-gradient(to bottom, rgba(200,185,140,0.18) 0%, rgba(200,185,140,0.06) 40%, transparent 100%)",
        }}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 0,
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
          position: "relative",
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: 0,
            padding: "16px 20px 28px",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
          }}
        >
          Your Manual
        </h1>

        {/* Empty state atmospheric text */}
        {isEmpty && (
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "15px",
              color: "var(--session-ink-ghost)",
              margin: "0 0 0 0",
              padding: "0 20px",
              maxWidth: 310,
              lineHeight: 1.6,
              letterSpacing: "-0.1px",
              animation: "manualAtmoFadeIn 1.8s ease-out 0.5s both",
            }}
          >
            Sage is learning how you operate. Your manual will take shape as you
            talk.
          </p>
        )}

        {/* Layer list */}
        <div style={{ marginTop: isEmpty ? 32 : 0, position: "relative" }}>
          {isEmpty ? (
            <div style={{ padding: "0 20px" }}>
              {layers.map((layer) => <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />)}
            </div>
          ) : (
            <>
              {/* Populated layers — with horizontal padding */}
              <div style={{ padding: "0 16px" }}>
                {populatedLayers.map((layer) => (
                  <PopulatedLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                ))}
              </div>

              {/* Upcoming label + empty layers below populated */}
              {emptyLayers.length > 0 && (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      fontWeight: 500,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "var(--session-ink-faded)",
                      margin: 0,
                      padding: "20px 20px 10px",
                    }}
                  >
                    UPCOMING
                  </p>
                  <div style={{ padding: "0 20px" }}>
                    {emptyLayers.map((layer) => (
                      <EmptyLayer key={layer.id} layer={layer} onExploreWithSage={onExploreWithSage} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nudge modal — shown when < 3 entries */}
      {showNudge && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--session-backdrop-heavy)",
            padding: "32px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--session-cream)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "320px",
              width: "100%",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: "var(--session-ink)",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
              }}
            >
              Your manual is still early. Sharing works best with more patterns.
              Keep building, or share what you have?
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowNudge(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--session-ink)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--session-ink-hairline)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Keep building
              </button>
              <button
                onClick={doShare}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--session-ink)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--session-ink-hairline)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                Share what I have
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isGenerating && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--session-backdrop-heavy)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "15px",
              color: "var(--session-ink)",
              letterSpacing: "-0.2px",
            }}
          >
            Preparing your manual...
          </p>
        </div>
      )}
    </div>
  );
}
