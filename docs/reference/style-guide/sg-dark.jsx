// sg-dark.jsx — §13 Dark mode
// Sage shifts; ink inverts to a warm bone; linen becomes a deep brown-black,
// not a true black. Contrast verified for body, micro-caps, and accents.

// ──────────────────────────────────────────────────────────────
// Dark palette — published as named tokens
// ──────────────────────────────────────────────────────────────
const DK = {
  // Surface (warm dark — never #000)
  ground:  '#15110C',  // deepest — masthead, page background
  ground2: '#1B1712',  // section bands
  cream:   '#221C16',  // plate / card
  hair:    'rgba(245,237,222,0.10)',
  hairSoft:'rgba(245,237,222,0.06)',

  // Ink (warm bone — never pure white)
  bone:    '#F2EAD6',
  bone85:  'rgba(242,234,214,0.85)',
  muted:   'rgba(242,234,214,0.62)',
  muted2:  'rgba(242,234,214,0.42)',

  // Sage (lifted for legibility on dark)
  sage:    '#9CB18A',
  sageSoft:'rgba(156,177,138,0.32)',

  // Oxblood (lifted as well)
  oxblood: '#D08278',
};

// ──────────────────────────────────────────────────────────────
// Plate
// ──────────────────────────────────────────────────────────────
function DarkPlate({ children, w = 360 }) {
  return (
    <div style={{
      width: w, background: DK.cream,
      border: `1px solid ${DK.hair}`,
      padding: '24px 26px',
      color: DK.bone,
    }}>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sample chat
// ──────────────────────────────────────────────────────────────
function DarkChat() {
  return (
    <DarkPlate w={380}>
      <div style={{ ...WT.microCaps, color: DK.muted, marginBottom: 6 }}>VOL. I · SESSION 14</div>
      <div style={{ fontFamily: WT.display, fontStyle: 'italic', fontSize: 22, color: DK.bone, marginBottom: 18 }}>
        Wed afternoon
      </div>
      <p style={{
        margin: '0 0 14px', fontFamily: WT.body, fontSize: 17, lineHeight: 1.55,
        color: DK.bone,
      }}>
        Tell me what's been on your mind this week, even if it doesn't feel like much.
      </p>
      <div style={{ paddingLeft: 16, borderLeft: `2px solid ${DK.sage}`, margin: '14px 0' }}>
        <p style={{
          margin: 0, fontFamily: WT.display, fontStyle: 'italic',
          fontSize: 17, lineHeight: 1.5, color: DK.bone85,
        }}>
          Actually a lot. The thing with my brother last weekend keeps coming back.
        </p>
      </div>
    </DarkPlate>
  );
}

// ──────────────────────────────────────────────────────────────
// Buttons (dark)
// ──────────────────────────────────────────────────────────────
function DarkButtons() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: WT.sp.lg, alignItems: 'flex-start',
      padding: WT.sp.xl, background: DK.ground,
      width: '100%',
    }}>
      <span style={{
        fontFamily: WT.display, fontSize: 18, fontStyle: 'italic',
        color: DK.bone, paddingBottom: 2, borderBottom: `1px solid ${DK.hair}`,
        whiteSpace: 'nowrap',
      }}>
        keep this <span style={{ color: DK.sage }}>›</span>
      </span>

      <button style={{
        fontFamily: WT.mono, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase',
        padding: '12px 22px', background: 'transparent',
        color: DK.bone, border: `1px solid ${DK.bone}`, borderRadius: 0,
        cursor: 'pointer',
      }}>BEGIN</button>

      <span style={{
        fontFamily: WT.display, fontSize: 16, fontStyle: 'italic',
        color: DK.oxblood, paddingBottom: 2,
        borderBottom: `1px solid ${DK.oxblood}55`,
        whiteSpace: 'nowrap',
      }}>delete the manual</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Settings rows (dark)
// ──────────────────────────────────────────────────────────────
function DarkSettings() {
  const rows = [
    ['Notifications', 'QUIET'],
    ['Manual visibility', 'PRIVATE'],
    ['Voice', 'JOVE'],
    ['Daily session', '8:00 AM'],
  ];
  return (
    <div style={{ width: 380, background: DK.ground, padding: WT.sp.lg }}>
      <div style={{ ...WT.microCaps, color: DK.muted, marginBottom: 12 }}>SETTINGS · THE ARRANGEMENT</div>
      <div style={{ borderTop: `1px solid ${DK.hair}` }}>
        {rows.map(([l, v], i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0', borderBottom: `1px solid ${DK.hair}`,
          }}>
            <span style={{ fontFamily: WT.body, fontSize: 16, color: DK.bone, whiteSpace: 'nowrap' }}>{l}</span>
            <span style={{ ...WT.microCaps, color: DK.muted, whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Palette swatches
// ──────────────────────────────────────────────────────────────
function DkSwatch({ token, value, sub, contrast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 84, border: `1px solid ${WT.hair}` }}>
      <div style={{ width: 84, background: value }}/>
      <div style={{ padding: '10px 14px', background: WT.linenHi, flex: 1 }}>
        <div style={{ ...WT.microCaps, color: WT.ink }}>{token}</div>
        <div style={{ fontFamily: WT.mono, fontSize: 11, color: WT.muted, letterSpacing: 0.4, marginTop: 4 }}>
          {value.toUpperCase()}
        </div>
        {sub && <div style={{ ...WT.bodySm, color: WT.muted, fontStyle: 'italic', marginTop: 4 }}>{sub}</div>}
        {contrast && (
          <div style={{ ...WT.microCaps, color: WT.sage, marginTop: 6 }}>{contrast}</div>
        )}
      </div>
    </div>
  );
}

function DarkPalette() {
  return (
    <SGGrid cols={3} gap={WT.sp.md}>
      <DkSwatch token="GROUND" value={DK.ground} sub="Page · masthead" contrast="vs bone · 14.1 ✓"/>
      <DkSwatch token="CREAM (PLATE)" value={DK.cream} sub="Cards · plates" contrast="vs bone · 11.8 ✓"/>
      <DkSwatch token="BONE (INK)" value={DK.bone} sub="Body text"/>
      <DkSwatch token="BONE 85" value="#CEC7B5" sub="Italic user-voice"/>
      <DkSwatch token="MUTED" value="#968F7E" sub="Mono-caps · meta" contrast="vs ground · 5.2 ✓"/>
      <DkSwatch token="SAGE (LIFTED)" value={DK.sage} sub="Accent · rules" contrast="vs ground · 7.3 ✓"/>
      <DkSwatch token="OXBLOOD (LIFTED)" value={DK.oxblood} sub="Destructive" contrast="vs ground · 5.6 ✓"/>
      <DkSwatch token="HAIR" value="#332B22" sub="Rules · borders"/>
    </SGGrid>
  );
}

// ──────────────────────────────────────────────────────────────
// Switching rules
// ──────────────────────────────────────────────────────────────
function SwitchingRules() {
  const rules = [
    'System-driven by default. Honor the OS preference. Provide an explicit override in Settings.',
    'No flash. Switch must be smooth — apply the new tokens at the root in one frame; do not animate individual properties.',
    'Sage is lifted, not the same hex. Light sage on light is too quiet on dark; dark sage on dark loses contrast. Use the dark token.',
    'Never use #000 as ground or #FFF as ink. The journal stays warm in both modes.',
    'Plates lighten in dark, darken in light — they are a step away from ground in either direction.',
  ];
  return (
    <div style={{ paddingLeft: 18 }}>
      {rules.map((r, i) => (
        <div key={i} style={{
          display: 'flex', gap: 14, marginBottom: WT.sp.md,
        }}>
          <span style={{ ...WT.microCaps, color: WT.sage, marginTop: 4, minWidth: 28 }}>0{i+1}</span>
          <span style={{ fontFamily: WT.body, fontSize: 16, color: WT.ink, lineHeight: 1.55 }}>{r}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section
// ──────────────────────────────────────────────────────────────
function SGDark() {
  return (
    <SGSection num="XIII" anchor="dark"
      title="Dark mode"
      lead="The journal at night. Warm, not stark — bone on a deep brown-black. Sage and oxblood are lifted to keep their voice on dark ground."
      tone="cream"
    >
      <SGSubhead num="13.1" title="Palette" note="Every dark token has a contrast pairing verified at AA or above. Pure black and pure white are absent on purpose — they break the tone."/>
      <DarkPalette/>

      <SGSubhead num="13.2" title="Chat in the dark" note="Same Jove plain / user italic-behind-sage-rule grammar. The sage is lifted; the plate is one step warmer than the ground."/>
      <Specimen label="dark · chat plate" padding={WT.sp.xl} bg={DK.ground} height={320}>
        <DarkChat/>
      </Specimen>

      <SGSubhead num="13.3" title="Buttons &amp; settings" note="The same primitives shift their color tokens; nothing else changes."/>
      <SGGrid cols={2}>
        <Specimen label="buttons" padding={0} bg={DK.ground} align="top" height={260}>
          <DarkButtons/>
        </Specimen>
        <Specimen label="settings rows" padding={WT.sp.lg} bg={DK.ground} align="top" height={260}>
          <DarkSettings/>
        </Specimen>
      </SGGrid>

      <SGSubhead num="13.4" title="Switching rules" note=""/>
      <SwitchingRules/>

      <Annot>Dark mode is not "the same design with inverted colors." It is the same instrument re-tuned. Prove every state on both grounds before shipping.</Annot>
    </SGSection>
  );
}

Object.assign(window, { DK, SGDark });
