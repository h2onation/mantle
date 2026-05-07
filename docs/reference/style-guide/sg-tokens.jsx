// mywalnut — design tokens (v2 style guide — Quiet Journal accent)

const WT = {
  // Color
  linen:   '#FAF7F0',   // canvas — bone (from Atelier)
  linenHi: '#F4EEDF',   // plate background — cream, slightly deeper
  linenDim:'#EFE8D6',   // slightly deeper for section bands
  ink:     '#161412',   // near-black, warm
  ink85:   'rgba(22, 20, 18, 0.82)',
  ink60:   'rgba(22, 20, 18, 0.58)',
  muted:   '#7A6E5C',   // muted metadata — stone
  muted2:  '#A59A86',   // very muted — dust
  hair:    'rgba(22, 20, 18, 0.14)',
  hairSoft:'rgba(22, 20, 18, 0.08)',

  // THE accent — sage green, from Quiet Journal
  sage:    '#5C6B4E',
  sageSoft:'rgba(92, 107, 78, 0.5)',
  sageFaint:'rgba(92, 107, 78, 0.14)',
  sageBg:  'rgba(92, 107, 78, 0.06)',

  // Type
  display: '"Instrument Serif", "Source Serif 4", Georgia, serif',
  body:    '"Source Serif 4", Georgia, serif',
  mono:    '"DM Mono", ui-monospace, monospace',
  sans:    '"DM Sans", system-ui, sans-serif',

  // Type scales (small caps micro labels)
  microCaps:   { fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: 400 },
  microCapsLg: { fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11, letterSpacing: 2.8, textTransform: 'uppercase', fontWeight: 400 },

  // Spacing — a generous, literary scale (density: 3/10)
  // Use by name, not by number. Gaps between ideas are big.
  sp: {
    hair:   1,   // rule weight
    tight:  4,   // tight inline gap
    xs:     8,   // within a cluster
    sm:    14,   // between siblings
    md:    22,   // between ideas in a block
    lg:    34,   // between sections of a block
    xl:    56,   // between plate sections
    xxl:   88,   // between document sections
  },

  // Radii — almost-flat. Plates are square; only pills round.
  radius: { none: 0, xs: 2, sm: 4, pill: 999 },

  // Elevation — used sparingly. Paper lifts, not glass.
  lift:    '0 1px 0 rgba(22, 20, 18, 0.04), 0 8px 24px rgba(22, 20, 18, 0.06)',
  liftHi:  '0 1px 0 rgba(22, 20, 18, 0.05), 0 20px 56px rgba(22, 20, 18, 0.10)',

  // Semantic colors — reserved, used in narrow contexts
  oxblood: '#7A3B2E',  // errors, destructive
  oxbloodSoft: 'rgba(122, 59, 46, 0.08)',
  amber:   '#9A6B2A',  // warnings, "in progress"
  amberSoft: 'rgba(154, 107, 42, 0.08)',
};

// ──────────────────────────────────────────────────────────────
// Wordmark — mywalnut. (sage period), Newsreader
// ──────────────────────────────────────────────────────────────
function Wordmark({ size = 22, tone = 'ink', italic = false }) {
  const color = tone === 'muted' ? WT.muted : WT.ink;
  return (
    <span style={{
      fontFamily: WT.display,
      fontWeight: 400,
      fontSize: size,
      lineHeight: 1,
      color,
      letterSpacing: -0.5,
      fontStyle: italic ? 'italic' : 'normal',
    }}>
      mywalnut<span style={{ color: WT.sage }}>.</span>
    </span>
  );
}

// A thin dividing rule — the most-used element
function Rule({ weight = 1, color, style = {} }) {
  return (
    <div style={{
      height: weight,
      background: color || WT.hair,
      width: '100%',
      ...style,
    }}/>
  );
}

// Double-rule, for section heads (periodical-style)
function DoubleRule({ color, gap = 3, style = {} }) {
  const c = color || WT.hair;
  return (
    <div style={{ width: '100%', ...style }}>
      <div style={{ height: 1, background: c }}/>
      <div style={{ height: gap }}/>
      <div style={{ height: 1, background: c }}/>
    </div>
  );
}

// Diagonal line pattern — reserved for Ex Libris & Opening Hour
function diagonalLines(color = 'rgba(22,20,18,0.045)', gap = 7) {
  return `repeating-linear-gradient(-45deg, ${color} 0, ${color} 1px, transparent 1px, transparent ${gap}px)`;
}

// Walnut mark — Soft Wave A.
// Almond silhouette + central seam + one mirrored S-curve on each side.
// Reads quietly as a walnut without illustrating one. Used sparingly:
// section breaks, the Ex Libris plate, checkpoints, footers.
function WalnutGlyph({ size = 18, color, strokeWidth = 1.4 }) {
  const c = color || WT.sage;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <ellipse cx="12" cy="12.5" rx="7.5" ry="9" />
      <path d="M12 3.5v18" />
      <path d="M9.5 7c-.8 1.4-1.4 2.6-.6 3.8 0 0 1 1.2.4 2.6-.5 1.2-1.6 1.7-1.4 3.1.1 1 .8 1.5 1.4 1.8" />
      <path d="M14.5 7c.8 1.4 1.4 2.6.6 3.8 0 0-1 1.2-.4 2.6.5 1.2 1.6 1.7 1.4 3.1-.1 1-.8 1.5-1.4 1.8" />
    </svg>
  );
}

// Typographic ornament — used sparingly at section breaks
function Fleuron({ size = 14, color }) {
  return (
    <span style={{
      fontFamily: '"Newsreader", Georgia, serif',
      fontSize: size,
      color: color || WT.sage,
      lineHeight: 1,
      opacity: 0.75,
    }}>❦</span>
  );
}

Object.assign(window, { WT, diagonalLines, Wordmark, WalnutGlyph, Fleuron, Rule, DoubleRule });
