"use client";

import { useRef, useState, useCallback } from "react";
import { buildLayers } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import type { ManualEntry, ExplorationContext } from "@/lib/types";
import { generateManualPdf } from "@/lib/utils/generate-manual-pdf";
import { shareManual } from "@/lib/utils/share-manual";
import { PERSONA_NAME } from "@/lib/persona/config";
import { trackManualExported } from "@/lib/analytics/events";

const MANUAL_INTRO_KEY = "mw_manual_intro_seen";

interface MobileManualProps {
  entries: ManualEntry[];
  displayName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  onNavigateToSession?: () => void;
}

export default function MobileManual({ entries, displayName, onExploreWithPersona, onNavigateToSession }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(entries);
  const isEmpty = layers.every((l) => l.entries.length === 0);

  const [showSheet, setShowSheet] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(MANUAL_INTRO_KEY);
  });

  function dismissIntro() {
    localStorage.setItem(MANUAL_INTRO_KEY, "1");
    setShowIntroModal(false);
  }

  function handleTalkToPersona() {
    dismissIntro();
    onNavigateToSession?.();
  }

  const doExportAndShare = useCallback(async () => {
    setShowSheet(false);
    setIsGenerating(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const currentLayers = buildLayers(entries);
      const name = displayName || "User";
      const pdf = generateManualPdf(name, currentLayers);
      await shareManual(pdf, name);
      trackManualExported({ format: "pdf", entry_count: entries.length });
    } catch (err) {
      console.error("[MobileManual] Share failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [displayName, entries]);

  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <header
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
            fontSize: "20px",
            fontWeight: 400,
            color: "var(--session-ink-faded)",
            letterSpacing: "1.5px",
            paddingLeft: "4px",
          }}
        >
          my walnut
        </span>

        {/* Right spacer */}
        <div style={{ minWidth: "44px", minHeight: "44px" }} />
      </header>

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
          paddingBottom: "calc(52px + env(safe-area-inset-bottom, 0px))",
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

        {/* Layer list — unified ordering, populated and empty render side by side */}
        <div style={{ padding: "0 20px", position: "relative" }}>
          {layers.map((layer) =>
            layer.entries.length > 0 ? (
              <PopulatedLayer
                key={layer.id}
                layer={layer}
                onExploreWithPersona={onExploreWithPersona}
              />
            ) : (
              <EmptyLayer key={layer.id} layer={layer} />
            )
          )}
        </div>

        {/* Share invitation — only when at least one entry exists */}
        {!isEmpty && (
        <div
          style={{
            margin: "40px 20px 24px",
            padding: "1.25rem",
            background: "rgba(0, 0, 0, 0.03)",
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 400,
              color: "var(--session-ink)",
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
              color: "var(--session-ink-soft)",
              lineHeight: 1.55,
              margin: "0 0 16px 0",
            }}
          >
            Share a version of your manual so someone can understand how you
            work.
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
        )}
      </div>

      {/* Context half-sheet */}
      {showSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-sheet-heading"
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
            aria-hidden="true"
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
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(0,0,0,0.12)",
                margin: "0 auto 24px",
              }}
            />

            <h2
              id="share-sheet-heading"
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
              Your conversations with {PERSONA_NAME} and any session transcripts are never
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

      {/* First-visit intro modal */}
      {showIntroModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-intro-heading"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--session-backdrop-heavy)",
          }}
        >
          <div
            style={{
              width: "calc(100% - 48px)",
              maxWidth: 380,
              backgroundColor: "var(--session-cream)",
              borderRadius: 12,
              padding: "32px 24px",
            }}
          >
            <p
              id="manual-intro-heading"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 17,
                fontWeight: 400,
                color: "var(--session-ink)",
                lineHeight: 1.55,
                margin: "0 0 16px 0",
                letterSpacing: "-0.2px",
              }}
            >
              This is your manual. It&apos;s a guide to how you operate, built
              from your conversations with {PERSONA_NAME}.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "var(--session-ink-soft)",
                lineHeight: 1.6,
                margin: "0 0 12px 0",
              }}
            >
              Each section fills in as you talk. {PERSONA_NAME} will surface patterns,
              reflect them back, and you decide what&apos;s accurate. Nothing
              writes without your say.            </p>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "var(--session-ink-soft)",
                lineHeight: 1.6,
                margin: "0 0 28px 0",
              }}
            >
              Start a conversation and your manual will take shape.
            </p>

            <button
              onClick={handleTalkToPersona}
              style={{
                width: "100%",
                padding: 14,
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--session-cream)",
                backgroundColor: "var(--session-persona)",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Talk to {PERSONA_NAME}
            </button>
            <button
              onClick={dismissIntro}
              style={{
                display: "block",
                width: "100%",
                marginTop: 10,
                padding: "10px 0",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 400,
                color: "var(--session-ink-ghost)",
                background: "none",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
