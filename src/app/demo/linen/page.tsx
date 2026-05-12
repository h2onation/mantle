"use client";

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-page-custom-font */

// Linen — light-mode exploration.
//
// Goal: a daytime version of the dark walnut+slate mockups that feels the same
// — warm, paper-like, calm, anchored by walnut — but readable in bright light.
// Not "white mode" — linen. The ground is a warm cream that lets walnut sit on
// it without fighting. Multi-layer radial gradients carry the same emotional
// shape as the dark surfaces; opacity values are inverted (light pools, not
// dark pools), but the position math is the same so the two modes "feel"
// related when you flip between them.
//
// 4 mockups: Welcome, Chat, Checkpoint, Manual.

import React from "react";

// -----------------------------------------------------------------------------
// Tokens
// -----------------------------------------------------------------------------
const C = {
  // Page ground (the area around the phone frames) — deeper linen-fabric
  page: "#C7B89A",

  // Surface ground (inside the phone frame, before gradients) —
  // medium linen, NOT cream-white. This is the canvas. Cream highlights
  // need somewhere to lift FROM, so the ground has to be deeper than the
  // highlights or the gradient disappears.
  surface: "#E5D8BE",

  // Walnut family — true walnut wood color. The previous #73482A read
  // orange-saddle; this is the cooler, deeper hue that lives in cabinetry
  // and leather books. Same hue stays consistent across opacities.
  walnut: "#5C3A1E", // primary — true walnut, the brand spine
  walnutDeep: "#3D2410", // espresso — for highest contrast accents
  walnutSoft: "rgba(92, 58, 30, 0.55)",
  walnutFaint: "rgba(92, 58, 30, 0.18)",
  walnutHair: "rgba(92, 58, 30, 0.28)",
  walnutHairSoft: "rgba(92, 58, 30, 0.14)",
  walnutTint: "rgba(92, 58, 30, 0.08)",

  // Ink — text colors. All AAA against #E5D8BE.
  ink: "#1F140A", // primary — near-black walnut, premium contrast
  inkSoft: "#4A3220", // secondary — medium dark walnut
  inkFaded: "#7A5E40", // tertiary — light walnut-gray
  inkMono: "#5C3F23", // mono caps eyebrows — deeper, more present

  // Bubble + plate paper colors are CSS variables so the three variant
  // rows below (V1 tonal, V2 parchment, V3 embossed) can each set their
  // own paper treatment without touching component code.
  bubbleJove: "var(--paper-bubble, rgba(245, 235, 213, 0.94))",
  bubbleUser: "rgba(92, 58, 30, 0.16)", // walnut wash, visible warmth

  // Plate (checkpoint card) — variable so versions can tune separately
  plate: "var(--paper-plate, rgba(249, 240, 220, 0.95))",
  plateBorder: "var(--paper-border, rgba(92, 58, 30, 0.22))",

  // Composer pill — slightly recessed into the surface
  composer: "rgba(92, 58, 30, 0.07)",
  composerBorder: "rgba(92, 58, 30, 0.26)",

  // Oxblood — crisis-only accent (preserved across themes)
  oxblood: "#7A2E2E",

  // Per-surface multi-layer radial gradients.
  //
  // The math is the same as the dark mode (three layers: dominant wash,
  // secondary pool, walnut corner glow), but the opacities are tuned so
  // each layer creates real contrast against the deeper linen ground.
  // Layer roles in light mode:
  //   layer 1: cream/paper highlight (LIGHTER than ground — top wash)
  //   layer 2: caramel pool (saturated mid-tone — warm interior)
  //   layer 3: deep walnut corner (DARKER than ground — anchor shadow)
  //
  // With a deeper ground, the cream wash actually shows as a highlight
  // and the walnut corner shows as a shadow. Previously both were the
  // same tone as the ground, so the gradient was invisible.

  bgWelcome:
    "radial-gradient(ellipse 110% 55% at 30% 18%, rgba(255,248,228,0.85), transparent 60%), " +
    "radial-gradient(ellipse 75% 50% at 100% 88%, rgba(92,58,30,0.34), transparent 65%), " +
    "radial-gradient(ellipse 70% 50% at 0% 100%, rgba(212,176,128,0.62), transparent 60%)",

  bgChat:
    "radial-gradient(ellipse 130% 60% at 35% 15%, rgba(255,248,232,0.85), transparent 65%), " +
    "radial-gradient(ellipse 90% 55% at 50% 95%, rgba(212,176,128,0.58), transparent 70%), " +
    "radial-gradient(ellipse 65% 45% at 100% 105%, rgba(92,58,30,0.38), transparent 60%)",

  bgCheckpoint:
    "radial-gradient(ellipse 120% 60% at 50% 25%, rgba(255,250,232,0.85), transparent 65%), " +
    "radial-gradient(ellipse 95% 55% at 35% 100%, rgba(208,168,118,0.60), transparent 70%), " +
    "radial-gradient(ellipse 70% 50% at 100% 0%, rgba(92,58,30,0.34), transparent 60%)",

  bgManual:
    "radial-gradient(ellipse 130% 60% at 50% 10%, rgba(255,250,232,0.78), transparent 60%), " +
    "radial-gradient(ellipse 100% 55% at 50% 100%, rgba(208,168,118,0.48), transparent 70%), " +
    "radial-gradient(ellipse 60% 45% at 0% 90%, rgba(92,58,30,0.28), transparent 60%)",
};

const FONT = "'Spectral', Georgia, serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// Phone frame dimensions — matches the dark demo so the two can be compared
// at 1:1 zoom.
const PHONE = { width: 410, height: 840 };

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

function PhoneFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 12px",
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMono,
        }}
      >
        {label}
      </p>
      <div
        style={{
          width: PHONE.width,
          height: PHONE.height,
          borderRadius: 36,
          overflow: "hidden",
          background: C.surface,
          boxShadow:
            "0 24px 60px rgba(92,58,30,0.18), 0 4px 12px rgba(92,58,30,0.08)",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TopBar({
  showWordmark = true,
  showMenu = true,
}: {
  showWordmark?: boolean;
  showMenu?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background:
          "color-mix(in srgb, " + C.surface + " 70%, transparent)",
        backdropFilter: "blur(16px) saturate(120%)",
        WebkitBackdropFilter: "blur(16px) saturate(120%)",
        borderBottom: "1px solid " + C.walnutHairSoft,
        zIndex: 50,
      }}
    >
      {/* menu */}
      <button
        aria-label="Open menu"
        style={{
          width: 28,
          height: 28,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.ink,
          visibility: showMenu ? "visible" : "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 12,
            borderTop: "1.5px solid " + C.ink,
            borderBottom: "1.5px solid " + C.ink,
          }}
        />
      </button>

      {/* wordmark */}
      {showWordmark && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 17,
            fontWeight: 500,
            color: C.ink,
            letterSpacing: "-0.01em",
          }}
        >
          mywalnut<span style={{ color: C.walnut }}>.</span>
        </div>
      )}

      {/* placeholder right action */}
      <div style={{ width: 28 }} />
    </div>
  );
}

function Bubble({
  side,
  label,
  children,
}: {
  side: "jove" | "user";
  label?: boolean;
  children: React.ReactNode;
}) {
  const isJove = side === "jove";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isJove ? "flex-start" : "flex-end",
        marginBottom: 14,
      }}
    >
      {label && isJove && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkMono,
            marginBottom: 6,
            marginLeft: 4,
          }}
        >
          Jove
        </span>
      )}
      <div
        style={{
          maxWidth: isJove ? "92%" : "88%",
          padding: "13px 17px",
          background: isJove ? C.bubbleJove : C.bubbleUser,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          // Border + shadow on the Jove paper bubble both read from CSS
          // variables so each version row tunes its paper treatment.
          // User walnut-wash bubble already contrasts via warmth, so it
          // keeps its hair-weight border across all versions.
          border:
            "1px solid " +
            (isJove ? "var(--paper-border, rgba(92,58,30,0.22))" : C.walnutHair),
          borderRadius: isJove ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
          fontFamily: FONT,
          fontSize: 17,
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
          color: C.ink,
          boxShadow: isJove
            ? "var(--paper-shadow, 0 4px 14px rgba(31,20,10,0.07), 0 1px 2px rgba(31,20,10,0.06))"
            : "0 2px 8px rgba(31,20,10,0.05)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PillComposer({
  placeholder = "share a thought…",
}: {
  placeholder?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 20,
        height: 52,
        background: C.composer,
        backdropFilter: "blur(12px) saturate(120%)",
        WebkitBackdropFilter: "blur(12px) saturate(120%)",
        border: "1px solid " + C.composerBorder,
        borderRadius: 26,
        display: "flex",
        alignItems: "center",
        padding: "0 6px 0 20px",
        boxShadow:
          "0 8px 20px rgba(92,58,30,0.08), 0 1px 0 rgba(255,250,240,0.6) inset",
      }}
    >
      <span
        style={{
          flex: 1,
          fontFamily: FONT,
          fontSize: 16,
          fontStyle: "italic",
          color: C.inkFaded,
          letterSpacing: "-0.005em",
        }}
      >
        {placeholder}
      </span>
      <button
        aria-label="Voice"
        style={{
          width: 40,
          height: 40,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: C.inkSoft,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 2,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect
            x="9"
            y="3"
            width="6"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        aria-label="Send"
        style={{
          width: 40,
          height: 40,
          background: C.walnut,
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          color: "#F5EDDC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
          fontSize: 18,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12h14m0 0-6-6m6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function PeriodMark({ size = 1 }: { size?: number }) {
  return <span style={{ color: C.walnut, fontSize: `${size}em` }}>.</span>;
}

function TextBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      style={{
        background: C.walnut,
        color: "#F5EDDC",
        border: "none",
        padding: "14px 28px",
        borderRadius: 32,
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 6px 16px rgba(92,58,30,0.20)",
      }}
    >
      {children}
      <span style={{ fontSize: 14, lineHeight: 1 }}>›</span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Surface 01 — Welcome
// -----------------------------------------------------------------------------

function WelcomeSurface() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: C.bgWelcome,
        backgroundColor: C.surface,
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
      }}
    >
      {/* eyebrow */}
      <p
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMono,
          margin: "0 0 28px",
        }}
      >
        A private manual
      </p>

      {/* wordmark */}
      <h1
        style={{
          fontFamily: FONT,
          fontSize: 64,
          fontWeight: 400,
          color: C.ink,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          margin: "0 0 24px",
        }}
      >
        mywalnut<PeriodMark />
      </h1>

      {/* thesis */}
      <p
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontStyle: "italic",
          fontWeight: 400,
          color: C.inkSoft,
          lineHeight: 1.5,
          letterSpacing: "-0.01em",
          textAlign: "center",
          maxWidth: 280,
          margin: "0 0 48px",
        }}
      >
        A space to understand yourself,<br />on your own terms.
      </p>

      {/* CTA */}
      <TextBtn>Begin</TextBtn>

      {/* sign in */}
      <p
        style={{
          fontFamily: FONT,
          fontSize: 14,
          fontStyle: "italic",
          color: C.inkSoft,
          margin: "28px 0 0",
        }}
      >
        Already have access?{" "}
        <span
          style={{
            color: C.walnut,
            textDecoration: "underline",
            textDecorationThickness: "1px",
            textUnderlineOffset: "3px",
          }}
        >
          Sign in
        </span>
      </p>

      {/* footer */}
      <p
        style={{
          position: "absolute",
          bottom: 28,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkFaded,
          margin: 0,
        }}
      >
        Privacy · Terms
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Surface 02 — Chat
// -----------------------------------------------------------------------------

function ChatSurface() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: C.bgChat,
        backgroundColor: C.surface,
        backgroundRepeat: "no-repeat",
      }}
    >
      <TopBar />

      {/* scroll area */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          bottom: 92,
          overflow: "hidden",
          padding: "20px 16px 8px",
        }}
      >
        <Bubble side="jove" label>
          Hi. I'm Jove.
        </Bubble>

        <Bubble side="jove">
          I'm here to help you understand how you work — not in clinical
          terms, but in your own words.
        </Bubble>

        <Bubble side="jove">
          Tell me about something you're navigating right now. Could be small.
          Could be huge.
        </Bubble>

        <Bubble side="user">
          I've been spinning out about a conversation I had with my boss
          yesterday. He gave me feedback that I think was good but I can't
          stop replaying it.
        </Bubble>

        <Bubble side="jove" label>
          What does the replay sound like? Is it the same line repeating, or
          are you turning the whole thing over from different angles?
        </Bubble>
      </div>

      <PillComposer />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Surface 03 — Checkpoint
// -----------------------------------------------------------------------------

function CheckpointSurface() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: C.bgCheckpoint,
        backgroundColor: C.surface,
        backgroundRepeat: "no-repeat",
      }}
    >
      <TopBar />

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          bottom: 92,
          overflow: "hidden",
          padding: "20px 16px 8px",
        }}
      >
        <Bubble side="jove" label>
          I want to check something with you.
        </Bubble>

        {/* checkpoint plate */}
        <div
          style={{
            marginTop: 20,
            background: C.plate,
            backdropFilter: "blur(20px) saturate(130%)",
            WebkitBackdropFilter: "blur(20px) saturate(130%)",
            border: "1px solid " + C.plateBorder,
            borderRadius: 18,
            padding: "22px 22px 20px",
            boxShadow:
              "var(--plate-shadow, 0 18px 48px rgba(31,20,10,0.14), 0 4px 12px rgba(31,20,10,0.08), 0 1px 0 rgba(255,253,247,0.6) inset)",
          }}
        >
          {/* eyebrow */}
          <p
            style={{
              margin: "0 0 12px",
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.inkMono,
            }}
          >
            Proposed entry
          </p>

          {/* heading */}
          <h2
            style={{
              margin: "0 0 16px",
              fontFamily: FONT,
              fontSize: 24,
              fontWeight: 400,
              color: C.ink,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
            }}
          >
            Layer 2 — Operating mode<PeriodMark />
          </h2>

          {/* body */}
          <p
            style={{
              margin: "0 0 22px",
              fontFamily: FONT,
              fontSize: 16.5,
              fontWeight: 400,
              color: C.ink,
              lineHeight: 1.62,
              letterSpacing: "-0.005em",
            }}
          >
            You think in cycles. When something matters, you don't process it
            once and move on — you turn it over, look at it from different
            angles, and keep returning to it until the shape resolves. Other
            people sometimes read this as overthinking. You experience it as
            how thinking works<PeriodMark />
          </p>

          {/* actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <TextBtn>Add to manual</TextBtn>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 14,
                fontStyle: "italic",
                color: C.inkSoft,
                textDecoration: "underline",
                textDecorationThickness: "1px",
                textUnderlineOffset: "3px",
              }}
            >
              Not yet
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Surface 04 — Manual
// -----------------------------------------------------------------------------

function LayerCard({
  num,
  title,
  count,
  expanded = false,
  faded = false,
  entries,
}: {
  num: number;
  title: string;
  count: number;
  expanded?: boolean;
  faded?: boolean;
  entries?: { headline: string; preview: string }[];
}) {
  return (
    <div
      style={{
        background: C.bubbleJove,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border:
          "1px solid var(--paper-border-soft, rgba(92,58,30,0.18))",
        borderRadius: 14,
        padding: expanded ? "18px 18px 6px" : "18px",
        marginBottom: 12,
        opacity: faded ? 0.55 : 1,
        boxShadow:
          "var(--card-shadow, 0 2px 8px rgba(31,20,10,0.05), 0 1px 2px rgba(31,20,10,0.04))",
      }}
    >
      {/* row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: "0 0 4px",
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.inkMono,
            }}
          >
            Layer {num}
          </p>
          <h3
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: 19,
              fontWeight: 400,
              color: C.ink,
              letterSpacing: "-0.012em",
              lineHeight: 1.25,
            }}
          >
            {title}<PeriodMark />
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: C.inkFaded,
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span>
            {count} {count === 1 ? "entry" : "entries"}
          </span>
          <span style={{ fontSize: 12 }}>{expanded ? "˅" : "›"}</span>
        </div>
      </div>

      {/* expanded entries */}
      {expanded && entries && (
        <div
          style={{
            marginTop: 16,
            borderTop: "1px solid " + C.walnutHairSoft,
            paddingTop: 14,
          }}
        >
          {entries.map((e, i) => (
            <div
              key={i}
              style={{
                paddingBottom: 14,
                marginBottom: 14,
                borderBottom:
                  i < entries.length - 1
                    ? "1px solid " + C.walnutHairSoft
                    : "none",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontFamily: FONT,
                  fontSize: 15.5,
                  fontWeight: 500,
                  color: C.ink,
                  letterSpacing: "-0.005em",
                }}
              >
                {e.headline}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: FONT,
                  fontSize: 14,
                  color: C.inkSoft,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                {e.preview}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualSurface() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: C.bgManual,
        backgroundColor: C.surface,
        backgroundRepeat: "no-repeat",
      }}
    >
      <TopBar />

      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          padding: "24px 20px 24px",
        }}
      >
        {/* header */}
        <p
          style={{
            margin: "0 0 8px",
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkMono,
          }}
        >
          Your manual
        </p>
        <h1
          style={{
            margin: "0 0 8px",
            fontFamily: FONT,
            fontSize: 32,
            fontWeight: 400,
            color: C.ink,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Read me<PeriodMark />
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkFaded,
          }}
        >
          7 entries · last updated 2 weeks ago
        </p>

        {/* layers */}
        <LayerCard num={1} title="Operating context" count={2} />
        <LayerCard
          num={2}
          title="Operating mode"
          count={3}
          expanded
          entries={[
            {
              headline: "You think in cycles.",
              preview:
                "When something matters, you turn it over until the shape resolves.",
            },
            {
              headline: "You speak more carefully when stakes are high.",
              preview:
                "Pace slows, sentences get more precise, fewer hedges.",
            },
            {
              headline: "You need quiet before clarity.",
              preview:
                "Decisions surface in the gap, not in the conversation.",
            },
          ]}
        />
        <LayerCard num={3} title="Patterns" count={1} />
        <LayerCard num={4} title="Tensions" count={1} />
        <LayerCard num={5} title="Direction" count={0} faded />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Paper-treatment variants
// -----------------------------------------------------------------------------
//
// Each variant overrides the CSS custom properties below on its section
// wrapper. The surface components read these properties (with the V1
// values as the C-token fallback), so each row renders with its own
// paper treatment without any component refactor.
//
//   --paper-bubble        Jove bubble fill
//   --paper-plate         Checkpoint plate fill
//   --paper-border        Border on Jove bubble + plate (visible edge)
//   --paper-border-soft   Border on Manual layer cards (gentler edge)
//   --paper-shadow        Jove bubble elevation shadow
//   --plate-shadow        Checkpoint plate elevation shadow
//   --card-shadow         Manual layer card elevation shadow

const V1_TONAL = {
  // Tonal cream — paper one tonal step lighter than the linen ground,
  // same hue family. Resolves to roughly #F1E5D1 over the #E5D8BE
  // ground. The bubbles feel folded into the linen rather than laid
  // on top. Most cohesive of the three.
  ["--paper-bubble"]: "rgba(245, 235, 213, 0.94)",
  ["--paper-plate"]: "rgba(249, 240, 220, 0.95)",
  ["--paper-border"]: "rgba(92, 58, 30, 0.22)",
  ["--paper-border-soft"]: "rgba(92, 58, 30, 0.16)",
  ["--paper-shadow"]:
    "0 4px 14px rgba(31, 20, 10, 0.06), 0 1px 2px rgba(31, 20, 10, 0.05)",
  ["--plate-shadow"]:
    "0 16px 42px rgba(31, 20, 10, 0.10), 0 4px 10px rgba(31, 20, 10, 0.06), 0 1px 0 rgba(252, 244, 224, 0.5) inset",
  ["--card-shadow"]:
    "0 2px 6px rgba(31, 20, 10, 0.04), 0 1px 2px rgba(31, 20, 10, 0.04)",
} as React.CSSProperties;

const V2_PARCHMENT = {
  // Aged parchment — more yellow saturation, vellum feel. Borders push
  // deeper because the fill is more differentiated. Shadows tinted
  // amber rather than espresso to keep the warm-paper register.
  ["--paper-bubble"]: "rgba(238, 220, 188, 0.95)",
  ["--paper-plate"]: "rgba(243, 226, 196, 0.96)",
  ["--paper-border"]: "rgba(92, 58, 30, 0.28)",
  ["--paper-border-soft"]: "rgba(92, 58, 30, 0.20)",
  ["--paper-shadow"]:
    "0 5px 16px rgba(60, 38, 18, 0.08), 0 1px 3px rgba(60, 38, 18, 0.07)",
  ["--plate-shadow"]:
    "0 18px 46px rgba(60, 38, 18, 0.12), 0 4px 12px rgba(60, 38, 18, 0.08), 0 1px 0 rgba(248, 234, 208, 0.5) inset",
  ["--card-shadow"]:
    "0 3px 8px rgba(60, 38, 18, 0.06), 0 1px 2px rgba(60, 38, 18, 0.05)",
} as React.CSSProperties;

const V3_EMBOSSED = {
  // Embossed linen — paper only barely lighter than the ground. Lift
  // comes from shadow + border, not fill contrast. Most subtle, most
  // premium, requires the cleanest typography to read well.
  ["--paper-bubble"]: "rgba(232, 220, 196, 0.90)",
  ["--paper-plate"]: "rgba(236, 224, 200, 0.93)",
  ["--paper-border"]: "rgba(92, 58, 30, 0.32)",
  ["--paper-border-soft"]: "rgba(92, 58, 30, 0.22)",
  ["--paper-shadow"]:
    "0 8px 24px rgba(31, 20, 10, 0.12), 0 2px 5px rgba(31, 20, 10, 0.10)",
  ["--plate-shadow"]:
    "0 22px 56px rgba(31, 20, 10, 0.16), 0 6px 14px rgba(31, 20, 10, 0.10), 0 1px 0 rgba(245, 235, 215, 0.4) inset",
  ["--card-shadow"]:
    "0 5px 14px rgba(31, 20, 10, 0.08), 0 1px 3px rgba(31, 20, 10, 0.06)",
} as React.CSSProperties;

function VersionSection({
  num,
  name,
  desc,
  vars,
}: {
  num: string;
  name: string;
  desc: string;
  vars: React.CSSProperties;
}) {
  return (
    <section
      style={{
        ...vars,
        marginBottom: 64,
      }}
    >
      <div
        style={{
          maxWidth: PHONE.width * 2 + 48,
          margin: "0 auto 28px",
          paddingTop: 28,
          borderTop: "1px solid " + C.walnutHair,
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkMono,
          }}
        >
          Version {num}
        </p>
        <h2
          style={{
            margin: "0 0 12px",
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 400,
            color: C.ink,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {name}
          <PeriodMark />
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: FONT,
            fontSize: 16,
            fontStyle: "italic",
            color: C.inkSoft,
            lineHeight: 1.55,
            letterSpacing: "-0.005em",
            maxWidth: 560,
          }}
        >
          {desc}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(2, ${PHONE.width}px)`,
          columnGap: 48,
          rowGap: 56,
          justifyContent: "center",
        }}
      >
        <PhoneFrame label="01 — Welcome">
          <WelcomeSurface />
        </PhoneFrame>
        <PhoneFrame label="02 — Chat">
          <ChatSurface />
        </PhoneFrame>
        <PhoneFrame label="03 — Checkpoint">
          <CheckpointSurface />
        </PhoneFrame>
        <PhoneFrame label="04 — Manual">
          <ManualSurface />
        </PhoneFrame>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function LinenDemoPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div
        className="scrollable-page"
        style={{
          minHeight: "100vh",
          background: C.page,
          padding: "48px 32px 64px",
        }}
      >
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          {/* page header */}
          <header style={{ marginBottom: 48, maxWidth: 720 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.inkMono,
              }}
            >
              Paper treatment — three variants
            </p>
            <h1
              style={{
                margin: "0 0 18px",
                fontFamily: FONT,
                fontSize: 44,
                fontWeight: 400,
                color: C.ink,
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
              }}
            >
              linen + walnut<PeriodMark />
            </h1>
            <p
              style={{
                margin: 0,
                fontFamily: FONT,
                fontSize: 18,
                fontStyle: "italic",
                color: C.inkSoft,
                lineHeight: 1.55,
                letterSpacing: "-0.005em",
              }}
            >
              The previous paper-white surfaces read as foreign objects on
              the linen ground. These three pull the paper into the warm
              family at different intensities, so Jove&apos;s bubbles and the
              checkpoint plate feel native to the surface they sit on
              <PeriodMark />
            </p>
          </header>

          <VersionSection
            num="01"
            name="Tonal cream"
            desc="Paper a tonal step lighter than the linen ground, same hue family. The bubbles read as softer-linen, folded into the surface rather than laid on it. Most cohesive."
            vars={V1_TONAL}
          />

          <VersionSection
            num="02"
            name="Aged parchment"
            desc="More yellow saturation — vellum, an old letter, a journal that's been read. Borders push deeper to anchor the warmth. Most distinctive personality."
            vars={V2_PARCHMENT}
          />

          <VersionSection
            num="03"
            name="Embossed linen"
            desc="Paper barely lighter than the ground. The lift comes from shadow and border, not from fill contrast. Most subtle, most premium — Apple-bookish."
            vars={V3_EMBOSSED}
          />

          {/* footer notes */}
          <div
            style={{
              maxWidth: 720,
              margin: "32px auto 0",
              borderTop: "1px solid " + C.walnutHair,
              paddingTop: 28,
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.inkMono,
              }}
            >
              What changes between versions
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                fontFamily: FONT,
                fontSize: 15.5,
                color: C.inkSoft,
                lineHeight: 1.65,
              }}
            >
              <li>
                <strong style={{ color: C.ink }}>Fill tone</strong> — V1
                cream / V2 yellow-saturated / V3 nearly-ground. All three
                are warmer than the previous near-white, so the paper feels
                part of the linen family rather than a foreign object.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Border weight</strong> —
                inversely scales with fill differentiation: V3 needs the
                strongest border (0.32) because its fill barely differs;
                V1 sits at hair-weight (0.22) since the fill carries more
                of the lift.
              </li>
              <li>
                <strong style={{ color: C.ink }}>Shadow strategy</strong>{" "}
                — V1 is the lightest touch (paper barely above linen), V2
                tints shadows amber for the parchment warmth, V3 leans on
                shadow heavily since the fill alone doesn't differentiate.
              </li>
              <li>
                <strong style={{ color: C.ink }}>What stays constant</strong>{" "}
                — linen ground, gradient logic, walnut spine, ink
                hierarchy, user-bubble walnut wash. The decision is only
                about how Jove's paper surfaces sit on the linen.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
