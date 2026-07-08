"use client";

interface ReflectionHeaderProps {
  // The reflection meter shows on web and is hidden in crisis; when false this
  // is a plain header wrapper with no bar, field, or pill.
  meterVisible: boolean;
  // 0–100 capture-progress fill (server value as-is — no snap-to-100 at ready).
  fill: number;
  ready: boolean;
  composing: boolean;
  // First-ever ready on this device: the pill wears the ember halo until the
  // user's first build. Computed once by useReflection; passed through.
  firstTime: boolean;
  onBuild: () => void;
  error?: string | null;
  // The header's top row: TopBar on mobile, the RoomHeader row on desktop.
  children: React.ReactNode;
}

// The pull-model reflection surface. As the conversation deepens the bar fills;
// when an entry is ready the header INVERTS (espresso in light mode, parchment
// in dark — the wordmark flips with it via the token remap in globals.css) and
// the build pill condenses onto the bar's edge — the ONE affordance, identical
// on mobile and desktop. Arrival is a one-shot animation (bloom → glow gathers → pill
// blooms and settles → one sheen), then still. It wraps whatever the
// platform's header row is (`children`) so mobile and desktop share one
// treatment. Replaced the invisible tap-anywhere overlay + expanding education
// band + GOT IT + desktop text button (2026-07-07); the one-time education now
// rides in Jove's landing message as a fixed server-appended sentence
// (FIRST_ENTRY_EDUCATION, appended in call-persona.ts — v0.8.3).
export default function ReflectionHeader({
  meterVisible,
  fill,
  ready,
  composing,
  firstTime,
  onBuild,
  error,
  children,
}: ReflectionHeaderProps) {
  // While composing the pill hides — the checkpoint overlay's building cover
  // is the sole signal for that moment.
  const showPill = meterVisible && ready && !composing;
  const glow = ready ? 3 : 3 + (Math.max(0, Math.min(100, fill)) / 100) * 3;

  return (
    <div
      className="mw-rh"
      data-meter={meterVisible ? "true" : "false"}
      data-ready={ready ? "true" : "false"}
    >
      {meterVisible && <div className="mw-rh-field" aria-hidden="true" />}

      <div className="mw-rh-topbar">{children}</div>

      {meterVisible && (
        <div
          className="mw-rh-bar"
          role="progressbar"
          aria-label="Understanding depth"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill)}
        >
          <div
            className="mw-rh-fill"
            style={
              {
                "--mw-fill": `${fill}%`,
                "--mw-glow": `${glow}px`,
              } as React.CSSProperties
            }
          />
        </div>
      )}

      {showPill && (
        <>
          <span className="mw-rh-pill-glow" aria-hidden="true" />
          <button
            type="button"
            className="mw-rh-pill"
            data-first={firstTime ? "true" : "false"}
            onClick={onBuild}
          >
            <span className="mw-rh-pill-fl" aria-hidden="true">
              &#10086;
            </span>
            <span className="mw-rh-pill-txt">Build Manual entry</span>
            <span className="mw-rh-pill-chev" aria-hidden="true">
              &#8250;
            </span>
            <span className="mw-rh-pill-sheen" aria-hidden="true" />
          </button>
        </>
      )}

      {error && <p className="mw-rh-error">{error}</p>}
    </div>
  );
}
