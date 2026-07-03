"use client";

import TopBar from "@/components/shared/TopBar";

interface ReflectionHeaderProps {
  // Mobile renders the wordmark (via TopBar); the desktop shell supplies its
  // own header, so it passes false and gets just the field + bar + message.
  showWordmark: boolean;
  // The reflection meter is gated (`reflection_meter`) and hidden in crisis;
  // when false this is a plain header with no bar, field, or message.
  meterVisible: boolean;
  // 0–100 capture-progress fill (latched to 100 at ready).
  fill: number;
  ready: boolean;
  composing: boolean;
  // First-session education: the one message you clear. Already gated on
  // !introSeen && !isAnonymous by the caller.
  showEducation: boolean;
  onBuild: () => void;
  onDismissEducation: () => void;
  error?: string | null;
}

// The pull-model reflection header. As the conversation deepens the bar fills;
// when a reflection is ready the header blooms into the deep field, and — the
// first time only — a message you clear grows below the bar. Once cleared, the
// colour alone carries the standing invitation. Tapping the header (any ready
// state) composes the reflection on demand. Replaced the old stacked meter +
// ready-strip + explainer on 2026-07-02.
export default function ReflectionHeader({
  showWordmark,
  meterVisible,
  fill,
  ready,
  composing,
  showEducation,
  onBuild,
  onDismissEducation,
  error,
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

      {buildable && (
        <button
          type="button"
          className="mw-rh-build"
          onClick={onBuild}
          aria-label="Build your reflection"
        />
      )}

      {showWordmark && (
        <div className="mw-rh-topbar">
          <TopBar />
        </div>
      )}

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
