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

  const [showSheet, setShowSheet] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const doExportAndShare = useCallback(async () => {
    setShowSheet(false);
    setIsGenerating(true);
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

        {/* Right spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />
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

        {/* Share invitation — always visible at bottom */}
        <div
          style={{
            margin: "40px 16px 24px",
            padding: 24,
            background: "rgba(166, 139, 107, 0.08)",
            border: "1px solid rgba(166, 139, 107, 0.15)",
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 400,
              color: "#1A1614",
              margin: "0 0 8px 0",
              letterSpacing: "-0.2px",
            }}
          >
            Share how you operate
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "#6B6360",
              lineHeight: 1.55,
              margin: "0 0 16px 0",
            }}
          >
            Export a read-only version of your manual so someone can understand
            how you work.
          </p>
          <button
            onClick={() => setShowSheet(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 500,
              color: "#A0734E",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            Share your manual
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3l4 4-4 4"
                stroke="#A0734E"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Context half-sheet */}
      {showSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setShowSheet(false)}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "var(--session-backdrop-heavy)",
              animation: "sheetBackdropIn 0.2s ease-out both",
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--session-cream)",
              borderRadius: "20px 20px 0 0",
              padding: "32px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
              animation: "sheetSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(0,0,0,0.12)",
                margin: "0 auto 24px",
              }}
            />

            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 400,
                color: "#1A1614",
                margin: "0 0 16px 0",
                letterSpacing: "-0.3px",
              }}
            >
              What gets shared
            </h2>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                color: "#4A4440",
                lineHeight: 1.6,
                margin: "0 0 20px 0",
              }}
            >
              Everything on this page — your sections, your narratives, your
              patterns — will be exported as a document you can send to anyone.
              Your conversations with Sage and any session transcripts are never
              included.
            </p>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                color: "#4A4440",
                lineHeight: 1.6,
                margin: "0 0 28px 0",
              }}
            >
              Feel free to send it to yourself first if you want to see how it
              looks.
            </p>

            {/* Export button */}
            <button
              onClick={doExportAndShare}
              disabled={isGenerating}
              style={{
                width: "100%",
                padding: 16,
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor: isGenerating ? "#C4A888" : "#A0734E",
                border: "none",
                borderRadius: 10,
                cursor: isGenerating ? "default" : "pointer",
                transition: "background-color 0.2s ease",
              }}
            >
              {isGenerating ? "Preparing your manual..." : "Export and share"}
            </button>

            {/* Cancel */}
            <button
              onClick={() => setShowSheet(false)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 12,
                padding: "10px 0",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 400,
                color: "#8A8480",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay — shown after sheet closes during generation */}
      {isGenerating && !showSheet && (
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
