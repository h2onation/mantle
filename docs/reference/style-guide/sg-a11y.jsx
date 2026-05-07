// sg-a11y.jsx — §14 Accessibility
// Contrast table, keyboard navigation, screen-reader voice, motion-reduction.

// ──────────────────────────────────────────────────────────────
// Contrast verification table
// ──────────────────────────────────────────────────────────────
const CONTRAST_ROWS = [
  { fg: '#1A1410', fgName: 'Ink #1A1410',     bg: '#FAF7F0', bgName: 'Linen',     ratio: '15.6', usage: 'Body, headings',      pass: 'AAA' },
  { fg: '#1A1410', fgName: 'Ink #1A1410',     bg: '#F4EEDF', bgName: 'Cream',     ratio: '14.0', usage: 'Body on plate',       pass: 'AAA' },
  { fg: 'rgba(26,20,16,0.62)', fgName: 'Muted', bg: '#FAF7F0', bgName: 'Linen', ratio: '6.8', usage: 'Mono-caps, meta',       pass: 'AA-large · AAA-norm' },
  { fg: '#5C6B4E', fgName: 'Sage #5C6B4E',     bg: '#FAF7F0', bgName: 'Linen',     ratio: '5.1', usage: 'Sage emphasis',       pass: 'AA' },
  { fg: '#5C6B4E', fgName: 'Sage #5C6B4E',     bg: '#F4EEDF', bgName: 'Cream',     ratio: '4.6', usage: 'Sage on plate',       pass: 'AA-large' },
  { fg: '#7A2218', fgName: 'Oxblood #7A2218',  bg: '#FAF7F0', bgName: 'Linen',     ratio: '8.9', usage: 'Destructive · errors',pass: 'AAA' },
  { fg: '#F2EAD6', fgName: 'Bone #F2EAD6',     bg: '#15110C', bgName: 'Ground (dark)', ratio: '14.1', usage: 'Body in dark',  pass: 'AAA' },
  { fg: '#9CB18A', fgName: 'Sage lifted',      bg: '#15110C', bgName: 'Ground (dark)', ratio: '7.3', usage: 'Sage on dark',   pass: 'AAA' },
  { fg: 'rgba(242,234,214,0.62)', fgName: 'Muted dark', bg: '#15110C', bgName: 'Ground', ratio: '5.2', usage: 'Mono-caps dark',pass: 'AA' },
];

function ContrastTable() {
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1.4fr 100px',
        gap: 0,
        ...WT.microCaps, color: WT.muted,
        padding: '10px 14px', borderBottom: `1px solid ${WT.ink}`,
      }}>
        <span>FOREGROUND</span><span>BACKGROUND</span><span>RATIO</span><span>USAGE</span><span style={{ textAlign: 'right' }}>WCAG</span>
      </div>
      {CONTRAST_ROWS.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1.4fr 100px',
          gap: 0, alignItems: 'center',
          padding: '12px 14px',
          borderBottom: `1px solid ${WT.hair}`,
          background: i % 2 ? WT.linenHi : 'transparent',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, background: r.fg, border: `1px solid ${WT.hair}` }}/>
            <span style={{ fontFamily: WT.body, fontSize: 14, color: WT.ink }}>{r.fgName}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, background: r.bg, border: `1px solid ${WT.hair}` }}/>
            <span style={{ fontFamily: WT.body, fontSize: 14, color: WT.ink }}>{r.bgName}</span>
          </span>
          <span style={{ fontFamily: WT.mono, fontSize: 12, color: WT.ink }}>{r.ratio}:1</span>
          <span style={{ fontFamily: WT.body, fontStyle: 'italic', fontSize: 14, color: WT.muted }}>{r.usage}</span>
          <span style={{ ...WT.microCaps, color: WT.sage, textAlign: 'right' }}>{r.pass}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Keyboard nav diagram — focus order on a session screen
// ──────────────────────────────────────────────────────────────
function KbDiagram() {
  // a phone-shaped diagram with numbered focus order overlays
  const nodes = [
    { n: 1, top:  72, left:  16, label: 'masthead · back' },
    { n: 2, top:  72, left: 280, label: 'masthead · menu' },
    { n: 3, top: 200, left: 130, label: 'transcript' },
    { n: 4, top: 460, left:  40, label: 'reply · primary' },
    { n: 5, top: 510, left:  40, label: 'reply · alternate' },
    { n: 6, top: 580, left:  40, label: 'composer field' },
    { n: 7, top: 580, left: 290, label: 'send' },
    { n: 8, top: 690, left:  60, label: 'tab · session' },
    { n: 9, top: 690, left: 170, label: 'tab · manual' },
    { n:10, top: 690, left: 280, label: 'tab · settings' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: WT.sp.xxl }}>
      {/* Phone frame */}
      <div style={{
        position: 'relative',
        width: 360, height: 760,
        background: WT.linenHi,
        border: `1px solid ${WT.ink}`,
        borderRadius: 36,
      }}>
        {/* Masthead */}
        <div style={{ position: 'absolute', top: 60, left: 18, right: 18, height: 32, borderBottom: `1px solid ${WT.hair}` }}/>
        {/* Tab bar */}
        <div style={{ position: 'absolute', bottom: 30, left: 18, right: 18, height: 50, borderTop: `1px solid ${WT.hair}` }}/>
        {/* Number pucks */}
        {nodes.map(nd => (
          <div key={nd.n} style={{
            position: 'absolute', top: nd.top, left: nd.left,
            width: 26, height: 26, borderRadius: '50%',
            border: `1.4px solid ${WT.sage}`,
            background: WT.linen,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: WT.mono, fontSize: 11, color: WT.sage,
          }}>{nd.n}</div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ minWidth: 220, paddingTop: 8 }}>
        <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: 12 }}>FOCUS ORDER</div>
        {nodes.map(nd => (
          <div key={nd.n} style={{
            display: 'flex', gap: 12, alignItems: 'baseline',
            padding: '7px 0', borderBottom: `1px solid ${WT.hair}`,
          }}>
            <span style={{ fontFamily: WT.mono, fontSize: 11, color: WT.sage, minWidth: 24 }}>0{nd.n}</span>
            <span style={{ fontFamily: WT.body, fontStyle: 'italic', fontSize: 14, color: WT.ink }}>{nd.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Screen-reader voice
// ──────────────────────────────────────────────────────────────
function SrRow({ visual, sr }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: WT.sp.lg, alignItems: 'center',
      padding: '14px 0', borderBottom: `1px solid ${WT.hair}`,
    }}>
      <div style={{ fontFamily: WT.body, fontSize: 16, color: WT.ink }}>{visual}</div>
      <div style={{
        fontFamily: WT.mono, fontSize: 12, color: WT.muted,
        background: WT.linenHi, padding: '10px 12px', borderRadius: 1,
      }}>{sr}</div>
    </div>
  );
}

function ScreenReaderTable() {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: WT.sp.lg,
        ...WT.microCaps, color: WT.muted,
        padding: '0 0 10px', borderBottom: `1px solid ${WT.ink}`,
      }}>
        <span>WHAT YOU SEE</span><span>WHAT THE SCREEN READER SAYS</span>
      </div>
      <SrRow visual="mywalnut. (logo)"        sr="mywalnut, the journal — link"/>
      <SrRow visual="keep this ›"             sr="keep this entry — button"/>
      <SrRow visual="› (arrow)"               sr="(silent — decorative)"/>
      <SrRow visual="Sage rule beside text"   sr="(silent — decorative)"/>
      <SrRow visual='Italic "actually a lot"' sr="actually a lot — your reply"/>
      <SrRow visual="‡ ornament"              sr="(silent — decorative)"/>
      <SrRow visual="11:47 (timestamp)"       sr="eleven forty-seven, today"/>
      <SrRow visual="DELETE THE MANUAL"       sr="delete the manual — destructive button"/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Motion reduction
// ──────────────────────────────────────────────────────────────
function MotionRules() {
  const rows = [
    ['Plate reveal',      'Fade + 8px lift', 'Instant fade (no lift)'],
    ['Page turn',         '420ms ease-out',  '0ms — replace'],
    ['Toast slide-up',    'Slide + fade',    'Fade only'],
    ['Loading dots',      'Pulse 1.2s loop', 'Static · "loading"'],
    ['Focus ring appear', 'No animation',    'No animation'],
  ];
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 0,
        ...WT.microCaps, color: WT.muted,
        padding: '10px 14px', borderBottom: `1px solid ${WT.ink}`,
      }}>
        <span>EVENT</span><span>DEFAULT</span><span>REDUCED-MOTION</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr',
          gap: 0, padding: '12px 14px',
          borderBottom: `1px solid ${WT.hair}`,
          background: i % 2 ? WT.linenHi : 'transparent',
        }}>
          <span style={{ fontFamily: WT.body, fontSize: 14, color: WT.ink }}>{r[0]}</span>
          <span style={{ fontFamily: WT.body, fontStyle: 'italic', fontSize: 14, color: WT.ink }}>{r[1]}</span>
          <span style={{ fontFamily: WT.body, fontStyle: 'italic', fontSize: 14, color: WT.sage }}>{r[2]}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section
// ──────────────────────────────────────────────────────────────
function SGA11y() {
  return (
    <SGSection num="XIV" anchor="a11y"
      title="Accessibility"
      lead="The contrast we've verified, the focus order on the highest-traffic screen, the voice the screen reader hears, and what changes when motion is reduced."
    >
      <SGSubhead num="14.1" title="Contrast — every committed pairing" note="Every token combination shipped in this guide passes WCAG AA at minimum. Most pass AAA."/>
      <ContrastTable/>

      <SGSubhead num="14.2" title="Focus order" note="Tab through any screen and the order should match how a person reads. Masthead first, content next, primary action, then chrome."/>
      <Specimen label="session — focus order" padding={WT.sp.xl} height={820}>
        <KbDiagram/>
      </Specimen>

      <SGSubhead num="14.3" title="Screen-reader voice" note="The journal's voice is the same on the page and in audio. Decorative chrome — sage rules, ornaments, arrows — stays silent."/>
      <ScreenReaderTable/>

      <SGSubhead num="14.4" title="Motion reduction" note="When prefers-reduced-motion is on, fades become instant cuts and slides become fades. The focus ring never animates anyway."/>
      <MotionRules/>

      <Annot>Accessibility is not a separate track. If a primitive doesn't pass these tests, it isn't shipped. Run the audit on every new component before it lands.</Annot>
    </SGSection>
  );
}

Object.assign(window, { SGA11y });
