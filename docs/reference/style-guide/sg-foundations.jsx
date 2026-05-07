// sg-foundations.jsx — §1 Foundations
// Palette · Typography · Spacing · Rules & ornaments · Glyphs

// ──────────────────────────────────────────────────────────────
// Color swatch — one color with its name, hex, and usage
// ──────────────────────────────────────────────────────────────
function Swatch({ name, hex, usage, tone = 'light', value }) {
  const bg = value || hex;
  const labelColor = tone === 'dark' ? WT.linen : WT.ink;
  return (
    <div style={{ border: `1px solid ${WT.hair}` }}>
      <div style={{
        height: 150, background: bg,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
        padding: WT.sp.sm,
      }}>
        <span style={{ ...WT.microCaps, color: labelColor, opacity: 0.62 }}>{name}</span>
      </div>
      <div style={{ padding: `${WT.sp.sm}px ${WT.sp.md}px`, background: WT.linen }}>
        <div style={{ fontFamily: WT.mono, fontSize: 12, color: WT.ink, fontWeight: 500 }}>{hex}</div>
        <div style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 14,
          color: WT.muted, lineHeight: 1.45, marginTop: 4,
        }}>{usage}</div>
      </div>
    </div>
  );
}

function PaletteSection() {
  return (
    <>
      <SGSubhead num="01.1" title="Palette" note="A warm, paper-bound palette. One accent only — sage — which carries all of the product's life."/>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 ${WT.sp.sm}px` }}>The canvas</div>
      <SGGrid cols={3} gap={WT.sp.sm}>
        <Swatch name="Linen"      hex="#FAF7F0" value={WT.linen}    usage="The page. Always-on canvas."/>
        <Swatch name="Linen Hi"   hex="#F4EEDF" value={WT.linenHi}  usage="Book plates, specimen cards."/>
        <Swatch name="Linen Dim"  hex="#EFE8D6" value={WT.linenDim} usage="Section bands, quiet separations."/>
      </SGGrid>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 ${WT.sp.sm}px` }}>The ink</div>
      <SGGrid cols={3} gap={WT.sp.sm}>
        <Swatch name="Ink"     tone="dark" hex="#161412" value={WT.ink}    usage="Headlines, Jove's voice, primary text."/>
        <Swatch name="Stone"   tone="dark" hex="#7A6E5C" value={WT.muted}  usage="Meta labels, captions, timestamps."/>
        <Swatch name="Dust"    hex="#A59A86" value={WT.muted2} usage="Inactive labels, the muted tab."/>
      </SGGrid>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 ${WT.sp.sm}px` }}>The accent — sage</div>
      <SGGrid cols={3} gap={WT.sp.sm}>
        <Swatch name="Sage"        tone="dark" hex="#5C6B4E" value={WT.sage}      usage="The period. Current state. One thing per screen."/>
        <Swatch name="Sage Soft"   hex="rgba(92,107,78,.50)" value={WT.sageSoft}  usage="Rule accents, underline emphasis."/>
        <Swatch name="Sage Faint"  hex="rgba(92,107,78,.14)" value={WT.sageFaint} usage="Selected backgrounds, checkbox fills."/>
      </SGGrid>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 ${WT.sp.sm}px` }}>Semantic — used sparingly</div>
      <SGGrid cols={2} gap={WT.sp.sm}>
        <Swatch name="Oxblood"  tone="dark" hex="#7A3B2E" value={WT.oxblood} usage="Errors. Destructive confirmations. Only when the user needs to slow down."/>
        <Swatch name="Amber"    tone="dark" hex="#9A6B2A" value={WT.amber}   usage="Warnings. 'In progress.' Quiet heads-ups."/>
      </SGGrid>

      <Annot>One accent. The sage period is the product's life-sign. Introduce a second accent only when the system has a <em>structural</em> need the current one can't carry — never for variety.</Annot>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Type scale
// ──────────────────────────────────────────────────────────────
function TypeSpecimen({ name, sample, size, style = {}, note, mono = false }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '200px 1fr 140px',
      alignItems: 'baseline', gap: WT.sp.md,
      padding: `${WT.sp.lg}px 0`,
      borderBottom: `1px solid ${WT.hairSoft}`,
    }}>
      <div>
        <div style={{ ...WT.microCaps, color: WT.sage }}>{name}</div>
        {note && (
          <div style={{
            fontFamily: WT.display, fontStyle: 'italic', fontSize: 14,
            color: WT.muted, marginTop: 4, lineHeight: 1.4,
          }}>{note}</div>
        )}
      </div>
      <div style={{
        fontFamily: mono ? WT.mono : WT.display, fontSize: size,
        color: WT.ink, ...style,
      }}>{sample}</div>
      <div style={{ fontFamily: WT.mono, fontSize: 11, color: WT.muted, textAlign: 'right' }}>
        {size}px
      </div>
    </div>
  );
}

function TypeSection() {
  return (
    <>
      <SGSubhead num="01.2" title="Typography" note="Two serif families and a mono. Instrument Serif for masthead and display — the bookish, slightly stylised face. Source Serif 4 for body and italic asides — a steadier, more readable text face. DM Mono for labels that mark and measure — never for reading."/>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 0` }}>Instrument Serif — display</div>
      <TypeSpecimen name="Display XL" size={84} style={{ fontFamily: WT.display, fontWeight: 400, letterSpacing: -1.4, lineHeight: 1.0 }}
                    sample="mywalnut." note="Masthead only. Never in-app."/>
      <TypeSpecimen name="Display L" size={52} style={{ fontFamily: WT.display, fontWeight: 400, letterSpacing: -0.8, lineHeight: 1.1 }}
                    sample="An Opening Hour" note="Section headers, ex libris plate."/>
      <TypeSpecimen name="Display M" size={34} style={{ fontFamily: WT.display, fontWeight: 400, letterSpacing: -0.3, lineHeight: 1.2 }}
                    sample="Today was hard and tender." note="Pull quotes, checkpoint titles."/>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 0` }}>Source Serif 4 — body</div>
      <TypeSpecimen name="Heading" size={22} style={{ fontFamily: WT.body, fontWeight: 500, lineHeight: 1.3 }}
                    sample="A steady hour, kept." note="Screen titles, settings rows."/>
      <TypeSpecimen name="Body" size={18} style={{ fontFamily: WT.body, fontWeight: 400, lineHeight: 1.65 }}
                    sample="Sit with me a while. Tell me, gently, what sort of day this has been." note="Jove's voice. Primary reading size."/>
      <TypeSpecimen name="Body italic" size={17.5} style={{ fontFamily: WT.body, fontWeight: 400, fontStyle: 'italic', lineHeight: 1.6 }}
                    sample="I'm tired of being the one who holds everything." note="The user's voice. Marginalia."/>
      <TypeSpecimen name="Caption" size={14} style={{ fontFamily: WT.body, fontWeight: 400, lineHeight: 1.5, color: WT.muted }}
                    sample="kept this morning at 6:12" note="Timestamps, attributions."/>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 0` }}>DM Mono — marking & measuring</div>
      <TypeSpecimen mono name="Micro Caps" size={10} style={{ letterSpacing: 2.2, textTransform: 'uppercase' }}
                    sample="OPENING HOUR · 07 MAY" note="Labels, section marks, metadata."/>
      <TypeSpecimen mono name="Micro Caps Lg" size={11} style={{ letterSpacing: 2.8, textTransform: 'uppercase' }}
                    sample="§ I · THE MANUAL" note="Periodical-style section marks."/>
      <TypeSpecimen mono name="Mono spec" size={12} style={{ fontWeight: 500 }}
                    sample="#FAF7F0 · 22px · 0.14" note="Only in this doc, never in-product."/>

      <Annot>Italic is a <em>sanctuary</em>. It's reserved for the user's voice and for quiet marginalia. Don't use it for emphasis inside Jove's blocks — that collapses the whole conceit.</Annot>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Spacing scale
// ──────────────────────────────────────────────────────────────
function SpacingRow({ name, value, note }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 80px 1fr 2fr',
      alignItems: 'center', gap: WT.sp.md,
      padding: `${WT.sp.sm}px 0`,
      borderBottom: `1px solid ${WT.hairSoft}`,
    }}>
      <div style={{ ...WT.microCaps, color: WT.sage }}>{name}</div>
      <div style={{ fontFamily: WT.mono, fontSize: 12, color: WT.ink, fontWeight: 500 }}>{value}px</div>
      <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
        <div style={{ height: 14, width: value, background: WT.sage, opacity: 0.85 }}/>
      </div>
      <div style={{
        fontFamily: WT.display, fontStyle: 'italic', fontSize: 15,
        color: WT.muted, lineHeight: 1.5,
      }}>{note}</div>
    </div>
  );
}

function SpacingSection() {
  return (
    <>
      <SGSubhead num="01.3" title="Spacing" note="A literary scale. Names, not numbers — so designers reach for meaning, not math."/>
      <div style={{ marginTop: WT.sp.md }}>
        <SpacingRow name="hair"  value={WT.sp.hair}  note="The rule. Hairline separators."/>
        <SpacingRow name="tight" value={WT.sp.tight} note="Inline — between glyph and label."/>
        <SpacingRow name="xs"    value={WT.sp.xs}    note="Within a cluster — wordmark and dot."/>
        <SpacingRow name="sm"    value={WT.sp.sm}    note="Between siblings — rows of meta."/>
        <SpacingRow name="md"    value={WT.sp.md}    note="Between ideas — paragraph to paragraph."/>
        <SpacingRow name="lg"    value={WT.sp.lg}    note="Between a label and its block."/>
        <SpacingRow name="xl"    value={WT.sp.xl}    note="Between sections of a plate."/>
        <SpacingRow name="xxl"   value={WT.sp.xxl}   note="Between document sections."/>
      </div>
      <Annot>Reach for the next size up, not the next one down. The product should feel like a book with wide margins, not a dashboard.</Annot>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Rules & ornaments
// ──────────────────────────────────────────────────────────────
function RulesSection() {
  return (
    <>
      <SGSubhead num="01.4" title="Rules & ornaments" note="The product is held together by lines — not cards, not shadows. A rule is worth a dozen boxes."/>

      <SGGrid cols={2} gap={WT.sp.md}>
        <Specimen caption="Hairline · 1px · 0.14 ink" padding={WT.sp.lg} height={64}>
          <div style={{ width: '100%' }}><Rule color={WT.hair}/></div>
        </Specimen>
        <Specimen caption="Soft hairline · 1px · 0.08 ink" padding={WT.sp.lg} height={64}>
          <div style={{ width: '100%' }}><Rule color={WT.hairSoft}/></div>
        </Specimen>
        <Specimen caption="Sage rule · 2px · accent" padding={WT.sp.lg} height={64}>
          <div style={{ width: '100%' }}><Rule weight={2} color={WT.sage}/></div>
        </Specimen>
        <Specimen caption="Double rule · periodical" padding={WT.sp.lg} height={64}>
          <div style={{ width: '100%' }}><DoubleRule color={WT.ink}/></div>
        </Specimen>
      </SGGrid>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.xl}px 0 ${WT.sp.sm}px` }}>Ornaments</div>
      <SGGrid cols={3} gap={WT.sp.md}>
        <Specimen caption="Walnut · the mark of the product" padding={WT.sp.lg} height={140}>
          <WalnutGlyph size={36} color={WT.sage}/>
        </Specimen>
        <Specimen caption="Fleuron · section breaks" padding={WT.sp.lg} height={140}>
          <Fleuron size={32}/>
        </Specimen>
        <Specimen caption="Diagonal lines · plates" padding={WT.sp.lg} height={140}>
          <div style={{
            width: 120, height: 80,
            background: diagonalLines('rgba(22,20,18,0.10)', 7),
            border: `1px solid ${WT.hair}`,
          }}/>
        </Specimen>
      </SGGrid>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Glyphs & icons
// ──────────────────────────────────────────────────────────────
// A tiny set of line glyphs drawn in the same pen as the walnut.
// Thin, round-capped strokes. Sparse. No fills.
function Glyph({ name, size = 20, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={WT.ink} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'inline-block' }}>
      {children}
    </svg>
  );
}

// A palette of recommended glyphs — thin, 1.4px stroke, round caps.
const GLYPHS = [
  { name: 'arrow',      svg: <><path d="M4 12h16"/><path d="M14 6l6 6-6 6"/></> },
  { name: 'chevron',    svg: <path d="M9 6l6 6-6 6"/> },
  { name: 'plus',       svg: <><path d="M12 5v14"/><path d="M5 12h14"/></> },
  { name: 'close',      svg: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></> },
  { name: 'check',      svg: <path d="M4 12l5 5 11-11"/> },
  { name: 'dot',        svg: <circle cx="12" cy="12" r="2" fill={WT.sage} stroke="none"/> },
  { name: 'book',       svg: <><path d="M4 5a2 2 0 012-2h14v16H6a2 2 0 01-2 2V5z"/><path d="M20 3v16"/></> },
  { name: 'quill',      svg: <><path d="M4 20l7-7"/><path d="M11 13L19 5a3 3 0 010 4l-8 8-4 1 1-5z"/></> },
  { name: 'leaf',       svg: <><path d="M20 4c-8 0-14 4-14 12a4 4 0 004 4c8 0 10-8 10-16z"/><path d="M10 14l6-6"/></> },
  { name: 'clock',      svg: <><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></> },
  { name: 'moon',       svg: <path d="M20 14A8 8 0 019 5a8 8 0 1011 9z"/> },
  { name: 'bookmark',   svg: <path d="M7 4h10v16l-5-4-5 4V4z"/> },
  { name: 'search',     svg: <><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></> },
  { name: 'menu',       svg: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></> },
  { name: 'more',       svg: <><circle cx="5" cy="12" r="1" fill={WT.ink}/><circle cx="12" cy="12" r="1" fill={WT.ink}/><circle cx="19" cy="12" r="1" fill={WT.ink}/></> },
  { name: 'ornament',   svg: <><path d="M12 4v16"/><path d="M8 8c2 0 4 2 4 4s-2 4-4 4"/><path d="M16 8c-2 0-4 2-4 4s2 4 4 4"/></> },
];

function GlyphsSection() {
  return (
    <>
      <SGSubhead num="01.5" title="Icons & glyphs" note="Thin pen, 1.4px stroke, round caps. Walnut and fleuron lead the family; the rest follow their weight."/>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: WT.sp.xs,
        marginTop: WT.sp.md,
      }}>
        {GLYPHS.map(g => (
          <div key={g.name} style={{
            border: `1px solid ${WT.hair}`, background: WT.linenHi,
            padding: WT.sp.md,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: WT.sp.xs,
            aspectRatio: '1 / 1', justifyContent: 'center',
          }}>
            <Glyph size={22}>{g.svg}</Glyph>
            <span style={{ ...WT.microCaps, fontSize: 9, color: WT.muted }}>{g.name}</span>
          </div>
        ))}
      </div>
      <Annot>If a glyph can be replaced by a word, prefer the word. Icons here are earned, not decorative.</Annot>
    </>
  );
}

// Export each sub-section so sg-app can mount them in order
function SGFoundations() {
  return (
    <SGSection
      num="I" anchor="foundations"
      title="Foundations"
      lead="The tokens that generate everything else. Colors, typography, spacing, rules, and the small set of glyphs that belong to this world."
    >
      <PaletteSection/>
      <TypeSection/>
      <SpacingSection/>
      <RulesSection/>
      <GlyphsSection/>
    </SGSection>
  );
}

Object.assign(window, { SGFoundations, Glyph, GLYPHS });
