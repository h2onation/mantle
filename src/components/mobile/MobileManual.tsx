"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { buildLayers } from "./manual/layer-definitions";
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
}

export default function MobileManual({ entries, firstName, onExploreWithPersona, onUpdateEntry, showTopBar = true }: MobileManualProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = useMemo(() => buildLayers(entries), [entries]);
  const isEmpty = layers.every((l) => l.entries.length === 0);
  const totalEntries = entries.length;
  const totalLabel = totalEntries === 1 ? "1 entry" : `${totalEntries} entries`;

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

      {/* Scroll fade overlay */}
      <div
        style={{
          position: "absolute",
          top: showTopBar ? 68 : 0,
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
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          position: "relative",
        }}
      >
        {/* Publication masthead — title + italic subtitle. The § ornament
            that used to sit here is gone; the layer tab pip below carries
            the next visual beat. Zero bottom padding so the layers
            container owns the masthead→first-Plate gap. */}
        <div style={{ padding: "var(--sp-lg) 20px 0" }}>
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
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--session-ink-soft)",
              margin: "8px 0 0",
              maxWidth: 300,
              letterSpacing: "0.005em",
              textWrap: "pretty" as React.CSSProperties["textWrap"],
            }}
          >
            A document about how you operate, in your own voice.
          </p>
        </div>

        {/* Layer list — Plates float in a flex column. Top padding
            gives the first Plate's tab pip room to protrude into
            without colliding with the masthead. Horizontal padding
            matches the masthead so Plate edges align with the title's
            optical left. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-lg)",
            padding: "var(--sp-md) 20px 40px",
          }}
        >
          {layers.map((layer) =>
            layer.entries.length > 0 ? (
              <PopulatedLayer
                key={layer.id}
                layer={layer}
                onExploreWithPersona={onExploreWithPersona}
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

        {/* Share invitation — only when at least one entry exists. § sits
            above as a quiet section break, echoing publication conventions. */}
        {!isEmpty && (
          <div style={{ padding: "var(--sp-lg) var(--sp-md) var(--sp-md)" }}>
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: "var(--sp-sm)",
                marginBottom: "var(--sp-md)",
              }}
            >
              <span style={{ height: 1, background: "var(--session-hair-soft)" }} />
              <span
                style={{
                  fontFamily: "var(--font-spectral), var(--font-serif), serif",
                  fontStyle: "italic",
                  color: "var(--session-walnut)",
                  fontSize: 17,
                  lineHeight: 1,
                  transform: "translateY(-1px)",
                }}
              >
                §
              </span>
              <span style={{ height: 1, background: "var(--session-hair-soft)" }} />
            </div>

            <h2
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 19,
                fontWeight: 500,
                color: "var(--session-ink)",
                margin: 0,
                letterSpacing: "-0.005em",
                lineHeight: 1.25,
              }}
            >
              Share how you operate<span style={{ color: "var(--session-walnut)", fontWeight: 500 }}>.</span>
            </h2>
            <p
              style={{
                fontFamily: "var(--font-spectral), var(--font-serif), serif",
                fontSize: 15,
                color: "var(--session-ink-soft)",
                lineHeight: 1.6,
                margin: "var(--sp-xs) 0 var(--sp-sm)",
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

    </main>
  );
}
