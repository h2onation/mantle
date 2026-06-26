"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { buildLayers, SECTION_TILE_STYLE } from "./manual/layer-definitions";
import EmptyLayer from "./manual/EmptyLayer";
import PopulatedLayer from "./manual/PopulatedLayer";
import type { ManualEntry, ExplorationContext } from "@/lib/types";

type UpdateEntryResult =
  | { ok: true; entry: ManualEntry }
  | { ok: false; error: string };
import { generateManualPdf } from "@/lib/utils/generate-manual-pdf";
import { shareManual } from "@/lib/utils/share-manual";
import { PERSONA_NAME } from "@/lib/persona/config";
import { trackManualExported } from "@/lib/analytics/events";
import TopBar from "@/components/shared/TopBar";


interface MobileManualProps {
  entries: ManualEntry[];
  firstName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  onUpdateEntry?: (
    entryId: string,
    edits: { name?: string | null; content?: string }
  ) => Promise<UpdateEntryResult>;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
  // true on desktop: the share sheet renders as a centered modal instead of a
  // bottom half-sheet pinned to the viewport. Defaults to the mobile sheet.
  isDesktop?: boolean;
}

export default function MobileManual({ entries, firstName, onExploreWithPersona, onUpdateEntry, showTopBar = true, isDesktop = false }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = useMemo(() => buildLayers(entries), [entries]);
  const isEmpty = layers.every((l) => l.entries.length === 0);
  const totalEntries = entries.length;
  const totalLabel = totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;
  // Masthead meta line — mirrors Home's "N of 5 started" count gesture, in the
  // same mono register. Every entry is homed on one of the five sections, so a
  // non-empty manual always has at least one started section.
  const startedSections = layers.filter((l) => l.entries.length > 0).length;
  const metaLine = isEmpty
    ? "Nothing saved yet"
    : `${startedSections} ${
        startedSections === 1 ? "section" : "sections"
      } started · ${totalLabel}`;

  const [showSheet, setShowSheet] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const doExportAndShare = useCallback(async () => {
    setShowSheet(false);
    setIsGenerating(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const name = firstName || "User";
      const pdf = generateManualPdf(name, layers);
      await shareManual(pdf, name);
      trackManualExported({ format: "pdf", entry_count: entries.length });
    } catch (err) {
      console.error("[MobileManual] Share failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [firstName, entries.length, layers]);

  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {showTopBar && <TopBar />}

      {/* Scrollable content. Page padding matches Home (28px 22px) so the two
          screens share the same optical left and top rhythm. */}
      <div
        ref={scrollRef}
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 22px calc(32px + env(safe-area-inset-bottom, 0px))",
          position: "relative",
        }}
      >
        {/* Masthead — Fraunces title + mono count line + italic subtitle.
            Same gesture as Home's greeting + date line, kept in the Manual's
            own voice (the walnut period, the document subtitle). */}
        <header>
          <h1
            style={{
              fontFamily: "var(--font-display), var(--font-serif), serif",
              fontSize: 30,
              fontWeight: 500,
              color: "var(--session-ink)",
              margin: 0,
              letterSpacing: "-0.018em",
              lineHeight: 1.06,
              fontFeatureSettings: '"liga","dlig","kern"',
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          >
            Your Manual<span style={{ color: "var(--session-walnut)", fontWeight: 500 }}>.</span>
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "var(--session-ink-faded)",
            }}
          >
            {metaLine}
          </p>
          <p
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--session-ink-soft)",
              margin: "9px 0 0",
              maxWidth: 300,
              letterSpacing: "0.005em",
              textWrap: "pretty" as React.CSSProperties["textWrap"],
            }}
          >
            A document about how you operate, in your own voice.
          </p>
        </header>

        {/* Section tiles — the same white-tile material Home uses, stacked in
            a column. Each tile owns its own card shell (SECTION_TILE_STYLE);
            the gap is the only spacing between them. */}
        <div
          style={{
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {layers.map((layer) =>
            layer.entries.length > 0 ? (
              <PopulatedLayer
                key={layer.id}
                layer={layer}
                onUpdateEntry={onUpdateEntry}
              />
            ) : (
              <EmptyLayer
                key={layer.id}
                layer={layer}
                onExploreWithPersona={onExploreWithPersona}
              />
            )
          )}
        </div>

        {/* Share invitation — a white tile in the same material as the
            section tiles, closing the page. Only when at least one entry
            exists. */}
        {!isEmpty && (
          <section
            style={{
              ...SECTION_TILE_STYLE,
              marginTop: 20,
              padding: "18px 20px 20px",
            }}
          >
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
              {totalLabel} · PDF
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display), var(--font-serif), serif",
                fontSize: 20,
                fontWeight: 500,
                color: "var(--session-ink)",
                margin: "9px 0 0",
                letterSpacing: "-0.3px",
                lineHeight: 1.25,
              }}
            >
              Share how you operate<span style={{ color: "var(--session-walnut)", fontWeight: 500 }}>.</span>
            </h2>
            <p
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 14.5,
                color: "var(--session-ink-soft)",
                lineHeight: 1.6,
                margin: "8px 0 14px",
                textWrap: "pretty" as React.CSSProperties["textWrap"],
              }}
            >
              Send a version to someone who needs to understand how you work.
            </p>
            <button
              onClick={() => setShowSheet(true)}
              style={{
                all: "unset",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                paddingBottom: 2,
                borderBottom: "1px solid var(--session-walnut)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: "var(--session-walnut)",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span>Share your manual</span>
              <span aria-hidden="true">›</span>
            </button>
          </section>
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
            justifyContent: isDesktop ? "center" : "flex-end",
            alignItems: isDesktop ? "center" : "stretch",
            padding: isDesktop ? 24 : 0,
            boxSizing: "border-box",
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
              width: "100%",
              maxWidth: isDesktop ? 440 : undefined,
              background: "var(--session-walnut-surface)",
              border: "1px solid var(--session-bubble-border)",
              borderBottom: isDesktop
                ? "1px solid var(--session-bubble-border)"
                : "none",
              borderRadius: isDesktop ? 22 : "22px 22px 0 0",
              padding: isDesktop
                ? "24px 26px 26px"
                : "20px 24px calc(28px + env(safe-area-inset-bottom, 0px))",
              animation: isDesktop
                ? "checkpointFadeIn 0.25s ease-out both"
                : "sheetSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              boxShadow: isDesktop
                ? "var(--session-plate-shadow)"
                : "var(--session-sheet-shadow)",
            }}
          >
            {/* Drag handle — a bottom-sheet affordance; omitted on the
                centered desktop modal. */}
            {!isDesktop && (
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
            )}

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

    </main>
  );
}
