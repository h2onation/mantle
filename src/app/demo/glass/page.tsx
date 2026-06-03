"use client";

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-page-custom-font */

/**
 * mywalnut · slate + walnut · five canonical screens.
 *
 * Reflects every direction we've agreed on:
 * — Slate + walnut palette (cool graphite ground; walnut as the
 *   warm accent — period, framed plate, drop cap, gradient corner).
 * — Persistent `mywalnut.` masthead across every screen.
 * — Bubble chat with side-anchored speaker indents and asymmetric
 *   corners (Jove left at 92%, user right at 88%).
 * — Walnut-framed Checkpoint plate.
 * — Manual as a single expanding-cards document. No nested cards,
 *   no Layer detail page — the Manual is one scrollable artifact.
 * — Dark mode only.
 * — No tab bar.
 *
 * Five moments:
 * 1. Welcome    — entry hero
 * 2. Voice      — orb listening
 * 3. Chat       — long-text bubbles, side-anchored
 * 4. Checkpoint — proposed Manual entry, framed walnut plate
 * 5. Manual     — section headers as typography, expanding entry cards
 */

import React from "react";

// ─── Palette ───────────────────────────────────────────────────────
const C = {
  ground: "#0A0B10",
  walnut: "rgb(170,120,82)",
  walnutLight: "rgba(170,120,82,0.55)",
  walnutSurface: "rgba(115,72,42,0.20)",
  walnutSurfaceSoft: "rgba(115,72,42,0.10)",
  walnutBorder: "rgba(170,120,82,0.18)",
  walnutBorderSoft: "rgba(170,120,82,0.14)",
  sage: "rgba(156,177,138,0.92)",
  hero: "rgba(245,243,238,0.97)",
  body: "rgba(228,224,214,0.62)",
  bodyDim: "rgba(228,224,214,0.45)",
  meta: "rgba(170,120,82,0.65)",
  bgWelcome:
    "radial-gradient(ellipse 120% 70% at 30% 25%, rgba(60,68,82,0.92), transparent 65%), " +
    "radial-gradient(ellipse 100% 70% at 60% 100%, rgba(36,42,55,0.85), transparent 70%), " +
    "radial-gradient(ellipse 75% 55% at 100% 100%, rgba(115,72,42,0.65), transparent 60%), " +
    "radial-gradient(ellipse 80% 50% at 20% 50%, rgba(15,18,26,0.35), transparent 70%)",
  bgVoice:
    "radial-gradient(ellipse 120% 75% at 30% 30%, rgba(50,58,72,0.85), transparent 65%), " +
    "radial-gradient(ellipse 90% 65% at 80% 100%, rgba(115,72,42,0.50), transparent 65%), " +
    "radial-gradient(ellipse 50% 40% at 50% 55%, rgba(8,10,16,0.65), transparent 70%)",
  bgChat:
    "radial-gradient(ellipse 130% 60% at 35% 15%, rgba(54,62,76,0.85), transparent 65%), " +
    "radial-gradient(ellipse 90% 55% at 50% 95%, rgba(36,42,55,0.55), transparent 70%), " +
    "radial-gradient(ellipse 65% 45% at 100% 105%, rgba(115,72,42,0.55), transparent 60%)",
  bgCheckpoint:
    "radial-gradient(ellipse 110% 75% at 50% 25%, rgba(115,72,42,0.42), transparent 65%), " +
    "radial-gradient(ellipse 100% 60% at 50% 100%, rgba(48,54,68,0.85), transparent 70%), " +
    "radial-gradient(ellipse 55% 40% at 0% 100%, rgba(85,55,30,0.40), transparent 65%), " +
    "radial-gradient(ellipse 80% 50% at 100% 0%, rgba(36,42,55,0.50), transparent 70%)",
  bgManual:
    "radial-gradient(ellipse 140% 80% at 40% 10%, rgba(115,72,42,0.50), transparent 70%), " +
    "radial-gradient(ellipse 90% 50% at 50% 100%, rgba(40,46,60,0.85), transparent 70%), " +
    "radial-gradient(ellipse 60% 50% at 100% 100%, rgba(60,68,82,0.65), transparent 60%)",
};

// ─── Page ───────────────────────────────────────────────────────────
export default function GlassDemoPage() {
  return (
    <>
      {/* Google Fonts for the chat-font comparison.
          Loaded inline so the demo can render five real serifs side
          by side without next/font ceremony. Production would use
          next/font for proper SSR / preloading. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500&family=Lora:wght@400;500&family=Fraunces:wght@400;500&family=Crimson+Pro:wght@400;500&family=Literata:wght@400;500&family=Spectral:wght@400;500&display=swap"
      />
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        background: "#04050A",
        color: "white",
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      <div style={{ padding: "40px 32px 60px", minWidth: 2270 }}>
        <header style={{ maxWidth: 2210, margin: "0 auto 32px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: C.meta,
              fontFamily: '"DM Mono", monospace',
            }}
          >
            mywalnut · canonical · five screens
          </p>
          <h1
            style={{
              margin: "10px 0 0",
              fontSize: 48,
              fontWeight: 300,
              letterSpacing: -1.2,
              color: C.hero,
            }}
          >
            One product, five moments<span style={{ color: C.walnut }}>.</span>
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 760,
              fontSize: 15,
              lineHeight: 1.55,
              color: C.body,
            }}
          >
            Slate + walnut. Persistent <code style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, color: C.walnut, padding: "0 4px" }}>mywalnut.</code>
            masthead on every screen. Bubble chat with side-anchored speakers — both speakers
            in <strong style={{ color: C.hero, fontWeight: 500 }}>Spectral</strong> (the
            canonical pick). Manual as a single expanding-card document — no Layer detail
            page. Dark mode only. No tab bar.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 28,
            maxWidth: 2210,
            margin: "0 auto",
            paddingBottom: 24,
          }}
        >
          <Frame label="1 · Welcome" description="Entry hero. 64px display headline; walnut period as the brand seal. Three input methods as a vertical card stack — Navigate a situation, Guided intake, Upload. Layer 1 of the system per intent.md.">
            <Welcome />
          </Frame>
          <Frame label="2 · Chat" description="Bubble pattern. Jove anchors LEFT at 92% with a sage 'Jove' tag; user anchors RIGHT at 88% — italic + slate tint + asymmetric corner identify the user (no tag needed). 17px / 1.62 line-height.">
            <Chat />
          </Frame>
          <Frame label="3 · Checkpoint" description="The product's critical moment. Jove proposes a Manual entry. Reading-first: 17px body at 1.65 line-height, 24px heading, paragraph break at the natural rhythm, plate tint dialed back so text contrast holds. No italic body, no hairline divider — whitespace handles every transition.">
            <Checkpoint />
          </Frame>
          <Frame label="4 · Manual" description="Single expanding-card document. Section headers as typography (LAYER I, no boxes). Flat list of entry cards — tap to expand body + explore-further inline. Bumped reading sizes: 16px headline, 14.5px body.">
            <Manual />
          </Frame>
        </div>

        {/* ─── Three more surfaces · onboarding & Manual flows ─────────── */}
        <div style={{ maxWidth: 2210, margin: "60px auto 0" }}>
          <header style={{ marginBottom: 28 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: C.meta,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              Three more · onboarding & Manual flows
            </p>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: 36,
                fontWeight: 300,
                letterSpacing: -1,
                color: C.hero,
              }}
            >
              Empty, first, share<span style={{ color: C.walnut }}>.</span>
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: 760,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.body,
              }}
            >
              The Manual the user sees on day one (no entries yet); the modal that fires the
              first time Jove proposes an entry; the sheet that exports the Manual as a PDF
              for sharing with a partner or therapist.
            </p>
          </header>
          <div style={{ display: "flex", gap: 28, paddingBottom: 32 }}>
            <Frame label="Empty Manual" description="Day one. Five layer headers visible (the structure is the promise) with '0 entries' meta on each. Quiet placeholder line above the list — 'Your Manual fills as you and Jove find patterns together.' No empty cards, no prompts; the five labeled sections are the page. As entries accumulate, layers populate top-down.">
              <EmptyManual />
            </Frame>
            <Frame label="Export sheet" description="Bottom-sheet export. The Manual is shareable as PDF — that's a primary product use (share with partner, therapist). Drag handle at top, preview of the cover page, entry count, recipient name field optional, 'Generate PDF & share ›' as the action. Walnut + slate aesthetic carries through.">
              <ExportSheet />
            </Frame>
          </div>
        </div>

        {/* ─── Three additional surfaces ─────────── */}
        <div style={{ maxWidth: 2210, margin: "60px auto 0" }}>
          <header style={{ marginBottom: 28 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: C.meta,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              Three additional surfaces
            </p>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: 36,
                fontWeight: 300,
                letterSpacing: -1,
                color: C.hero,
              }}
            >
              Menu, ceiling, composing<span style={{ color: C.walnut }}>.</span>
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: 760,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.body,
              }}
            >
              The drawer becomes the app menu (since we dropped the tab bar): sessions + Manual
              + Settings + Beta feedback + Crisis. The refinement-ceiling card is the post-two-
              refinements variant of the checkpoint. The composing state replaces the optimistic
              "Saved" snap with a quiet activity moment while Sonnet writes the entry server-side.
            </p>
          </header>
          <div style={{ display: "flex", gap: 28, paddingBottom: 32 }}>
            <Frame label="App menu" description="Slide-out left drawer. Replaces the bottom tab bar. Top: '+ New session' button. Recent sessions list with title, layer-relevance hint, date, message count. Separator. Manual / Settings / Feedback / Crisis as flat menu rows. Crisis sits at the foot in oxblood as the always-available exit.">
              <AppMenu />
            </Frame>
            <Frame label="Refinement ceiling" description="The refinement-ceiling checkpoint variant. Fires after the user has refined the same proposal twice. Same plate as the canonical checkpoint, same Spectral body. Different framing ('Close but not quite is fine.') and a 2-button decision row — 'Put it in as it is' (primary) + 'let it go' (secondary). No 'this is not me' option here; that gate has already been used.">
              <RefinementCeiling />
            </Frame>
            <Frame label="Composing" description="Post-checkpoint state while Sonnet writes the polished entry server-side (5–15s). The plate persists so the user can re-read the prose; the decision row is replaced with a quiet activity line — pulsing sage fleuron + 'Putting it on the page…' italic Spectral. Resolves to 'Saved to Layer Two' walnut mono-caps when the write completes.">
              <CheckpointComposing />
            </Frame>
          </div>
        </div>

        {/* ─── Light mode · four palettes ─────────── */}
        <div style={{ maxWidth: 2700, margin: "60px auto 0" }}>
          <header style={{ marginBottom: 28 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: C.meta,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              Light mode · four palettes
            </p>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: 36,
                fontWeight: 300,
                letterSpacing: -1,
                color: C.hero,
              }}
            >
              Three daylights, one wood<span style={{ color: C.walnut }}>.</span>
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: 760,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.body,
              }}
            >
              Walnut stays as the through-line (the app is named for it), but the linen ground
              and walnut tone vary across the three. <strong style={{ color: C.hero, fontWeight: 500 }}>Bright</strong>
              is the morning version — almost-white linen, walnut as a quiet corner. <strong style={{ color: C.hero, fontWeight: 500 }}>Warm</strong>
              is the afternoon — golden-hour linen, walnut blooming through the page. <strong style={{ color: C.hero, fontWeight: 500 }}>Deep</strong>
              is the evening — aged linen, deeper walnut, slate vignette at the edges.
            </p>
          </header>
          <div style={{ display: "flex", gap: 28, paddingBottom: 32 }}>
            <Frame label="Linen Bright" description="Almost-white linen #FBF8EE — morning paper. Walnut appears as a quiet warm corner at the bottom-right. Highest contrast for the ink, lowest walnut presence. Cleanest of the three; reads as a freshly printed page.">
              <ChatLight palette={LIGHT_LINEN_BRIGHT} />
            </Frame>
            <Frame label="Linen Warm" description="Golden-hour linen #F1E8D0. The walnut bloom is the dominant move — full warmth radiating up from the bottom-right with a secondary warm-walnut wash from the bottom-left. The most 'mywalnut' of the three. Plates pick up walnut tint in the borders and surfaces.">
              <ChatLight palette={LIGHT_LINEN_WARM} />
            </Frame>
            <Frame label="Linen Deep" description="Aged linen #E5D9BB — twilight library. Deep walnut accent at the bottom-right, subtle slate vignette at the bottom-left. Highest visual contrast and most editorial mood. Closer to a leather-bound book than a notebook.">
              <ChatLight palette={LIGHT_LINEN_DEEP} />
            </Frame>
          </div>
        </div>

        {/* ─── More surfaces · #4 ─────────── */}
        <div style={{ maxWidth: 2700, margin: "60px auto 0" }}>
          <header style={{ marginBottom: 28 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: C.meta,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              More · auth, edit, errors
            </p>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: 36,
                fontWeight: 300,
                letterSpacing: -1,
                color: C.hero,
              }}
            >
              Five more surfaces<span style={{ color: C.walnut }}>.</span>
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: 760,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.body,
              }}
            >
              Sign in. The nudge that asks anonymous users to save their conversation.
              Confirmation dialog for destructive actions. Editing a Manual entry. And what
              breaks look like — a network error.
            </p>
          </header>
          <div style={{ display: "flex", gap: 28, paddingBottom: 32 }}>
            <Frame label="Login" description="Sign-in form. Walnut-tinted glass plate. Email + password. Primary CTA in mono caps, Google OAuth as secondary, 'magic link instead' as tertiary. 'No account? Create one' italic link. Reset-password text-link beneath the form.">
              <Login />
            </Frame>
            <Frame label="Auth prompt" description="In-chat modal that fires when an anonymous user has built a few turns of conversation. Quiet pressure: 'Save your conversation. Create an account to keep your Manual.' Two actions — Create account (primary), Maybe later (italic).">
              <AuthPrompt />
            </Frame>
            <Frame label="Delete confirmation" description="Generic destructive-action dialog pattern. Oxblood accents (the warning color from the SG). 'This can't be undone' framing. Delete (oxblood) + Cancel (italic). Same pattern across delete-entry, delete-account, delete-data.">
              <DeleteConfirmation />
            </Frame>
            <Frame label="Edit entry" description="Bottom sheet for editing a Manual entry. Sheet slides up over the Manual; name field + body textarea; Save (mono caps) + Cancel (italic). Walnut surface, Spectral throughout. Editing preserves the entry's voice — same typography as reading.">
              <EditEntry />
            </Frame>
            <Frame label="Connection error" description="What breaks look like. Quiet plate over the chat: 'Connection lost. Your last message hasn't sent.' Retry (mono caps) + dismiss. Same plate-on-chat pattern as the proposal card; the error is treated as another moment in the conversation, not a takeover screen.">
              <ConnectionError />
            </Frame>
          </div>
        </div>

        {/* ─── More surfaces · #3 ─────────── */}
        <div style={{ maxWidth: 2700, margin: "60px auto 0" }}>
          <header style={{ marginBottom: 28 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                color: C.meta,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              More · entry, settings, in-conversation states
            </p>
            <h2
              style={{
                margin: "10px 0 0",
                fontSize: 36,
                fontWeight: 300,
                letterSpacing: -1,
                color: C.hero,
              }}
            >
              Five more surfaces<span style={{ color: C.walnut }}>.</span>
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: 760,
                fontSize: 14,
                lineHeight: 1.55,
                color: C.body,
              }}
            >
              The logged-out entry screen, the disclaimer card a first-time user sees, Settings,
              the "Jove is composing a reply" state in chat, and what happens when the user
              taps "Explore further" on a Manual entry.
            </p>
          </header>
          <div style={{ display: "flex", gap: 28, paddingBottom: 32 }}>
            <Frame label="Entry · logged out" description="Landing surface when not signed in. mywalnut wordmark at hero scale; one-line product thesis in italic Spectral; primary 'Begin' affordance + quiet 'Sign in' link. No chrome — the page IS the masthead.">
              <Entry />
            </Frame>
            <Frame label="Disclaimer card" description="The what-to-expect / not-therapy disclaimer card. Fires once during onboarding before the first conversation. Plain prose on a walnut plate, single CTA. Sets the frame: this is a private notebook with an attentive companion, not therapy.">
              <Disclaimer />
            </Frame>
            <Frame label="Settings" description="Full settings screen. Sections as typography (no boxed accordions): ACCOUNT, CRISIS SUPPORT, TEXT JOVE, BETA. Each row is a flat list-tile pattern. Crisis sits visually distinct in oxblood. Theme toggle removed (dark only).">
              <Settings />
            </Frame>
            <Frame label="Jove composing" description="In-chat typing/streaming state. After the user sends, Jove's bubble appears with a single sage fleuron pulsing where the prose will arrive. Same plate as a real Jove bubble — the activity indicator IS the bubble. Resolves into prose as Sonnet streams.">
              <ChatTyping />
            </Frame>
            <Frame label="Explore further" description="What happens when the user taps EXPLORE FURTHER on a Manual entry. The chat opens with a small walnut chip at the top showing which entry is in context (layer + headline). Jove's first message acknowledges and invites continuation. The entry isn't quoted — it's named, and the conversation continues from there.">
              <ExploreFurther />
            </Frame>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}

// ─── Phone frame chrome ─────────────────────────────────────────────
function Frame({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ paddingLeft: 4 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "8px 0 0",
            maxWidth: 400,
            fontSize: 13,
            lineHeight: 1.55,
            color: C.body,
          }}
        >
          {description}
        </p>
      </div>
      <div
        style={{
          width: 410,
          height: 840,
          borderRadius: 50,
          padding: 6,
          background: "linear-gradient(180deg, rgba(60,55,50,0.95), rgba(20,17,14,0.95))",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.03)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 44,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "16px 28px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        fontSize: 14,
        fontWeight: 600,
        color: "rgba(255,255,255,0.95)",
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
        <span>•••</span>
        <span>◓</span>
        <span>▮</span>
      </span>
    </div>
  );
}

function TopBar({ back = true }: { back?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 54,
        left: 22,
        right: 22,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        paddingBottom: 14,
        borderBottom: `1px solid ${C.walnutBorder}`,
      }}
    >
      {back ? <CircleBtn glyph="‹" size={30} /> : <span style={{ width: 30, height: 30 }} />}
      <span
        style={{
          fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif',
          fontSize: 19,
          fontWeight: 400,
          letterSpacing: -0.4,
          color: C.hero,
          lineHeight: 1,
        }}
      >
        mywalnut<span style={{ color: C.walnut }}>.</span>
      </span>
      <CircleBtn glyph="⋯" size={30} />
    </div>
  );
}

// Icon components for the input-method cards. Stroke-based 1px line
// glyphs at 18px — restrained, monochrome, walnut-tinted. Match the
// SG icon vocabulary (no filled emoji, no gradient mascots).
function DialogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.253v13" />
      <path d="M12 6.253C10.832 5.477 9.246 5 7.5 5 5.754 5 4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
      <path d="M12 6.253C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CircleBtn({
  glyph,
  size = 32,
  accent,
}: {
  glyph: string;
  size?: number;
  accent?: "warm";
}) {
  const bg =
    accent === "warm"
      ? "linear-gradient(135deg, rgb(220,170,120), rgb(140,90,55))"
      : "rgba(0,0,0,0.30)";
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.85)",
        fontSize: size * 0.45,
        lineHeight: 1,
        boxShadow: accent ? "0 8px 24px rgba(170,120,82,0.45)" : "none",
      }}
    >
      {glyph}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   1 · WELCOME
// ═══════════════════════════════════════════════════════════════════
function Welcome() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgWelcome, overflow: "hidden" }}>
      <StatusBar />
      <TopBar back={false} />

      <div style={{ position: "absolute", top: 132, left: 28, right: 28, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Friday, May 9
        </p>
        <h1 style={{ margin: "10px 0 0", fontSize: 64, fontWeight: 300, letterSpacing: -2, lineHeight: 1.0, color: C.hero }}>
          Hello,<br />
          I'm Jove<span style={{ color: C.walnut }}>.</span>
        </h1>
        <p
          style={{
            margin: "20px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            fontStyle: "italic",
            lineHeight: 1.45,
            color: C.body,
          }}
        >
          What's on your mind today?
        </p>
      </div>

      {/* Three input methods — Layer 1 of the system per intent.md.
          Each generates a different signal; together they build a
          picture no single source can. Rendered as a vertical stack
          of three full-width cards with leading icon + title + sub
          + trailing chevron. Standard list-with-leading-icon pattern,
          one level of containment. */}
      <div
        style={{
          position: "absolute",
          top: 484,
          left: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 5,
        }}
      >
        {[
          {
            icon: <DialogIcon />,
            title: "Navigate a situation",
            sub: "Something on your mind right now",
            tone: "warm",
          },
          {
            icon: <GuideIcon />,
            title: "Guided intake",
            sub: "Let Jove lead with questions",
            tone: "warm",
          },
          {
            icon: <UploadIcon />,
            title: "Upload",
            sub: "Share something that's been with you",
            tone: "cool",
          },
        ].map((c) => (
          <div
            key={c.title}
            style={{
              padding: "14px 18px",
              borderRadius: 16,
              background: c.tone === "warm" ? C.walnutSurface : "rgba(72,80,98,0.26)",
              border: `1px solid ${C.walnutBorder}`,
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 10,
                background: "rgba(0,0,0,0.30)",
                border: `1px solid ${C.walnutBorderSoft}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.walnut,
              }}
            >
              {c.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 500, color: C.hero, lineHeight: 1.3 }}>
                {c.title}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: '"Spectral", "Source Serif 4", serif',
                  fontSize: 12.5,
                  fontStyle: "italic",
                  color: C.body,
                  lineHeight: 1.4,
                }}
              >
                {c.sub}
              </p>
            </div>
            <span style={{ flexShrink: 0, fontSize: 16, color: C.walnutLight }}>›</span>
          </div>
        ))}
      </div>

      <PillComposer placeholder="What's there?" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   2 · CHAT — bubble pattern, side-anchored speakers
// ═══════════════════════════════════════════════════════════════════
function Chat() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Date marker */}
      <div style={{ position: "absolute", top: 122, left: 22, right: 22, zIndex: 5 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Friday · 8:16 PM
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 158,
          bottom: 98,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          overflow: "hidden",
        }}
      >
        <Bubble speaker="jove">
          Sit with me a while. Tell me, gently, what sort of day this has been — and what,
          if anything, is asking to be said<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="you">
          It was long. The kind that doesn't end at any particular moment, just keeps going
          past where it should have stopped. I'm not sure what to do with the leftover<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="jove">
          Long in what way — full, or heavy? Take the word that fits; the other one will
          wait. I don't need a tidy answer; "long" is already enough to start from<span style={{ color: C.walnut }}>.</span>
        </Bubble>
      </div>

      <PillComposer placeholder="Reply to Jove…" />
    </div>
  );
}

// Side-anchored bubble. Jove anchors LEFT at 92% width; user anchors
// RIGHT at 88%. Asymmetric corner (5px on speaker side) suggests a
// tail without being one. Both speakers use the same roman style —
// position + tint + label do the speaker work. Walnut period closes
// every paragraph.
function Bubble({
  speaker,
  children,
  fontFamily = '"Spectral", "Source Serif 4", serif',
}: {
  speaker: "jove" | "you";
  children: React.ReactNode;
  fontFamily?: string;
}) {
  const isJove = speaker === "jove";
  return (
    <div
      style={{
        maxWidth: isJove ? "92%" : "88%",
        marginLeft: isJove ? 0 : "auto",
        marginRight: isJove ? "auto" : 0,
        padding: "12px 20px 20px",
        borderRadius: 16,
        borderTopLeftRadius: isJove ? 5 : 16,
        borderTopRightRadius: isJove ? 16 : 5,
        background: isJove ? "rgba(115,72,42,0.20)" : "rgba(72,80,98,0.30)",
        border: `1px solid ${isJove ? "rgba(170,120,82,0.20)" : "rgba(170,180,200,0.12)"}`,
        backdropFilter: "blur(28px) saturate(140%)",
        WebkitBackdropFilter: "blur(28px) saturate(140%)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {isJove && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: C.sage,
            fontFamily: '"DM Mono", monospace',
            textAlign: "left",
          }}
        >
          Jove
        </p>
      )}
      <p
        style={{
          margin: 0,
          fontFamily,
          fontSize: 17,
          lineHeight: 1.62,
          color: isJove ? C.hero : "rgba(245,243,238,0.92)",
          fontStyle: "normal",
          letterSpacing: -0.05,
          textWrap: "pretty",
        }}
      >
        {children}
      </p>
    </div>
  );
}

// Chat surface with overridable body font — used for the font
// comparison gallery below. Same content, same layout as the canonical
// Chat; only fontFamily differs.
function ChatWithFont({ fontFamily }: { fontFamily: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 122, left: 22, right: 22, zIndex: 5 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Friday · 8:16 PM
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 158,
          bottom: 30,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily,
          overflow: "hidden",
        }}
      >
        <Bubble speaker="jove" fontFamily={fontFamily}>
          Sit with me a while. Tell me, gently, what sort of day this has been — and what,
          if anything, is asking to be said<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="you" fontFamily={fontFamily}>
          It was long. The kind that doesn't end at any particular moment, just keeps going
          past where it should have stopped<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="jove" fontFamily={fontFamily}>
          Long in what way — full, or heavy? Take the word that fits; the other one will
          wait<span style={{ color: C.walnut }}>.</span>
        </Bubble>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   3 · CHECKPOINT — reading-first
// ═══════════════════════════════════════════════════════════════════
//
// Best-practice typography for prose on mobile:
// — Body 17px / line-height 1.65 (book-reading triad)
// — Heading 24px (~1.4× body for proper hierarchy)
// — Body color at high opacity for max contrast on tinted plate
// — Plate tint subtle so figure-ground exists without crowding text
// — Paragraph break at the natural rhythm; no wall-of-text
// — No hairline divider — whitespace handles the heading→body shift
// — No italic on body prose; reserved for emphasis only
// — Generous 24px internal padding so the eye never crashes the edge
//
// Per docs/rules.md and src/lib/persona/confirm-checkpoint.ts:
// — name: 3–8 word headline ("entry title")
// — content: 80–300 words, second person, somatic anchor required

const SAMPLE_NAME = "Voice goes quiet on shifted plans";
const SAMPLE_BODY_P1 =
  "When plans shift without warning, your voice is the first thing that goes quiet. It's not that you have nothing to say — speech is where your regulation leaves. The architecture stays online underneath; the output channel goes offline.";
const SAMPLE_BODY_P2 =
  "There's a tightness in your chest that you used to read as anxiety, but it's the room asking you to track too many things at once. By the time you find words again, the conversation has moved past the place where they would have helped.";

function Checkpoint() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgCheckpoint, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Jove framing — small, quiet, above the plate */}
      <div style={{ position: "absolute", top: 118, left: 24, right: 24, zIndex: 5 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: C.sage,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Jove
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15,
            lineHeight: 1.5,
            color: C.body,
            fontStyle: "italic",
          }}
        >
          I'm hearing a shape. Tell me if this lands<span style={{ color: C.walnut, fontStyle: "normal" }}>.</span>
        </p>
      </div>

      {/* Plate — same walnut tint and glass treatment as the Jove
          chat bubble, so reading the checkpoint feels continuous with
          reading the chat. Body typography matches the chat bubble
          exactly: 17px / 1.62 / letter-spacing -0.05 / hero color /
          textWrap pretty. The heading is 24px in the same family,
          one step up — same voice, slightly louder. */}
      <div
        style={{
          position: "absolute",
          top: 198,
          left: 18,
          right: 18,
          padding: "20px 22px 22px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.20)",
          border: "1px solid rgba(170,120,82,0.20)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 1px 0 rgba(220,170,120,0.10) inset",
          zIndex: 5,
        }}
      >
        {/* Layer eyebrow */}
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(220,170,120,0.85)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Layer Two · How I process things
        </p>

        {/* Heading — same family as body, one step up (24px). Walnut period. */}
        <h3
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: -0.2,
            color: C.hero,
          }}
        >
          {SAMPLE_NAME}<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h3>

        {/* Body — IDENTICAL to chat-bubble Jove text:
            17px / line-height 1.62 / letter-spacing -0.05 /
            textWrap pretty / color hero. Two paragraphs. */}
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P1}
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P2}
        </p>
      </div>

      {/* Decisions — TextBtn primary + italic decline options */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 5,
        }}
      >
        <button
          style={{
            all: "unset",
            display: "flex",
            justifyContent: "space-between",
            cursor: "pointer",
            padding: "8px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Put it in my Manual</span>
          <span aria-hidden="true">›</span>
        </button>
        <div style={{ display: "flex", gap: 26, paddingTop: 2 }}>
          <span style={{ fontFamily: '"Spectral", "Source Serif 4", serif', fontSize: 15, fontStyle: "italic", color: C.body }}>
            close but not quite
          </span>
          <span style={{ fontFamily: '"Spectral", "Source Serif 4", serif', fontSize: 15, fontStyle: "italic", color: C.bodyDim }}>
            this is not me
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   LIGHT MODE PALETTES — linen base, three gradient corners
// ═══════════════════════════════════════════════════════════════════
// Mirrors the dark-mode layered-gradient pattern (multi-radial-with-
// warm-corner) but on linen ground. The drama in dark comes from
// warm light against deep dark; in light mode the same logic plays
// at lower amplitude — gentle tonal washes instead of glow.
type LightPalette = {
  ground: string;
  gradient: string;
  plateJove: string;
  plateUser: string;
  borderJove: string;
  borderUser: string;
  ink: string;
  inkSoft: string;
  meta: string;
  walnut: string;
  sage: string;
};

// LINEN BRIGHT — almost-white linen ground, walnut as a quiet
// corner accent. Morning-light feel. Lowest walnut presence.
const LIGHT_LINEN_BRIGHT: LightPalette = {
  ground: "#FBF8EE",
  gradient:
    "radial-gradient(ellipse 130% 60% at 30% 5%, rgba(255,253,244,0.95), transparent 60%), " +
    "radial-gradient(ellipse 85% 55% at 95% 95%, rgba(170,120,82,0.14), transparent 60%), " +
    "radial-gradient(ellipse 70% 50% at 50% 70%, rgba(255,250,232,0.50), transparent 70%)",
  plateJove: "rgba(170,120,82,0.08)",
  plateUser: "rgba(50,55,70,0.04)",
  borderJove: "rgba(170,120,82,0.18)",
  borderUser: "rgba(50,55,70,0.10)",
  ink: "#1A1410",
  inkSoft: "rgba(26,20,16,0.55)",
  meta: "rgba(140,90,55,0.70)",
  walnut: "rgb(150,100,62)",
  sage: "rgba(92,107,78,0.85)",
};

// LINEN WARM — golden-hour linen. Walnut bloom is the dominant move;
// the entire ground glows warm-walnut at the corner. Most "mywalnut."
const LIGHT_LINEN_WARM: LightPalette = {
  ground: "#F1E8D0",
  gradient:
    "radial-gradient(ellipse 110% 55% at 25% 10%, rgba(248,238,210,0.85), transparent 60%), " +
    "radial-gradient(ellipse 110% 80% at 100% 100%, rgba(170,120,82,0.45), transparent 60%), " +
    "radial-gradient(ellipse 80% 60% at 0% 100%, rgba(195,140,90,0.20), transparent 65%), " +
    "radial-gradient(ellipse 60% 40% at 50% 55%, rgba(255,250,232,0.30), transparent 70%)",
  plateJove: "rgba(140,90,55,0.16)",
  plateUser: "rgba(95,75,55,0.08)",
  borderJove: "rgba(140,90,55,0.30)",
  borderUser: "rgba(95,75,55,0.20)",
  ink: "#1A1208",
  inkSoft: "rgba(26,18,8,0.62)",
  meta: "rgba(115,75,30,0.85)",
  walnut: "rgb(115,75,30)",
  sage: "rgba(85,100,72,0.85)",
};

// LINEN DEEP — aged book-page linen with a deep walnut accent and
// a subtle slate vignette. Twilight / library-at-dusk feel. Highest
// contrast, most editorial.
const LIGHT_LINEN_DEEP: LightPalette = {
  ground: "#E5D9BB",
  gradient:
    "radial-gradient(ellipse 100% 50% at 25% 10%, rgba(232,219,188,0.65), transparent 60%), " +
    "radial-gradient(ellipse 100% 70% at 100% 100%, rgba(115,72,42,0.40), transparent 60%), " +
    "radial-gradient(ellipse 90% 50% at 0% 100%, rgba(60,70,90,0.18), transparent 65%), " +
    "radial-gradient(ellipse 80% 65% at 50% 50%, rgba(238,225,195,0.45), transparent 75%)",
  plateJove: "rgba(115,72,42,0.18)",
  plateUser: "rgba(60,70,90,0.10)",
  borderJove: "rgba(115,72,42,0.32)",
  borderUser: "rgba(60,70,90,0.22)",
  ink: "#15100A",
  inkSoft: "rgba(21,16,10,0.68)",
  meta: "rgba(95,55,20,0.88)",
  walnut: "rgb(95,55,20)",
  sage: "rgba(75,90,65,0.85)",
};

function ChatLight({ palette: p }: { palette: LightPalette }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: p.ground,
        backgroundImage: p.gradient,
        overflow: "hidden",
      }}
    >
      {/* Status bar — dark glyphs on light */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "16px 28px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          fontSize: 14,
          fontWeight: 600,
          color: p.ink,
        }}
      >
        <span>9:41</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
          <span>•••</span>
          <span>◓</span>
          <span>▮</span>
        </span>
      </div>

      {/* Top bar — light variant */}
      <div
        style={{
          position: "absolute",
          top: 54,
          left: 22,
          right: 22,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          paddingBottom: 14,
          borderBottom: `1px solid ${p.borderJove}`,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.05)",
            border: `1px solid ${p.borderJove}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: p.inkSoft,
            fontSize: 14,
          }}
        >
          ‹
        </span>
        <span
          style={{
            fontFamily: '"Instrument Serif", "Spectral", Georgia, serif',
            fontSize: 19,
            fontWeight: 400,
            letterSpacing: -0.4,
            color: p.ink,
            lineHeight: 1,
          }}
        >
          mywalnut<span style={{ color: p.walnut }}>.</span>
        </span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.05)",
            border: `1px solid ${p.borderJove}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: p.inkSoft,
            fontSize: 18,
          }}
        >
          ⋯
        </span>
      </div>

      {/* Date marker */}
      <div style={{ position: "absolute", top: 122, left: 22, right: 22, zIndex: 5 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: p.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Friday · 8:16 PM
        </p>
      </div>

      {/* Bubbles */}
      <div
        style={{
          position: "absolute",
          top: 158,
          bottom: 30,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          overflow: "hidden",
        }}
      >
        <BubbleLight speaker="jove" palette={p}>
          Sit with me a while. Tell me, gently, what sort of day this has been — and what,
          if anything, is asking to be said<span style={{ color: p.walnut }}>.</span>
        </BubbleLight>
        <BubbleLight speaker="you" palette={p}>
          It was long. The kind that doesn't end at any particular moment, just keeps going
          past where it should have stopped<span style={{ color: p.walnut }}>.</span>
        </BubbleLight>
        <BubbleLight speaker="jove" palette={p}>
          Long in what way — full, or heavy? Take the word that fits<span style={{ color: p.walnut }}>.</span>
        </BubbleLight>
      </div>
    </div>
  );
}

function BubbleLight({
  speaker,
  palette: p,
  children,
}: {
  speaker: "jove" | "you";
  palette: LightPalette;
  children: React.ReactNode;
}) {
  const isJove = speaker === "jove";
  return (
    <div
      style={{
        maxWidth: isJove ? "92%" : "88%",
        marginLeft: isJove ? 0 : "auto",
        marginRight: isJove ? "auto" : 0,
        padding: "12px 20px 18px",
        borderRadius: 16,
        borderTopLeftRadius: isJove ? 5 : 16,
        borderTopRightRadius: isJove ? 16 : 5,
        background: isJove ? p.plateJove : p.plateUser,
        border: `1px solid ${isJove ? p.borderJove : p.borderUser}`,
        boxShadow: "0 2px 8px rgba(26,20,16,0.04)",
      }}
    >
      {isJove && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: p.sage,
            fontFamily: '"DM Mono", monospace',
            textAlign: "left",
          }}
        >
          Jove
        </p>
      )}
      <p
        style={{
          margin: 0,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          fontSize: 17,
          lineHeight: 1.62,
          color: isJove ? p.ink : p.inkSoft,
          letterSpacing: -0.05,
          textWrap: "pretty",
        }}
      >
        {children}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   LOGIN — sign-in form
// ═══════════════════════════════════════════════════════════════════
function Login() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgWelcome, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 130, left: 28, right: 28, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Welcome back
        </p>
        <h2 style={{ margin: "8px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 36, fontWeight: 400, letterSpacing: -0.8, lineHeight: 1.05, color: C.hero }}>
          Sign in<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      {/* Form plate */}
      <div
        style={{
          position: "absolute",
          top: 232,
          left: 18,
          right: 18,
          padding: "20px 22px 22px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.16)",
          border: "1px solid rgba(170,120,82,0.20)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          zIndex: 5,
        }}
      >
        {/* Email */}
        <FormField label="Email" value="jeff@walnut.lab" />
        <div style={{ height: 14 }} />
        {/* Password */}
        <FormField label="Password" value="••••••••••" />

        {/* Sign in primary */}
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 22,
            padding: "10px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Sign in</span>
          <span aria-hidden="true">›</span>
        </button>

        {/* Forgot password — quiet */}
        <p style={{ margin: "12px 0 0", textAlign: "right" }}>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 13,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            forgot password
          </span>
        </p>
      </div>

      {/* OR divider + Google */}
      <div style={{ position: "absolute", top: 458, left: 28, right: 28, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(170,120,82,0.20)" }} />
          <span
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.meta,
              fontFamily: '"DM Mono", monospace',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(170,120,82,0.20)" }} />
        </div>

        {/* Google OAuth */}
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            background: "rgba(245,243,238,0.08)",
            border: "1px solid rgba(245,243,238,0.14)",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 14,
            color: C.hero,
            marginTop: 14,
          }}
        >
          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, letterSpacing: 1, color: C.walnut }}>G</span>
          Continue with Google
        </button>

        {/* Magic link — quiet text link */}
        <p style={{ margin: "16px 0 0", textAlign: "center" }}>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 13.5,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            send me a magic link instead
          </span>
        </p>
      </div>

      {/* Footer — create account */}
      <div style={{ position: "absolute", bottom: 36, left: 24, right: 24, textAlign: "center", zIndex: 5 }}>
        <span
          style={{
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 14,
            fontStyle: "italic",
            color: C.body,
          }}
        >
          No account? <span style={{ color: C.hero, borderBottom: `1px solid ${C.walnutLight}`, paddingBottom: 1 }}>Create one</span>
        </span>
      </div>
    </div>
  );
}

// Form field — label above, value in a ghosted line input.
function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: C.meta,
          fontFamily: '"DM Mono", monospace',
        }}
      >
        {label}
      </p>
      <div
        style={{
          marginTop: 4,
          paddingBottom: 6,
          borderBottom: "1px solid rgba(170,120,82,0.30)",
        }}
      >
        <span
          style={{
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 16,
            color: C.hero,
            letterSpacing: -0.05,
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   AUTH PROMPT — anonymous user nudge to save their work
// ═══════════════════════════════════════════════════════════════════
function AuthPrompt() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Faded chat behind */}
      <div style={{ position: "absolute", top: 100, bottom: 80, left: 18, right: 18, zIndex: 3, opacity: 0.30, fontFamily: '"Spectral", serif' }}>
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase", color: C.sage, fontFamily: '"DM Mono", monospace' }}>Jove</p>
          <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.6, color: C.hero }}>Sit with me a while…</p>
        </div>
      </div>

      {/* Backdrop dim */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 5 }} />

      {/* Modal — centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 22,
          right: 22,
          transform: "translateY(-50%)",
          padding: "26px 24px 22px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.30)",
          border: "1px solid rgba(170,120,82,0.30)",
          backdropFilter: "blur(40px) saturate(150%)",
          WebkitBackdropFilter: "blur(40px) saturate(150%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(220,170,120,0.14) inset",
          zIndex: 10,
        }}
      >
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Right now you're anonymous
        </p>
        <h2
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: -0.3,
            color: C.hero,
          }}
        >
          Save your conversation<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h2>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15,
            lineHeight: 1.6,
            color: C.hero,
            letterSpacing: -0.05,
          }}
        >
          Create an account to keep your Manual. You'll get back what you've already said and Jove will remember the patterns next time<span style={{ color: C.walnut }}>.</span>
        </p>

        {/* Actions — primary + secondary */}
        <div style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid rgba(170,120,82,0.20)" }}>
          <button
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 0",
              borderBottom: `1px solid ${C.hero}`,
              fontFamily: '"DM Mono", monospace',
              fontSize: 12,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: C.hero,
            }}
          >
            <span>Create account</span>
            <span aria-hidden="true">›</span>
          </button>
          <p style={{ margin: "14px 0 0", textAlign: "center" }}>
            <span
              style={{
                fontFamily: '"Spectral", "Source Serif 4", serif',
                fontSize: 14,
                fontStyle: "italic",
                color: C.body,
              }}
            >
              maybe later
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   DELETE CONFIRMATION — destructive action dialog
// ═══════════════════════════════════════════════════════════════════
function DeleteConfirmation() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Manual visible behind, dimmed */}
      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 3, opacity: 0.25 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>14 entries</p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 30, fontWeight: 400, color: C.hero }}>
          Your Manual<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.60)", zIndex: 5 }} />

      {/* Modal — centered, oxblood-accented */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 28,
          right: 28,
          transform: "translateY(-50%)",
          padding: "26px 24px 22px",
          borderRadius: 18,
          background: "rgba(20,22,28,0.92)",
          border: "1px solid rgba(208,130,120,0.32)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.60)",
          zIndex: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(208,130,120,0.85)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Delete entry
        </p>
        <h2
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: -0.3,
            color: C.hero,
          }}
        >
          "Voice goes quiet on shifted plans" will be removed from your Manual<span style={{ color: "rgba(208,130,120,0.85)", fontWeight: 400 }}>.</span>
        </h2>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 14,
            lineHeight: 1.55,
            fontStyle: "italic",
            color: C.body,
          }}
        >
          This can't be undone. Conversations that referenced this entry will keep their context, but new sessions won't see it.
        </p>

        <div style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid rgba(208,130,120,0.20)" }}>
          <button
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 0",
              borderBottom: "1px solid rgba(208,130,120,0.95)",
              fontFamily: '"DM Mono", monospace',
              fontSize: 12,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: "rgba(208,130,120,0.95)",
            }}
          >
            <span>Delete</span>
            <span aria-hidden="true">›</span>
          </button>
          <p style={{ margin: "14px 0 0", textAlign: "center" }}>
            <span
              style={{
                fontFamily: '"Spectral", "Source Serif 4", serif',
                fontSize: 14,
                fontStyle: "italic",
                color: C.body,
              }}
            >
              cancel
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   EDIT ENTRY — bottom sheet with editable name + body
// ═══════════════════════════════════════════════════════════════════
function EditEntry() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Manual visible behind, dimmed */}
      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 3, opacity: 0.30 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>Layer Two · 3 entries</p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 26, fontWeight: 400, color: C.hero }}>
          How I process things<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      {/* Backdrop dim */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 5 }} />

      {/* Bottom sheet */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 22px 28px",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: "rgba(20,22,28,0.92)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          borderTop: "1px solid rgba(170,120,82,0.24)",
          boxShadow: "0 -16px 60px rgba(0,0,0,0.55)",
          zIndex: 10,
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(228,224,214,0.30)", margin: "0 auto 18px" }} />

        <p style={{ margin: 0, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Edit entry · Layer II
        </p>

        {/* Name field */}
        <div style={{ marginTop: 18 }}>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
            Name
          </p>
          <div
            style={{
              marginTop: 6,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(115,72,42,0.16)",
              border: "1px solid rgba(170,120,82,0.24)",
              outline: `1px solid rgba(170,120,82,0.42)`,
              outlineOffset: -1,
            }}
          >
            <span
              style={{
                fontFamily: '"Spectral", "Source Serif 4", serif',
                fontSize: 16,
                fontWeight: 500,
                color: C.hero,
                letterSpacing: -0.1,
              }}
            >
              Voice goes quiet on shifted plans
            </span>
          </div>
        </div>

        {/* Body field */}
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
            Body
          </p>
          <div
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 10,
              minHeight: 130,
              background: "rgba(115,72,42,0.16)",
              border: "1px solid rgba(170,120,82,0.24)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: '"Spectral", "Source Serif 4", serif',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: C.hero,
                letterSpacing: -0.05,
              }}
            >
              When plans shift without warning, your voice is the first thing that goes quiet. It's not that you have nothing to say — speech is where your regulation leaves<span style={{ color: C.walnut }}>.</span>
            </p>
          </div>
        </div>

        {/* Save action + cancel */}
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 22,
            padding: "10px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Save changes</span>
          <span aria-hidden="true">›</span>
        </button>
        <p style={{ margin: "14px 0 0", textAlign: "center" }}>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 14,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            cancel
          </span>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   CONNECTION ERROR — inline plate over the chat
// ═══════════════════════════════════════════════════════════════════
function ConnectionError() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Chat behind — visible but slightly faded */}
      <div
        style={{
          position: "absolute",
          top: 130,
          bottom: 240,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          opacity: 0.55,
          overflow: "hidden",
        }}
      >
        <Bubble speaker="jove">
          Long in what way — full, or heavy? Take the word that fits<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="you">
          Heavy. I keep thinking about the phone call with my mother<span style={{ color: C.walnut }}>.</span>
        </Bubble>
      </div>

      {/* Error plate — anchors to the bottom-third, oxblood accent */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: 18,
          right: 18,
          padding: "20px 22px 22px",
          borderRadius: 18,
          background: "rgba(20,22,28,0.92)",
          border: "1px solid rgba(208,130,120,0.30)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          zIndex: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(208,130,120,0.85)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Connection lost
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 16,
            lineHeight: 1.5,
            color: C.hero,
            letterSpacing: -0.05,
          }}
        >
          Your last message hasn't sent. Jove's still here when you're back<span style={{ color: "rgba(208,130,120,0.85)" }}>.</span>
        </p>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(208,130,120,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            style={{
              all: "unset",
              cursor: "pointer",
              fontFamily: '"DM Mono", monospace',
              fontSize: 12,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              color: C.hero,
              paddingBottom: 2,
              borderBottom: `1px solid ${C.hero}`,
            }}
          >
            Retry ›
          </button>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 13.5,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            dismiss
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   ENTRY — logged-out landing
// ═══════════════════════════════════════════════════════════════════
function Entry() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgWelcome, overflow: "hidden" }}>
      <StatusBar />

      {/* Centered hero — wordmark + thesis + primary action */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 28,
          right: 28,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          A private manual
        </p>
        <h1
          style={{
            margin: "16px 0 0",
            fontFamily: '"Instrument Serif", "Spectral", serif',
            fontSize: 72,
            fontWeight: 400,
            letterSpacing: -2,
            lineHeight: 0.96,
            color: C.hero,
          }}
        >
          mywalnut<span style={{ color: C.walnut }}>.</span>
        </h1>
        <p
          style={{
            margin: "22px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            fontStyle: "italic",
            lineHeight: 1.55,
            color: C.body,
            maxWidth: "94%",
          }}
        >
          A behavioral playbook for how you actually work — written by you, in conversation with Jove<span style={{ color: C.walnut, fontStyle: "normal" }}>.</span>
        </p>
      </div>

      {/* Bottom — primary action + quiet sign in */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderRadius: 999,
            background: "rgba(115,72,42,0.30)",
            border: "1px solid rgba(170,120,82,0.35)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Begin</span>
          <span aria-hidden="true">›</span>
        </button>
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 14,
            fontStyle: "italic",
            color: C.body,
          }}
        >
          Already have access? <span style={{ color: C.hero, borderBottom: `1px solid ${C.walnutLight}`, paddingBottom: 1 }}>Sign in</span>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   DISCLAIMER — what-to-expect / not-therapy card
// ═══════════════════════════════════════════════════════════════════
function Disclaimer() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Plate — centered, walnut tint, prose-led */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 18,
          right: 18,
          padding: "26px 24px 24px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.22)",
          border: "1px solid rgba(170,120,82,0.24)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 1px 0 rgba(220,170,120,0.12) inset",
          zIndex: 5,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Before you begin
        </p>
        <h2
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: -0.3,
            color: C.hero,
          }}
        >
          What this is, and isn't<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h2>
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15.5,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
          }}
        >
          Jove is a careful, direct companion. It listens, reflects, and helps you notice patterns in how you work. Over time, the things you confirm become entries in your Manual.
        </p>
        <p
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15.5,
            lineHeight: 1.62,
            color: "rgba(245,243,238,0.78)",
            letterSpacing: -0.05,
          }}
        >
          This isn't therapy and Jove isn't a clinician. If something serious comes up, the Crisis Support link is always one tap away in the menu<span style={{ color: C.walnut }}>.</span>
        </p>
      </div>

      {/* Action — single CTA at the bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: 24,
          right: 24,
          zIndex: 5,
        }}
      >
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Continue</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   SETTINGS — flat list under typographic section headers
// ═══════════════════════════════════════════════════════════════════
function Settings() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Section heading */}
      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Account · v2.11.0
        </p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 30, fontWeight: 400, letterSpacing: -0.6, lineHeight: 1, color: C.hero }}>
          Settings<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      {/* Settings list */}
      <div
        style={{
          position: "absolute",
          top: 198,
          left: 22,
          right: 22,
          bottom: 22,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ACCOUNT section */}
        <SettingsSectionHeader label="Account" />
        <SettingsRow label="Signed in as" meta="jeff@walnut.lab" />
        <SettingsRow label="Log out" />
        <SettingsRow label="Delete user data" sub="Removes your Manual and conversations" tone="danger" />
        <SettingsRow label="Delete account" sub="Cannot be undone" tone="danger" />

        {/* CRISIS section — visually distinct */}
        <div style={{ marginTop: 18 }}>
          <SettingsSectionHeader label="Crisis support" tone="danger" />
          <SettingsRow label="View crisis resources" sub="988 · Crisis Text Line · find a clinician" tone="danger" />
        </div>

        {/* TEXT JOVE section */}
        <div style={{ marginTop: 18 }}>
          <SettingsSectionHeader label="Text Jove" />
          <SettingsRow label="Link a phone number" sub="Talk with Jove over SMS" />
        </div>

        {/* BETA section */}
        <div style={{ marginTop: 18 }}>
          <SettingsSectionHeader label="Beta" />
          <SettingsRow label="Send feedback" sub="Tell us what's broken" />
        </div>
      </div>
    </div>
  );
}

function SettingsSectionHeader({ label, tone }: { label: string; tone?: "danger" }) {
  return (
    <div
      style={{
        paddingBottom: 8,
        marginBottom: 4,
        borderBottom: `1px solid ${tone === "danger" ? "rgba(208,130,120,0.22)" : "rgba(170,120,82,0.20)"}`,
      }}
    >
      <span
        style={{
          fontFamily: '"DM Mono", monospace',
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: tone === "danger" ? "rgba(208,130,120,0.85)" : "rgba(220,170,120,0.85)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SettingsRow({ label, sub, meta, tone }: { label: string; sub?: string; meta?: string; tone?: "danger" }) {
  return (
    <div
      style={{
        padding: "12px 4px",
        borderBottom: "1px solid rgba(170,120,82,0.10)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        cursor: "pointer",
      }}
    >
      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15,
            color: tone === "danger" ? "rgba(208,130,120,0.92)" : C.hero,
            lineHeight: 1.4,
          }}
        >
          {label}
        </p>
        {sub && (
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 12.5,
              fontStyle: "italic",
              color: C.body,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {meta && (
        <span
          style={{
            fontFamily: '"DM Mono", monospace',
            fontSize: 10,
            letterSpacing: 1.4,
            color: C.bodyDim,
          }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   CHAT · TYPING — Jove composing a reply
// ═══════════════════════════════════════════════════════════════════
function ChatTyping() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 122, left: 22, right: 22, zIndex: 5 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: C.meta,
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Friday · 8:16 PM
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 158,
          bottom: 30,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          overflow: "hidden",
        }}
      >
        <Bubble speaker="jove">
          Long in what way — full, or heavy? Take the word that fits; the other one will
          wait<span style={{ color: C.walnut }}>.</span>
        </Bubble>
        <Bubble speaker="you">
          Heavy. I keep thinking about the phone call with my mother<span style={{ color: C.walnut }}>.</span>
        </Bubble>

        {/* Typing — Jove bubble shell with a pulsing fleuron in place of prose */}
        <div
          style={{
            maxWidth: "92%",
            marginLeft: 0,
            marginRight: "auto",
            padding: "12px 20px 18px",
            borderRadius: 16,
            borderTopLeftRadius: 5,
            borderTopRightRadius: 16,
            background: "rgba(115,72,42,0.20)",
            border: "1px solid rgba(170,120,82,0.20)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 10,
              letterSpacing: 2.2,
              textTransform: "uppercase",
              color: C.sage,
              fontFamily: '"DM Mono", monospace',
            }}
          >
            Jove
          </p>
          {/* The fleuron is the activity indicator — not three dots */}
          <span
            aria-label="Jove is composing"
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 22,
              color: C.walnut,
              opacity: 0.85,
              animation: "personaPulse 2.4s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            ❦
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   EXPLORE FURTHER — chat with a Manual entry as context
// ═══════════════════════════════════════════════════════════════════
function ExploreFurther() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Context chip — small walnut pill at the top showing which entry
          is in play. Quiet but persistent so the user always knows
          what's framing this conversation. */}
      <div
        style={{
          position: "absolute",
          top: 122,
          left: 18,
          right: 18,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(115,72,42,0.18)",
          border: "1px solid rgba(170,120,82,0.24)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 5,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(220,170,120,0.85)",
            fontFamily: '"DM Mono", monospace',
            flexShrink: 0,
          }}
        >
          From II
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 13.5,
            color: C.hero,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Voice goes quiet on shifted plans
        </span>
        <span style={{ flexShrink: 0, color: C.body, fontSize: 14 }}>×</span>
      </div>

      {/* Conversation continues — Jove acknowledges the entry as context
          without quoting it. Uses the user's own language naming the
          entry, then opens a deeper question. */}
      <div
        style={{
          position: "absolute",
          top: 192,
          bottom: 30,
          left: 0,
          right: 0,
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          overflow: "hidden",
        }}
      >
        <Bubble speaker="jove">
          Right — the one about your voice going quiet when plans shift. Let's go deeper into
          that. Was there a moment recently where you watched it happen and noticed the
          temperature drop before the words went<span style={{ color: C.walnut }}>?</span>
        </Bubble>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   APP MENU — slide-out left drawer, replaces the tab bar
// ═══════════════════════════════════════════════════════════════════
// Combines the existing SessionDrawer (past sessions) with primary
// nav (Manual, Settings, Feedback, Crisis). Reads as one menu, not
// two systems.
function AppMenu() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgChat, overflow: "hidden" }}>
      <StatusBar />

      {/* Backdrop dimming the chat behind */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 5 }} />

      {/* Drawer panel — left-anchored, ~85% width */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "86%",
          maxWidth: 360,
          background: "rgba(20,22,28,0.92)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          borderRight: "1px solid rgba(170,120,82,0.18)",
          boxShadow: "12px 0 60px rgba(0,0,0,0.55)",
          zIndex: 10,
          paddingTop: 56,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drawer top — wordmark + close */}
        <div
          style={{
            padding: "18px 22px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(170,120,82,0.16)",
          }}
        >
          <span
            style={{
              fontFamily: '"Instrument Serif", "Spectral", serif',
              fontSize: 22,
              color: C.hero,
              letterSpacing: -0.5,
            }}
          >
            mywalnut<span style={{ color: C.walnut }}>.</span>
          </span>
          <CircleBtn glyph="✕" size={28} />
        </div>

        {/* New session — primary affordance */}
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            margin: "16px 18px 8px",
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(115,72,42,0.20)",
            border: "1px solid rgba(170,120,82,0.28)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: C.walnut, fontSize: 16, lineHeight: 1 }}>+</span>
          <span style={{ fontFamily: '"Spectral", serif', fontSize: 15, color: C.hero }}>
            New session
          </span>
        </button>

        {/* Sessions list */}
        <div style={{ padding: "8px 18px 4px" }}>
          <p
            style={{
              margin: "0 0 8px 4px",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.meta,
              fontFamily: '"DM Mono", monospace',
            }}
          >
            Sessions
          </p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
          {[
            { title: "About my voice going quiet", date: "Today", count: 12, active: true },
            { title: "After the call with my mother", date: "Yesterday", count: 18 },
            { title: "On feeling watched at work", date: "Mon", count: 9, isText: true },
            { title: "What 'rest' actually is", date: "Apr 28", count: 22 },
            { title: "When the room slips", date: "Apr 22", count: 7 },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "12px 14px",
                borderLeft: s.active ? `2px solid ${C.walnut}` : "2px solid transparent",
                borderBottom: "1px solid rgba(170,120,82,0.10)",
                cursor: "pointer",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: '"Spectral", serif',
                  fontSize: 14,
                  color: s.active ? C.hero : C.body,
                  lineHeight: 1.4,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                {s.isText && (
                  <span
                    style={{
                      fontFamily: '"DM Mono", monospace',
                      fontSize: 9,
                      letterSpacing: 1.6,
                      color: C.meta,
                    }}
                  >
                    TEXT
                  </span>
                )}
              </p>
              <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                <span
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: C.bodyDim,
                  }}
                >
                  {s.date}
                </span>
                <span
                  style={{
                    fontFamily: '"DM Mono", monospace',
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: C.bodyDim,
                  }}
                >
                  {s.count} msgs
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Section divider */}
        <div style={{ borderTop: "1px solid rgba(170,120,82,0.16)", padding: "10px 22px 4px" }}>
          {/* Primary nav rows — Manual, Settings, Feedback, Crisis */}
          {[
            { icon: "❦", label: "Read my Manual", count: "14 entries" },
            { icon: "✷", label: "Settings", count: null },
            { icon: "✎", label: "Beta feedback", count: null },
          ].map((r) => (
            <div
              key={r.label}
              style={{
                padding: "12px 0",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
              }}
            >
              <span style={{ width: 18, textAlign: "center", color: C.walnut, fontSize: 14 }}>
                {r.icon}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: '"Spectral", serif',
                  fontSize: 15,
                  color: C.hero,
                }}
              >
                {r.label}
              </span>
              {r.count && (
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: C.meta,
                    fontFamily: '"DM Mono", monospace',
                  }}
                >
                  {r.count}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Crisis — always-available exit at the foot */}
        <div
          style={{
            borderTop: "1px solid rgba(170,120,82,0.16)",
            padding: "14px 22px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 18, textAlign: "center", color: "rgba(208,130,120,0.85)", fontSize: 14 }}>
              ◌
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: '"Spectral", serif',
                fontSize: 14,
                color: "rgba(208,130,120,0.85)",
              }}
            >
              Crisis support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   REFINEMENT-CEILING CHECKPOINT
// ═══════════════════════════════════════════════════════════════════
// Same plate as the canonical Checkpoint. Different framing line and
// a 2-button decision row — "Put it in as it is" + "let it go".
function RefinementCeiling() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgCheckpoint, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 118, left: 24, right: 24, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase", color: C.sage, fontFamily: '"DM Mono", monospace' }}>
          Jove
        </p>
        <p style={{ margin: "6px 0 0", fontFamily: '"Spectral", "Source Serif 4", serif', fontSize: 15, lineHeight: 1.5, color: C.body, fontStyle: "italic" }}>
          Close but not quite is fine. Want me to put it in as it is, or let it go and we come back to it<span style={{ color: C.walnut, fontStyle: "normal" }}>?</span>
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 232,
          left: 18,
          right: 18,
          padding: "20px 22px 22px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.20)",
          border: "1px solid rgba(170,120,82,0.20)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 1px 0 rgba(220,170,120,0.10) inset",
          zIndex: 5,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(220,170,120,0.85)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Layer Two · How I process things
        </p>
        <h3
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: -0.2,
            color: C.hero,
          }}
        >
          {SAMPLE_NAME}<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h3>
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P1}
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P2}
        </p>
      </div>

      {/* 2-button decision row */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 5,
        }}
      >
        <button
          style={{
            all: "unset",
            display: "flex",
            justifyContent: "space-between",
            cursor: "pointer",
            padding: "8px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Put it in as it is</span>
          <span aria-hidden="true">›</span>
        </button>
        <span style={{ fontFamily: '"Spectral", "Source Serif 4", serif', fontSize: 15, fontStyle: "italic", color: C.body, paddingTop: 2 }}>
          let it go
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   COMPOSING — post-checkpoint, server is writing the entry
// ═══════════════════════════════════════════════════════════════════
// User has confirmed; Sonnet is composing the polished entry. The
// plate persists with the prose visible (so the user can re-read while
// they wait); the decision row is replaced with a quiet activity line.
function CheckpointComposing() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgCheckpoint, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 118, left: 24, right: 24, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase", color: C.sage, fontFamily: '"DM Mono", monospace' }}>
          Jove
        </p>
        <p style={{ margin: "6px 0 0", fontFamily: '"Spectral", "Source Serif 4", serif', fontSize: 15, lineHeight: 1.5, color: C.body, fontStyle: "italic" }}>
          I'm hearing a shape. Tell me if this lands<span style={{ color: C.walnut, fontStyle: "normal" }}>.</span>
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          top: 198,
          left: 18,
          right: 18,
          padding: "20px 22px 22px",
          borderRadius: 18,
          background: "rgba(115,72,42,0.20)",
          border: "1px solid rgba(170,120,82,0.20)",
          backdropFilter: "blur(28px) saturate(140%)",
          WebkitBackdropFilter: "blur(28px) saturate(140%)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.30), 0 1px 0 rgba(220,170,120,0.10) inset",
          zIndex: 5,
          opacity: 0.92,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(220,170,120,0.85)",
            fontFamily: '"DM Mono", monospace',
          }}
        >
          Layer Two · How I process things
        </p>
        <h3
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: -0.2,
            color: C.hero,
          }}
        >
          {SAMPLE_NAME}<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h3>
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P1}
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 17,
            lineHeight: 1.62,
            color: C.hero,
            letterSpacing: -0.05,
            textWrap: "pretty",
          }}
        >
          {SAMPLE_BODY_P2}
        </p>

        {/* Quiet activity strip — replaces the decision row */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(170,120,82,0.18)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 16,
              color: C.walnut,
              animation: "personaPulse 2.4s ease-in-out infinite",
              opacity: 0.85,
            }}
          >
            ❦
          </span>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 14,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            Putting it on the page…
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   EMPTY MANUAL — five labeled sections, no entries yet
// ═══════════════════════════════════════════════════════════════════
function EmptyManual() {
  const layers = [
    { num: "I", name: "My Strengths" },
    { num: "II", name: "Some of my patterns" },
    { num: "III", name: "How I process things" },
    { num: "IV", name: "What helps" },
    { num: "V", name: "How I show up with people" },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          Empty
        </p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 30, fontWeight: 400, letterSpacing: -0.6, lineHeight: 1, color: C.hero }}>
          Your Manual<span style={{ color: C.walnut }}>.</span>
        </h2>
        <p
          style={{
            margin: "14px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 15,
            fontStyle: "italic",
            lineHeight: 1.55,
            color: C.body,
            maxWidth: "92%",
          }}
        >
          Your Manual fills as you and Jove find patterns together. The five layers wait for whatever you bring<span style={{ color: C.walnut, fontStyle: "normal" }}>.</span>
        </p>
      </div>

      {/* Five labeled section headers, no entries beneath. The structure
          is the promise — the page already knows its shape. */}
      <div
        style={{
          position: "absolute",
          top: 270,
          left: 22,
          right: 22,
          bottom: 28,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {layers.map((l, i) => (
          <div
            key={l.num}
            style={{
              padding: "18px 4px",
              borderBottom: i === layers.length - 1 ? "none" : "1px solid rgba(170,120,82,0.16)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
              <span
                style={{
                  fontFamily: '"Instrument Serif", "Spectral", serif',
                  fontStyle: "italic",
                  fontSize: 18,
                  color: "rgba(220,170,120,0.55)",
                  width: 22,
                }}
              >
                {l.num}
              </span>
              <span
                style={{
                  fontFamily: '"Spectral", "Source Serif 4", serif',
                  fontSize: 16,
                  color: "rgba(245,243,238,0.65)",
                }}
              >
                {l.name}
              </span>
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: C.bodyDim,
                fontFamily: '"DM Mono", monospace',
              }}
            >
              0 entries
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   EXPORT SHEET — share Manual as PDF
// ═══════════════════════════════════════════════════════════════════
// Bottom sheet. Slides up from the foot of the Manual screen when the
// user taps "Share". Shows a preview of the cover, entry count, and
// the action. The Manual is the product's primary shareable artifact
// (per intent.md — share with partner, therapist, friend).
function ExportSheet() {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      {/* Manual underneath, dimmed (so the sheet reads as a temporary
          surface over the page, not a separate screen). */}
      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 3, opacity: 0.30 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          14 entries
        </p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 30, fontWeight: 400, letterSpacing: -0.6, lineHeight: 1, color: C.hero }}>
          Your Manual<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      {/* Backdrop dim */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 5 }} />

      {/* Sheet — anchored to the bottom, rounded top corners */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px 32px",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: "rgba(20,22,28,0.90)",
          backdropFilter: "blur(40px) saturate(140%)",
          WebkitBackdropFilter: "blur(40px) saturate(140%)",
          borderTop: "1px solid rgba(170,120,82,0.24)",
          boxShadow: "0 -16px 60px rgba(0,0,0,0.55)",
          zIndex: 10,
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "rgba(228,224,214,0.30)",
            margin: "0 auto 18px",
          }}
        />

        {/* Sheet heading */}
        <h2
          style={{
            margin: 0,
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.25,
            color: C.hero,
            letterSpacing: -0.2,
          }}
        >
          Share your Manual<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 14,
            fontStyle: "italic",
            lineHeight: 1.5,
            color: C.body,
          }}
        >
          A private PDF you control. Send to whoever you trust.
        </p>

        {/* Cover preview — a small mock of the PDF cover */}
        <div
          style={{
            marginTop: 20,
            padding: "24px 22px 22px",
            borderRadius: 12,
            background: "rgba(245,243,238,0.94)",
            border: "1px solid rgba(170,120,82,0.20)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.30)",
            color: "#161412",
          }}
        >
          <p style={{ margin: 0, fontSize: 9, letterSpacing: 2.2, textTransform: "uppercase", fontFamily: '"DM Mono", monospace', color: "rgba(22,20,18,0.55)" }}>
            mywalnut · a private manual
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: '"Instrument Serif", serif',
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: -0.4,
              color: "#161412",
            }}
          >
            Jeff Waters<span style={{ color: "rgb(140,90,55)" }}>.</span>
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 13,
              fontStyle: "italic",
              color: "rgba(22,20,18,0.65)",
            }}
          >
            14 entries · 5 layers · last edited Friday, May 9
          </p>
          <div style={{ height: 1, margin: "16px 0 14px", background: "rgba(22,20,18,0.14)" }} />
          {/* Layer count list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["I", "My Strengths", 1],
              ["II", "Some of my patterns", 4],
              ["III", "How I process things", 3],
              ["IV", "What helps", 4],
              ["V", "How I show up with people", 2],
            ].map(([num, name, count]) => (
              <div key={num as string} style={{ display: "flex", justifyContent: "space-between", fontFamily: '"Spectral", serif', fontSize: 12 }}>
                <span style={{ color: "rgba(22,20,18,0.78)" }}>
                  <span style={{ fontStyle: "italic", marginRight: 10, opacity: 0.7 }}>{num}</span>
                  {name}
                </span>
                <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: 1.4, color: "rgba(22,20,18,0.45)" }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action — generate + share */}
        <button
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 20,
            padding: "12px 0",
            borderBottom: `1px solid ${C.hero}`,
            fontFamily: '"DM Mono", monospace',
            fontSize: 12,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: C.hero,
          }}
        >
          <span>Generate PDF & share</span>
          <span aria-hidden="true">›</span>
        </button>

        {/* Cancel — quiet */}
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <span
            style={{
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 14,
              fontStyle: "italic",
              color: C.body,
            }}
          >
            cancel
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   5 · MANUAL — section headers as typography, expanding entry cards
// ═══════════════════════════════════════════════════════════════════
function Manual() {
  type Entry = {
    headline: string;
    body?: string;
    expanded?: boolean;
  };
  type LayerSection = {
    num: string;
    name: string;
    count: number;
    entries: Entry[];
  };
  const layers: LayerSection[] = [
    {
      num: "I",
      name: "Some of my patterns",
      count: 4,
      entries: [
        {
          headline: "Voice goes quiet on shifted plans",
          body: "When plans shift without warning, my voice is the first thing that goes quiet. Not because I have nothing to say — but because speech is where my regulation leaves.",
          expanded: true,
        },
        { headline: "Talking past the listener's attention" },
        { headline: "Pressure builds before the words" },
      ],
    },
    {
      num: "II",
      name: "How I process things",
      count: 3,
      entries: [
        { headline: "Writing holds contradiction" },
        { headline: "Specificity matters; I have to say it" },
      ],
    },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: C.ground, backgroundImage: C.bgManual, overflow: "hidden" }}>
      <StatusBar />
      <TopBar />

      <div style={{ position: "absolute", top: 122, left: 24, right: 24, zIndex: 5 }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.meta, fontFamily: '"DM Mono", monospace' }}>
          14 entries
        </p>
        <h2 style={{ margin: "6px 0 0", fontFamily: '"Instrument Serif", serif', fontSize: 30, fontWeight: 400, letterSpacing: -0.6, lineHeight: 1, color: C.hero }}>
          Your Manual<span style={{ color: C.walnut }}>.</span>
        </h2>
      </div>

      <div
        style={{
          position: "absolute",
          top: 200,
          left: 18,
          right: 18,
          bottom: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {layers.map((l, lIdx) => (
          <div key={l.num} style={{ marginTop: lIdx === 0 ? 4 : 22 }}>
            {/* Section header — typography only, no box */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingBottom: 8,
                paddingLeft: 4,
                paddingRight: 4,
                marginBottom: 10,
                borderBottom: "1px solid rgba(170,120,82,0.20)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "rgba(220,170,120,0.80)",
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                Layer {l.num} · {l.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                  color: C.meta,
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                {l.count}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {l.entries.map((e, i) => (
                <ExpandingEntryCard key={i} entry={e} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandingEntryCard({ entry }: { entry: { headline: string; body?: string; expanded?: boolean } }) {
  const isExpanded = entry.expanded === true;
  return (
    <div
      style={{
        padding: isExpanded ? "16px 18px 18px" : "14px 18px",
        borderRadius: 14,
        background: isExpanded ? C.walnutSurface : C.walnutSurfaceSoft,
        border: `1px solid ${isExpanded ? C.walnutBorder : C.walnutBorderSoft}`,
        backdropFilter: "blur(20px) saturate(135%)",
        WebkitBackdropFilter: "blur(20px) saturate(135%)",
        boxShadow: isExpanded ? "0 6px 24px rgba(0,0,0,0.20)" : "none",
        cursor: "pointer",
        transition: "background 0.2s, border 0.2s, padding 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: '"Spectral", "Source Serif 4", serif',
            fontSize: 16,
            fontWeight: isExpanded ? 500 : 400,
            color: C.hero,
            lineHeight: 1.4,
          }}
        >
          {entry.headline}<span style={{ color: C.walnut, fontWeight: 400 }}>.</span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: isExpanded ? C.walnut : "rgba(228,224,214,0.45)",
            fontSize: 13,
            transform: isExpanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        >
          ⌃
        </span>
      </div>

      {isExpanded && entry.body && (
        <>
          <p
            style={{
              margin: "12px 0 14px",
              fontFamily: '"Spectral", "Source Serif 4", serif',
              fontSize: 14.5,
              lineHeight: 1.62,
              color: C.body,
            }}
          >
            {entry.body}
          </p>
          <button
            style={{
              all: "unset",
              cursor: "pointer",
              fontFamily: '"DM Mono", monospace',
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: C.walnut,
              paddingBottom: 2,
              borderBottom: `1px solid ${C.walnut}`,
            }}
          >
            Explore further ›
          </button>
        </>
      )}
    </div>
  );
}

// ─── Pill composer ──────────────────────────────────────────────────
function PillComposer({ placeholder }: { placeholder: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 22,
        left: 16,
        right: 16,
        padding: "10px 14px",
        borderRadius: 999,
        background: C.walnutSurface,
        backdropFilter: "blur(32px) saturate(150%)",
        WebkitBackdropFilter: "blur(32px) saturate(150%)",
        border: `1px solid ${C.walnutBorder}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.40)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 10,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.40)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.78)",
          fontSize: 18,
          fontWeight: 300,
          lineHeight: 1,
        }}
      >
        +
      </span>
      <p
        style={{
          margin: 0,
          flex: 1,
          fontFamily: '"Spectral", "Source Serif 4", serif',
          fontStyle: "italic",
          fontSize: 15,
          color: C.body,
        }}
      >
        {placeholder}
      </p>
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.40)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </span>
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.40)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {[5, 10, 6, 12, 5].map((h, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 1.5,
              height: h,
              background: "rgba(255,255,255,0.7)",
              borderRadius: 1,
            }}
          />
        ))}
      </span>
    </div>
  );
}
