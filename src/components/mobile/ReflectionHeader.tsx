"use client";

interface ReflectionHeaderProps {
  // The reflection meter is gated (`reflection_meter`) and hidden in crisis;
  // when false this is a plain header wrapper with no bar, field, or message.
  meterVisible: boolean;
  // 0–100 capture-progress fill (server value as-is — no snap-to-100 at ready).
  fill: number;
  ready: boolean;
  composing: boolean;
  // First-session education: the one message you clear. Computed once by
  // useReflection; passed through unchanged.
  showEducation: boolean;
  onBuild: () => void;
  onDismissEducation: () => void;
  // Whole-header tap-to-build overlay. Mobile only — on desktop the header row
  // holds interactive controls (FEEDBACK, the explicit Build button) a
  // full-cover overlay would swallow, so desktop passes false and offers an
  // explicit affordance instead.
  fullCoverTap: boolean;
  error?: string | null;
  // The header's top row: TopBar on mobile, the RoomHeader row on desktop.
  children: React.ReactNode;
}

// The pull-model reflection surface. As the conversation deepens the bar fills;
// when a reflection is ready the header blooms into the deep field and — the
// first session only — a message you clear grows below the bar. Once cleared,
// the colour alone carries the standing invitation. It wraps whatever the
// platform's header row is (`children`) so mobile and desktop share one
// treatment. Replaced the old stacked meter + ready-strip + explainer
// (2026-07-02); generalised to wrap the desktop RoomHeader (2026-07-03).
export default function ReflectionHeader({
  meterVisible,
  fill,
  ready,
  composing,
  showEducation,
  onBuild,
  onDismissEducation,
  fullCoverTap,
  error,
  children,
}: ReflectionHeaderProps) {
  const buildable = meterVisible && ready && !composing;
  const glow = ready ? 3 : 3 + (Math.max(0, Math.min(100, fill)) / 100) * 3;

  return (
    <div
      className="mw-rh"
      data-meter={meterVisible ? "true" : "false"}
      data-ready={ready ? "true" : "false"}
      data-composing={composing ? "true" : "false"}
      data-education={showEducation ? "true" : "false"}
    >
      {meterVisible && <div className="mw-rh-field" aria-hidden="true" />}

      {fullCoverTap && buildable && (
        <button
          type="button"
          className="mw-rh-build"
          onClick={onBuild}
          aria-label="Build your reflection"
        />
      )}

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

      <div className="mw-rh-teach" aria-live="polite">
        <div className="mw-rh-teach-inner">
          {composing ? (
            <p className="mw-rh-status">
              <span className="mw-rh-fl">&#10086;</span>Building your reflection&hellip;
            </p>
          ) : showEducation ? (
            <>
              <p className="mw-rh-teach-body">
                <em>Your reflection is ready.</em> Nothing enters your Manual
                unless you build it &mdash; build it when you&rsquo;re ready, or
                keep talking.
              </p>
              <button
                type="button"
                className="mw-rh-clear"
                onClick={onDismissEducation}
              >
                Got it
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error && <p className="mw-rh-error">{error}</p>}
    </div>
  );
}
