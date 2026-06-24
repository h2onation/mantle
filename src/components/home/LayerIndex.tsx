import type { ExplorationContext } from "@/lib/types";
import type { Layer } from "@/components/mobile/manual/layer-definitions";
import LayerIcon from "@/components/mobile/manual/LayerIcon";

// The 5-layer "go deeper" index, shared by MobileHome and DesktopHome. The
// row markup, the started/empty emblem tinting (navy = started, brown = empty),
// and the onExploreWithPersona payload live here ONCE. `variant` controls
// density only (sizes/padding/intro copy), never structure — both platforms
// produce the same rows and fire the same exploration context.

interface LayerIndexProps {
  layers: Layer[];
  startedCount: number;
  onExploreWithPersona: (context: ExplorationContext) => void;
  onNavigateToManual: () => void;
  variant?: "mobile" | "desktop";
}

const DENSITY = {
  mobile: {
    sectionMt: 28,
    radius: 16,
    cardPad: "18px 20px 20px",
    h2: 22,
    sub: 14,
    subCopy: "Five sections of how you operate. Tap one to go deeper with Jove.",
    pipW: 14,
    rowPad: "14px 0",
    emblem: 34,
    emblemR: 9,
    icon: 18,
    name: 16,
    tagline: 13,
  },
  desktop: {
    sectionMt: 34,
    radius: 14,
    cardPad: "20px 22px 22px",
    h2: 24,
    sub: 14.5,
    subCopy:
      "Five sections of how you operate. Open one to go deeper with Jove — or read the whole thing.",
    pipW: 16,
    rowPad: "15px 0",
    emblem: 38,
    emblemR: 10,
    icon: 20,
    name: 17,
    tagline: 13.5,
  },
} as const;

export default function LayerIndex({
  layers,
  startedCount,
  onExploreWithPersona,
  onNavigateToManual,
  variant = "mobile",
}: LayerIndexProps) {
  const d = DENSITY[variant];

  return (
    <section
      aria-label="Your manual"
      style={{
        marginTop: d.sectionMt,
        padding: d.cardPad,
        borderRadius: d.radius,
        background: "var(--session-cream-bright)",
        border: "1px solid var(--session-hair)",
        boxShadow: "var(--session-card-shadow, none)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display), var(--font-serif), serif",
              fontSize: d.h2,
              fontWeight: 400,
              letterSpacing: "-0.3px",
              color: "var(--session-ink)",
            }}
          >
            Your manual
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontFamily: "var(--font-serif), serif",
              fontSize: d.sub,
              lineHeight: 1.4,
              color: "var(--session-ink-mid)",
            }}
          >
            {d.subCopy}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right", paddingTop: 4 }}>
          <div
            style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}
            aria-hidden="true"
          >
            {layers.map((l) => (
              <span
                key={l.id}
                style={{
                  width: d.pipW,
                  height: 4,
                  borderRadius: 2,
                  background:
                    l.entries.length > 0
                      ? "var(--session-walnut)"
                      : "var(--session-hair)",
                }}
              />
            ))}
          </div>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--session-ink-faded)",
              whiteSpace: "nowrap",
            }}
          >
            {startedCount} of 5 started
          </p>
        </div>
      </div>

      <div role="list" style={{ marginTop: 14 }}>
        {layers.map((layer, i) => {
          const count = layer.entries.length;
          const isLast = i === layers.length - 1;
          const cue = count > 0 ? "Go deeper" : "Start";
          const countLabel =
            count > 0
              ? `${count} ${count === 1 ? "entry" : "entries"}`
              : "No entries";
          return (
            <button
              key={layer.id}
              role="listitem"
              onClick={() =>
                onExploreWithPersona({
                  layerId: layer.id,
                  layerName: layer.name,
                  type: count > 0 ? "started_layer" : "empty_layer",
                  content: layer.about,
                })
              }
              aria-label={`${layer.name}, ${countLabel} — ${cue.toLowerCase()} with Jove`}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                boxSizing: "border-box",
                padding: d.rowPad,
                borderBottom: isLast
                  ? "none"
                  : "1px solid var(--session-hair-soft)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: d.emblem,
                  height: d.emblem,
                  borderRadius: d.emblemR,
                  display: "grid",
                  placeItems: "center",
                  background:
                    count > 0
                      ? "var(--session-persona-tint)"
                      : "var(--session-walnut-tint)",
                  color:
                    count > 0
                      ? "var(--session-persona)"
                      : "var(--session-walnut)",
                }}
              >
                <LayerIcon layerId={layer.id} size={d.icon} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-serif), serif",
                    fontSize: d.name,
                    color: "var(--session-ink)",
                    lineHeight: 1.25,
                  }}
                >
                  {layer.name}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-serif), serif",
                    fontSize: d.tagline,
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.35,
                  }}
                >
                  {layer.tagline}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "1.4px",
                    textTransform: "uppercase",
                    color:
                      count > 0
                        ? "var(--session-ink-faded)"
                        : "var(--session-ink-ghost)",
                  }}
                >
                  {countLabel}
                </span>
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--session-walnut)",
                }}
              >
                {cue} →
              </span>
            </button>
          );
        })}
      </div>

      {startedCount > 0 && (
        <button
          onClick={onNavigateToManual}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Read your manual <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
