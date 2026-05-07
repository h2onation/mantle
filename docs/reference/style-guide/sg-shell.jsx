// sg-shell.jsx — document-level chrome for the style guide.
// Periodical layout, single-column, generous breathing room.

const SG_WIDTH = 1080;   // main document column
const SG_COL   = 880;    // inner content column
const SG_PAD   = 64;     // side padding

// ──────────────────────────────────────────────────────────────
// Masthead — document header
// ──────────────────────────────────────────────────────────────
function SGMasthead({ version = 'v1', date = 'Vol. I · No. 1' }) {
  return (
    <header style={{
      maxWidth: SG_WIDTH, margin: '0 auto', padding: `${WT.sp.xxl}px ${SG_PAD}px ${WT.sp.xl}px`,
    }}>
      <div style={{ ...WT.microCapsLg, color: WT.muted, marginBottom: WT.sp.lg }}>
        {date} &nbsp;·&nbsp; Style Guide {version}
      </div>
      <DoubleRule color={WT.ink}/>
      <div style={{ padding: `${WT.sp.lg}px 0 ${WT.sp.xl}px` }}>
        <div style={{
          fontFamily: WT.display, fontSize: 92, lineHeight: 1, fontWeight: 400,
          letterSpacing: -2.2, color: WT.ink,
        }}>
          mywalnut<span style={{ color: WT.sage }}>.</span>
        </div>
        <div style={{
          fontFamily: WT.display, fontSize: 28, lineHeight: 1.3, fontStyle: 'italic',
          fontWeight: 300, color: WT.ink85, marginTop: WT.sp.md, maxWidth: 640,
        }}>
          A design system for a quiet companion.
          <br/>
          <span style={{ color: WT.muted }}>
            Tokens, components, patterns — and the reasoning behind each.
          </span>
        </div>
      </div>
      <DoubleRule color={WT.ink}/>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        ...WT.microCaps, color: WT.muted,
        padding: `${WT.sp.sm}px 0 0`,
      }}>
        <span>Mobile-first · Web</span>
        <span>Density · 3 of 10</span>
        <span>Compiled by hand</span>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────
// Section — numbered, periodical-style head + body
// ──────────────────────────────────────────────────────────────
function SGSection({ num, title, lead, children, anchor, tone = 'linen' }) {
  const bg = tone === 'cream' ? WT.linenHi : tone === 'dim' ? WT.linenDim : 'transparent';
  return (
    <section id={anchor} style={{
      background: bg,
      padding: `${WT.sp.xxl}px 0`,
      borderTop: `1px solid ${WT.hairSoft}`,
    }}>
      <div style={{ maxWidth: SG_WIDTH, margin: '0 auto', padding: `0 ${SG_PAD}px` }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: WT.sp.md, marginBottom: WT.sp.md,
        }}>
          <span style={{ ...WT.microCapsLg, color: WT.sage, whiteSpace: 'nowrap', flexShrink: 0 }}>§ {num}</span>
          <span style={{ flex: 1 }}><Rule color={WT.hair}/></span>
        </div>
        <h2 style={{
          fontFamily: WT.display, fontSize: 56, lineHeight: 1.05, fontWeight: 400,
          letterSpacing: -1.2, color: WT.ink, margin: 0,
        }}>{title}</h2>
        {lead && (
          <p style={{
            fontFamily: WT.display, fontSize: 20, lineHeight: 1.55, fontStyle: 'italic',
            fontWeight: 300, color: WT.ink85,
            marginTop: WT.sp.md, maxWidth: 640,
          }}>{lead}</p>
        )}
        <div style={{ marginTop: WT.sp.xl }}>
          {children}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Subsection head — smaller, numbered, in-flow
// ──────────────────────────────────────────────────────────────
function SGSubhead({ num, title, note }) {
  return (
    <div style={{ margin: `${WT.sp.xl}px 0 ${WT.sp.md}px` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: WT.sp.sm }}>
        <span style={{ ...WT.microCaps, color: WT.muted, flexShrink: 0 }}>{num}</span>
        <h3 style={{
          fontFamily: WT.display, fontSize: 28, lineHeight: 1.2, fontWeight: 400,
          letterSpacing: -0.4, color: WT.ink, margin: 0, flex: 1,
        }}>{title}</h3>
      </div>
      {note && (
        <p style={{
          fontFamily: WT.display, fontSize: 16, lineHeight: 1.55, fontStyle: 'italic',
          color: WT.muted, margin: `${WT.sp.xs}px 0 0`, maxWidth: 620,
        }}>{note}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Specimen — an inset card that frames a UI specimen for display.
// Cream plate; hairline border; optional caption strip at bottom.
// ──────────────────────────────────────────────────────────────
function Specimen({ children, caption, label, padding = WT.sp.xl, bg, height, align = 'center' }) {
  return (
    <figure style={{ margin: 0, marginBottom: WT.sp.lg }}>
      <div style={{
        background: bg || WT.linenHi,
        border: `1px solid ${WT.hair}`,
        padding: padding,
        minHeight: height,
        display: 'flex', alignItems: align === 'top' ? 'flex-start' : 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {label && (
          <div style={{
            position: 'absolute', top: 10, left: 14,
            ...WT.microCaps, color: WT.muted2,
            whiteSpace: 'nowrap',
          }}>{label}</div>
        )}
        {children}
      </div>
      {caption && (
        <figcaption style={{
          ...WT.microCaps, color: WT.muted,
          padding: `${WT.sp.xs}px 0 0`, borderTop: 'none',
          display: 'flex', gap: WT.sp.md,
        }}>
          <span style={{ color: WT.sage }}>—</span>
          <span style={{ letterSpacing: 2, textTransform: 'uppercase', fontFamily: WT.mono, fontSize: 10 }}>
            {caption}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

// ──────────────────────────────────────────────────────────────
// Prose — body text inside a section
// ──────────────────────────────────────────────────────────────
function SGProse({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: WT.display, fontSize: 17.5, lineHeight: 1.7, color: WT.ink85,
      maxWidth: SG_COL - 100, textWrap: 'pretty',
      ...style,
    }}>{children}</div>
  );
}

// A small labeled-value pair, stacked (for specs, measurements)
function SpecRow({ label, value, note }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: WT.sp.md,
      padding: `${WT.sp.sm}px 0`,
      borderBottom: `1px solid ${WT.hairSoft}`,
    }}>
      <span style={{ ...WT.microCaps, color: WT.muted, minWidth: 160 }}>{label}</span>
      <span style={{ fontFamily: WT.mono, fontSize: 13, color: WT.ink, fontWeight: 500 }}>{value}</span>
      {note && (
        <span style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.muted,
          flex: 1, textAlign: 'right',
        }}>{note}</span>
      )}
    </div>
  );
}

// Two-up or grid layout for specimen cards
function SGGrid({ children, cols = 2, gap = WT.sp.md }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap,
    }}>{children}</div>
  );
}

// Annotation — italic marginal note with a sage bullet
function Annot({ children }) {
  return (
    <p style={{
      fontFamily: WT.display, fontSize: 15, fontStyle: 'italic', lineHeight: 1.6,
      color: WT.muted, margin: `${WT.sp.sm}px 0`,
      paddingLeft: WT.sp.md,
      borderLeft: `2px solid ${WT.sageFaint}`,
    }}>
      <span style={{ color: WT.sage, marginRight: 8 }}>❦</span>
      {children}
    </p>
  );
}

Object.assign(window, { SGMasthead, SGSection, SGSubhead, Specimen, SGProse, SpecRow, SGGrid, Annot, SG_WIDTH, SG_COL, SG_PAD });
