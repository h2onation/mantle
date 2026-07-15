import { notFound } from "next/navigation";
import Jove from "@/components/jove/Jove";
import AppearanceToggle from "@/components/shared/AppearanceToggle";

const SIZES = [32, 48, 72, 120, 180] as const;

function SceneStudy() {
  return (
    <section aria-label="Neutral stand size study" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(24px, 3vw, 30px)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          Neutral · stand
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--size-body)",
            color: "var(--session-ink-faded)",
          }}
        >
          The approved baseline for proportion and line weight.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))",
          gap: 12,
          color: "var(--session-persona)",
        }}
      >
        {SIZES.map((size) => (
          <figure
            key={size}
            style={{
              minHeight: 248,
              margin: 0,
              padding: "20px 16px 16px",
              display: "grid",
              gridTemplateRows: "1fr auto",
              justifyItems: "center",
              alignItems: "center",
              gap: 16,
              overflow: "hidden",
              background: "var(--session-cream)",
              border: "1px solid var(--session-hair)",
              borderRadius: "var(--session-card-radius)",
              boxShadow: "var(--session-card-shadow)",
            }}
          >
            <Jove size={size} />
            <figcaption
              style={{
                width: "100%",
                paddingTop: 12,
                borderTop: "1px solid var(--session-hair-soft)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                letterSpacing: "0.12em",
                textAlign: "center",
                textTransform: "uppercase",
                color: "var(--session-ink-faded)",
              }}
            >
              {size}px
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function JoveGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      style={{
        height: "100vh",
        overflowY: "auto",
        padding: "clamp(24px, 5vw, 64px)",
        background: "var(--session-linen)",
        color: "var(--session-ink)",
      }}
    >
      <div
        style={{
          width: "min(100%, 1040px)",
          margin: "0 auto",
          display: "grid",
          gap: "clamp(28px, 5vw, 52px)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--session-ink-faded)",
              }}
            >
              Character study · 01
            </p>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              Jove · neutral stand.
            </h1>
            <p
              style={{
                maxWidth: 560,
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--size-body)",
                lineHeight: 1.55,
                color: "var(--session-ink-faded)",
              }}
            >
              The production SVG rendered at every required size for anatomy,
              line weight, clipping, and small-size legibility.
            </p>
          </div>

          <div style={{ width: "min(100%, 280px)" }}>
            <AppearanceToggle />
          </div>
        </header>

        <SceneStudy />
      </div>
    </main>
  );
}
