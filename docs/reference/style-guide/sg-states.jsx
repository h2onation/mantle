// sg-states.jsx — §9 Empty · loading · error · in-between

// ──────────────────────────────────────────────────────────────
// Empty plates
// ──────────────────────────────────────────────────────────────
function EmptyStatePlate({ title, body, action, secondary, ornament = 'fleuron' }) {
  return (
    <div style={{
      background: WT.linenHi, border: `1px solid ${WT.hair}`,
      padding: `${WT.sp.xl}px ${WT.sp.lg}px`,
      textAlign: 'center', maxWidth: 480,
    }}>
      {ornament === 'walnut' ? <WalnutGlyph size={22}/> : <Fleuron size={22}/>}
      <div style={{
        fontFamily: WT.display, fontSize: 22, fontWeight: 400, letterSpacing: -0.2,
        color: WT.ink, margin: `${WT.sp.md}px 0 ${WT.sp.xs}px`,
      }}>{title}</div>
      <p style={{
        fontFamily: WT.display, fontStyle: 'italic', fontSize: 16, lineHeight: 1.6,
        color: WT.muted, margin: 0, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
      }}>{body}</p>
      {action && (
        <div style={{ marginTop: WT.sp.lg, display: 'flex', gap: WT.sp.lg, justifyContent: 'center', alignItems: 'baseline' }}>
          <TextBtn label={action} arrow="›"/>
          {secondary && <span style={{ ...WT.bodySm, color: WT.muted }}>or <a style={{ color: WT.ink, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1 }}>{secondary}</a></span>}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Loading
// ──────────────────────────────────────────────────────────────
function LoadingLine({ label = 'composing' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.xs }}>
      <span style={{ ...WT.microCaps, color: WT.muted }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite' }}/>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.2s' }}/>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.4s' }}/>
      </span>
    </div>
  );
}

function SkeletonLines() {
  return (
    <div style={{ width: 380 }}>
      {[0.95, 0.88, 0.70].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w * 100}%`,
          background: WT.hairSoft, marginBottom: WT.sp.sm,
          animation: 'mwPulse 1.6s infinite',
          animationDelay: `${i * 0.15}s`,
        }}/>
      ))}
    </div>
  );
}

// A passage (italic + sage rule) being typed by Jove — three breathing dots
// rendered after the last line, in the same column as the user's voice.
function ComposingPassage() {
  return (
    <div style={{ paddingLeft: 22, borderLeft: `2px solid ${WT.sage}`, maxWidth: 460 }}>
      <p style={{
        fontFamily: WT.display, fontSize: 17, lineHeight: 1.6, fontStyle: 'italic',
        color: WT.ink, margin: 0,
      }}>
        I noticed you got quieter when she said that. What happened in the
        gap between her sentence and your answer
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, marginLeft: 6, verticalAlign: 'baseline' }}>
          <span style={{ width: 4, height: 4, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.4s infinite' }}/>
          <span style={{ width: 4, height: 4, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.4s infinite', animationDelay: '0.18s' }}/>
          <span style={{ width: 4, height: 4, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.4s infinite', animationDelay: '0.36s' }}/>
        </span>
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Autosave indicator — single mono line, ambient
// ──────────────────────────────────────────────────────────────
function AutosaveIndicator({ state = 'saved' }) {
  const map = {
    saving:  { dot: WT.muted2, label: 'KEEPING' },
    saved:   { dot: WT.sage,   label: 'KEPT' },
    offline: { dot: WT.oxblood,label: 'NOT YET KEPT' },
  };
  const m = map[state] || map.saved;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: m.dot,
        animation: state === 'saving' ? 'mwPulse 1.2s infinite' : 'none',
      }}/>
      <span style={{ ...WT.microCaps, color: WT.muted }}>{m.label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────────────────────
function ErrorInline({ title, body, action }) {
  return (
    <div style={{
      borderTop: `2px solid ${WT.oxblood}`,
      background: WT.oxbloodSoft,
      padding: `${WT.sp.md}px ${WT.sp.lg}px`,
      maxWidth: 480,
    }}>
      <div style={{ ...WT.microCaps, color: WT.oxblood, marginBottom: WT.sp.xs }}>{title}</div>
      <p style={{
        fontFamily: WT.display, fontSize: 16, lineHeight: 1.6, color: WT.ink, margin: 0,
      }}>{body}</p>
      {action && <div style={{ marginTop: WT.sp.sm }}><TextBtn label={action} arrow="↺" tone="danger"/></div>}
    </div>
  );
}

// Send failure — sits beneath the failed user passage, retries inline
function SendFailedPassage() {
  return (
    <div>
      <div style={{ paddingLeft: 22, borderLeft: `2px solid ${WT.oxblood}`, maxWidth: 460, opacity: 0.7 }}>
        <p style={{
          fontFamily: WT.display, fontSize: 17, lineHeight: 1.6, fontStyle: 'italic',
          color: WT.ink, margin: 0,
        }}>
          She was telling me about her promotion and I heard myself say
          "that's great" before I'd really listened.
        </p>
      </div>
      <div style={{ paddingLeft: 24, marginTop: 8, display: 'flex', gap: WT.sp.md, alignItems: 'baseline' }}>
        <span style={{ ...WT.microCaps, color: WT.oxblood }}>NOT SENT</span>
        <a style={{ ...WT.bodySm, color: WT.ink, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>try again</a>
        <a style={{ ...WT.bodySm, color: WT.muted, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>discard</a>
      </div>
    </div>
  );
}

// Offline banner — top-of-screen, persistent, never modal
function OfflineBanner() {
  return (
    <div style={{
      borderBottom: `1px solid ${WT.hair}`,
      background: WT.linenDim,
      padding: `${WT.sp.xs}px ${WT.sp.lg}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: WT.sp.md,
      maxWidth: 480,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: WT.muted2 }}/>
        <span style={{ ...WT.microCaps, color: WT.ink }}>NO LINE — JOVE WILL WAIT</span>
      </div>
      <a style={{ ...WT.bodySm, color: WT.muted, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>retry</a>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Rate limit / quota — soft, mono, small
// ──────────────────────────────────────────────────────────────
function RateLimitNote() {
  return (
    <div style={{
      border: `1px solid ${WT.hair}`, background: WT.linenHi,
      padding: WT.sp.md, maxWidth: 460,
    }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.xs }}>A SHORT PAUSE</div>
      <p style={{ fontFamily: WT.display, fontSize: 15.5, lineHeight: 1.55, color: WT.ink, margin: 0 }}>
        Jove has thought enough for now. The hour will resume in a minute or two.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section
// ──────────────────────────────────────────────────────────────
function SGStatesReal() {
  return (
    <SGSection num="IX" anchor="states"
      title="Empty · loading · error"
      lead="Absence is handled with grace, not apology. An empty page is an invitation; a loading moment is a pause in a sentence; an error is oxblood and calm."
    >
      <SGSubhead num="09.1" title="Empty states" note="Fleuron, short title, italic body — one sentence. Always ends with a way forward. Use the walnut mark only on the first-launch ex libris empty."/>
      <SGGrid cols={2}>
        <Specimen label="empty · first launch" padding={WT.sp.xl} align="top" height={360}>
          <EmptyStatePlate
            ornament="walnut"
            title="Nothing kept yet."
            body="The manual begins blank. When you sit down for an hour, what comes from it stays here — in your own hand."
            action="open the first hour"
          />
        </Specimen>
        <Specimen label="empty · a layer" padding={WT.sp.xl} align="top" height={360}>
          <EmptyStatePlate
            title="This layer is patient."
            body="Pattern lives below the surface. Keep talking with Jove, and shape will come."
            action="continue an hour"
            secondary="learn what this layer holds"
          />
        </Specimen>
        <Specimen label="empty · search" padding={WT.sp.xl} align="top" height={300}>
          <EmptyStatePlate
            title="Nothing matches that yet."
            body="Try a single word, or a phrase you remember saying."
            action="clear"
          />
        </Specimen>
        <Specimen label="empty · no hours kept" padding={WT.sp.xl} align="top" height={300}>
          <EmptyStatePlate
            title="No hours kept yet."
            body="Sit down when you're ready. There's no schedule to honor — only a door to open when it helps."
            action="open one now"
          />
        </Specimen>
      </SGGrid>

      <SGSubhead num="09.2" title="Loading" note="Three sage dots in a mono label. For longer waits, a hairline skeleton. Inside Jove's voice, the dots breathe at the end of the half-formed sentence."/>
      <SGGrid cols={2}>
        <Specimen label="composing" padding={WT.sp.xl} height={120}><LoadingLine label="composing"/></Specimen>
        <Specimen label="gathering" padding={WT.sp.xl} height={120}><LoadingLine label="gathering the manual"/></Specimen>
        <Specimen label="passage in progress" padding={WT.sp.xl} align="top" height={200}><ComposingPassage/></Specimen>
        <Specimen label="skeleton" padding={WT.sp.xl} align="top" height={200}><SkeletonLines/></Specimen>
      </SGGrid>

      <SGSubhead num="09.3" title="Autosave" note="Ambient mono line, never a toast. Three states: keeping (pulsing muted dot), kept (steady sage), not-yet-kept (steady oxblood)."/>
      <Specimen label="autosave states" padding={WT.sp.xl} height={140}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: WT.sp.md }}>
          <AutosaveIndicator state="saving"/>
          <AutosaveIndicator state="saved"/>
          <AutosaveIndicator state="offline"/>
        </div>
      </Specimen>

      <SGSubhead num="09.4" title="Errors" note="Oxblood top-rule, soft oxblood background. Mono caps for the label; plain roman for the apology. Always offers a way to try again."/>
      <SGGrid cols={2}>
        <Specimen label="connection slipped" padding={WT.sp.xl} align="top" height={220}>
          <ErrorInline
            title="A LINE DROPPED"
            body="Jove couldn't reach the page. Your words are still here — we can try again when you're ready."
            action="try again"
          />
        </Specimen>
        <Specimen label="save failed" padding={WT.sp.xl} align="top" height={220}>
          <ErrorInline
            title="NOT KEPT YET"
            body="The passage didn't make it to the manual. Nothing is lost — give it another moment."
            action="keep again"
          />
        </Specimen>
        <Specimen label="send failed (inline)" padding={WT.sp.xl} align="top" height={240}>
          <SendFailedPassage/>
        </Specimen>
        <Specimen label="rate limit · soft pause" padding={WT.sp.xl} align="top" height={200}>
          <RateLimitNote/>
        </Specimen>
      </SGGrid>

      <SGSubhead num="09.5" title="Offline" note="A single hairline banner at the top of the screen. Never modal, never red. The product still works — Jove just can't reach the page."/>
      <Specimen label="offline banner" padding={WT.sp.xl} height={100}>
        <OfflineBanner/>
      </Specimen>

      <Annot>The product should never shout at you. Errors are an inconvenience to explain gently, not an alarm. The most aggressive thing it ever does is turn a small dot oxblood.</Annot>
    </SGSection>
  );
}

Object.assign(window, {
  EmptyStatePlate, LoadingLine, SkeletonLines, ComposingPassage,
  AutosaveIndicator, ErrorInline, SendFailedPassage, OfflineBanner, RateLimitNote,
  SGStatesReal,
});
