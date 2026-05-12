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
import TopBar from "@/components/shared/TopBar";

const MANUAL_INTRO_KEY = "mw_manual_intro_seen";

interface MobileManualProps {
  entries: ManualEntry[];
  firstName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  onNavigateToSession?: () => void;
  onOpenDrawer?: () => void;
}

export default function MobileManual({ entries, firstName, onExploreWithPersona, onNavigateToSession, onOpenDrawer }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = buildLayers(entries);
  const isEmpty = layers.every((l) => l.entries.length === 0);
  const totalEntries = entries.length;
  const totalLabel = totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;

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
      const name = firstName || "User";
      const pdf = generateManualPdf(name, currentLayers);
      await shareManual(pdf, name);
      trackManualExported({ format: "pdf", entry_count: entries.length });
    } catch (err) {
      console.error("[MobileManual] Share failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [firstName, entries]);

  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <TopBar onBack={onNavigateToSession} onMenu={onOpenDrawer} />

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
          background: "linear-gradient(to bottom, var(--session-glow-scroll) 0%, var(--session-persona-tint) 40%, transparent 100%)",
        }}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          position: "relative",
        }}
      >
        {/* Page title — total count eyebrow + heading */}
        <div style={{ padding: "20px 24px 24px" }}>
          {totalEntries > 0 && (
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
              {totalLabel}
            </p>
          )}
          <h1
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: "26px",
              fontWeight: 500,
              color: "var(--session-ink)",
              margin: totalEntries > 0 ? "6px 0 0" : 0,
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
            }}
          >
            Your Manual<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
          </h1>
        </div>

        {/* Quiet day-one placeholder — appears only when no entries exist.
            The five labeled sections below are the structural promise. */}
        {isEmpty && (
          <p
            style={{
              margin: "0 24px 18px",
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 15,
              fontStyle: "italic",
              lineHeight: 1.55,
              color: "var(--session-ink-mid)",
            }}
          >
            Your Manual fills as you and {PERSONA_NAME} find patterns together
            <span style={{ color: "var(--session-walnut)", fontStyle: "normal" }}>.</span>
          </p>
        )}

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
            padding: "20px 22px 22px",
            background: "var(--session-walnut-surface)",
            border: "1px solid var(--session-walnut-border)",
            borderRadius: "18px",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
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
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontSize: 15,
              color: "var(--session-ink-soft)",
              lineHeight: 1.6,
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
              color: "var(--session-walnut-light)",
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
                stroke="currentColor"
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

          {/* Sheet — walnut glass, Spectral prose, TextBtn CTA */}
          <div
            style={{
              position: "relative",
              background: "var(--session-walnut-surface)",
              border: "1px solid var(--session-bubble-border)",
              borderBottom: "none",
              borderRadius: "22px 22px 0 0",
              padding: "20px 24px calc(28px + env(safe-area-inset-bottom, 0px))",
              animation: "sheetSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              boxShadow: "var(--session-sheet-shadow)",
            }}
          >
            {/* Drag handle */}
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "var(--session-walnut-border)",
                margin: "0 auto 18px",
              }}
            />

            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
              }}
            >
              {totalLabel} · PDF
            </p>
            <h2
              id="share-sheet-heading"
              style={{
                margin: "8px 0 0",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 22,
                fontWeight: 500,
                color: "var(--session-ink)",
                lineHeight: 1.25,
                letterSpacing: "-0.3px",
              }}
            >
              Share your manual
              <span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
            </h2>

            <p
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 15,
                color: "var(--session-ink-soft)",
                lineHeight: 1.62,
                letterSpacing: "-0.05px",
              }}
            >
              Everything on this page — your sections, your narratives, your
              patterns — exports as a document you can send to anyone. Your
              conversations with {PERSONA_NAME} and any session transcripts
              are never included.
            </p>

            <p
              style={{
                margin: "10px 0 22px",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
                lineHeight: 1.6,
              }}
            >
              Send it to yourself first if you want to see how it looks.
            </p>

            {/* Generate-and-share — TextBtn pattern */}
            <button
              onClick={doExportAndShare}
              disabled={isGenerating}
              style={{
                all: "unset",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                width: "100%",
                padding: "10px 0",
                borderBottom: "1px solid var(--session-ink)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "2.4px",
                textTransform: "uppercase",
                color: "var(--session-ink)",
                cursor: isGenerating ? "default" : "pointer",
                opacity: isGenerating ? 0.6 : 1,
                boxSizing: "border-box",
              }}
            >
              <span>{isGenerating ? "Preparing your manual…" : "Generate PDF & share"}</span>
              <span aria-hidden="true">›</span>
            </button>

            {/* Cancel */}
            <button
              onClick={() => setShowSheet(false)}
              style={{
                all: "unset",
                display: "block",
                width: "100%",
                marginTop: 16,
                padding: "8px 0",
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--session-ink-mid)",
                cursor: "pointer",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              cancel
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
              border: "1px solid var(--session-walnut-border)",
              borderRadius: "18px",
              padding: "32px 24px",
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
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
                borderRadius: 0,
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
