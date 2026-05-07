// sg-buttons.jsx — §2 Buttons
// In the journal idiom, most "buttons" are a line of text with a rule.
// A plate button exists for primary/marquee moments only.

// ──────────────────────────────────────────────────────────────
// Button primitives
// ──────────────────────────────────────────────────────────────

// Text button — mono-caps with an ink rule beneath.
// This is the workhorse. Use for 90% of actions.
function TextBtn({ label, arrow = '›', tone = 'ink', state = 'default', onClick }) {
  const disabled = state === 'disabled';
  const loading = state === 'loading';
  const hover   = state === 'hover';
  const color = disabled ? WT.muted2
    : tone === 'danger' ? WT.oxblood
    : tone === 'quiet'  ? WT.muted
    : WT.ink;
  const rule = disabled ? WT.hairSoft
    : tone === 'danger' ? WT.oxblood
    : tone === 'quiet'  ? WT.hair
    : WT.ink;
  return (
    <button onClick={disabled || loading ? undefined : onClick} style={{
      all: 'unset', cursor: disabled ? 'not-allowed' : loading ? 'wait' : 'pointer',
      display: 'inline-flex', alignItems: 'baseline', gap: WT.sp.xs,
      ...WT.microCaps, fontSize: 11, letterSpacing: 2.6,
      color, paddingBottom: 4, borderBottom: `1px solid ${rule}`,
      opacity: hover ? 0.65 : 1,
      whiteSpace: 'nowrap',
      transition: 'opacity 120ms',
    }}>
      <span>{loading ? 'working' : label}</span>
      {!loading && arrow && <span style={{ fontSize: 12, opacity: 0.85 }}>{arrow}</span>}
      {loading && (
        <span style={{ display: 'inline-flex', gap: 3 }}>
          <span style={{ width: 3, height: 3, background: color, borderRadius: '50%', animation: 'mwPulse 1.2s infinite' }}/>
          <span style={{ width: 3, height: 3, background: color, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.2s' }}/>
          <span style={{ width: 3, height: 3, background: color, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.4s' }}/>
        </span>
      )}
    </button>
  );
}

// Plate button — a thin-bordered ink rectangle with mono-caps inside.
// Reserved for marquee moments: "Begin", "Send to the manual", "Keep".
// Ink (filled) and Sage (outline) variants.
function PlateBtn({ label, variant = 'ink', arrow, size = 'md', state = 'default', onClick, full = false }) {
  const disabled = state === 'disabled';
  const hover    = state === 'hover';
  const pressed  = state === 'pressed';

  const pad = size === 'lg' ? '18px 28px' : size === 'sm' ? '10px 18px' : '14px 22px';
  const fs  = size === 'lg' ? 12 : size === 'sm' ? 10 : 11;
  const ls  = size === 'lg' ? 3.2 : 2.6;

  const filled = variant === 'ink';
  const bg = disabled ? 'transparent'
    : filled ? (pressed ? '#000' : hover ? '#2a2420' : WT.ink)
    : (hover ? WT.sageFaint : 'transparent');
  const fg = disabled ? WT.muted2
    : filled ? WT.linen
    : WT.sage;
  const border = disabled ? WT.hairSoft
    : filled ? WT.ink
    : WT.sage;

  return (
    <button onClick={disabled ? undefined : onClick} style={{
      all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
      display: full ? 'flex' : 'inline-flex',
      alignItems: 'center', justifyContent: 'center', gap: WT.sp.xs,
      padding: pad,
      fontFamily: WT.mono, fontSize: fs, letterSpacing: ls,
      textTransform: 'uppercase', fontWeight: 500,
      color: fg, background: bg,
      border: `1px solid ${border}`,
      width: full ? '100%' : 'auto',
      whiteSpace: 'nowrap',
      transition: 'background 120ms, color 120ms',
    }}>
      <span>{label}</span>
      {arrow && <span style={{ fontSize: fs + 1, opacity: 0.85 }}>{arrow}</span>}
    </button>
  );
}

// Italic link — quiet, marginal actions. "skip", "not now", "read more".
function ItalicLink({ label, tone = 'muted', onClick, state = 'default' }) {
  const hover = state === 'hover';
  const color = tone === 'sage' ? WT.sage : tone === 'ink' ? WT.ink : WT.muted;
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer',
      fontFamily: WT.display, fontSize: 16, fontStyle: 'italic',
      color, textDecoration: hover ? 'underline' : 'none',
      textUnderlineOffset: 4, textDecorationThickness: 1,
      whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

// Icon button — single glyph, generous hit area.
function IconBtn({ children, label, state = 'default' }) {
  const hover = state === 'hover';
  return (
    <button aria-label={label} style={{
      all: 'unset', cursor: 'pointer',
      width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: hover ? WT.ink : WT.muted,
      transition: 'color 120ms',
    }}>{children}</button>
  );
}

// ──────────────────────────────────────────────────────────────
// Specimens
// ──────────────────────────────────────────────────────────────

function ButtonSpec({ label, children }) {
  return (
    <Specimen label={label} height={120} padding={WT.sp.lg}>
      <div style={{ display: 'flex', gap: WT.sp.md, alignItems: 'center', flexWrap: 'wrap' }}>
        {children}
      </div>
    </Specimen>
  );
}

function SGButtonsReal() {
  return (
    <SGSection
      num="II" anchor="buttons" tone="cream"
      title="Buttons"
      lead="Most actions in the journal idiom are a line of mono-caps with a rule beneath. The plate button exists for marquee moments — beginning, keeping, closing."
    >
      <SGSubhead num="02.1" title="Text button — the workhorse" note="Mono-caps, 1px ink rule. The default action on almost every screen."/>
      <SGGrid cols={2}>
        <ButtonSpec label="default"><TextBtn label="begin"/></ButtonSpec>
        <ButtonSpec label="hover"><TextBtn label="begin" state="hover"/></ButtonSpec>
        <ButtonSpec label="quiet"><TextBtn label="skip for now" tone="quiet"/></ButtonSpec>
        <ButtonSpec label="disabled"><TextBtn label="begin" state="disabled"/></ButtonSpec>
        <ButtonSpec label="loading"><TextBtn label="begin" state="loading"/></ButtonSpec>
        <ButtonSpec label="destructive"><TextBtn label="forget this" tone="danger"/></ButtonSpec>
      </SGGrid>

      <SGSubhead num="02.2" title="Plate button — for beginnings and endings" note="Thin-bordered ink rectangle. Reserved for decisive moments. One per screen, ideally."/>
      <SGGrid cols={2}>
        <ButtonSpec label="ink · primary"><PlateBtn label="begin the hour" arrow="›"/></ButtonSpec>
        <ButtonSpec label="ink · large"><PlateBtn label="keep this for the manual" size="lg"/></ButtonSpec>
        <ButtonSpec label="sage · outline"><PlateBtn label="not yet" variant="sage"/></ButtonSpec>
        <ButtonSpec label="ink · hover"><PlateBtn label="begin the hour" state="hover"/></ButtonSpec>
        <ButtonSpec label="ink · pressed"><PlateBtn label="begin the hour" state="pressed"/></ButtonSpec>
        <ButtonSpec label="disabled"><PlateBtn label="begin the hour" state="disabled"/></ButtonSpec>
      </SGGrid>

      <SGSubhead num="02.3" title="Italic link — quiet actions" note="For marginal choices: skipping, excusing, setting aside. The link disappears on rest; it underlines on hover."/>
      <SGGrid cols={3}>
        <ButtonSpec label="default"><ItalicLink label="skip for now"/></ButtonSpec>
        <ButtonSpec label="hover"><ItalicLink label="skip for now" state="hover"/></ButtonSpec>
        <ButtonSpec label="sage"><ItalicLink label="read more from Jove" tone="sage"/></ButtonSpec>
      </SGGrid>

      <SGSubhead num="02.4" title="Icon button" note="A glyph alone. 44px hit area, 22px glyph. Used for menu, close, more — never invented for novelty."/>
      <div style={{ display: 'flex', gap: WT.sp.md }}>
        <Specimen label="menu" height={90} padding={WT.sp.md}>
          <IconBtn label="menu"><Glyph size={22}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></Glyph></IconBtn>
        </Specimen>
        <Specimen label="close" height={90} padding={WT.sp.md}>
          <IconBtn label="close"><Glyph size={22}><path d="M6 6l12 12"/><path d="M18 6L6 18"/></Glyph></IconBtn>
        </Specimen>
        <Specimen label="more" height={90} padding={WT.sp.md}>
          <IconBtn label="more"><Glyph size={22}><circle cx="5" cy="12" r="1" fill={WT.ink}/><circle cx="12" cy="12" r="1" fill={WT.ink}/><circle cx="19" cy="12" r="1" fill={WT.ink}/></Glyph></IconBtn>
        </Specimen>
        <Specimen label="search" height={90} padding={WT.sp.md}>
          <IconBtn label="search"><Glyph size={22}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></Glyph></IconBtn>
        </Specimen>
      </div>

      <SGSubhead num="02.5" title="Hierarchy — one plate per screen" note="If two plate buttons share a screen, one is wrong. Demote the secondary to a text button or an italic link."/>
      <Specimen label="correct" height={160} padding={WT.sp.xl}>
        <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.xl }}>
          <PlateBtn label="begin the hour" arrow="›"/>
          <ItalicLink label="not tonight"/>
        </div>
      </Specimen>
      <Specimen label="wrong — two plates compete" height={160} padding={WT.sp.xl}>
        <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.md, opacity: 0.75 }}>
          <PlateBtn label="begin" arrow="›"/>
          <PlateBtn label="skip" variant="sage"/>
        </div>
      </Specimen>
      <Annot>The primary action is a voice in the room. Two plates make two voices — so the user has to arbitrate, and the quiet is broken.</Annot>
    </SGSection>
  );
}

Object.assign(window, { TextBtn, PlateBtn, ItalicLink, IconBtn, SGButtonsReal });
