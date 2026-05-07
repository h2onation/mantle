// sg-plates.jsx — §6 Book plates
// Framed objects: Ex Libris, Checkpoint, Entry, Section Starter.
// The Checkpoint is explicitly refined here — the nested sage border is gone;
// a new, quieter treatment takes its place.

// ──────────────────────────────────────────────────────────────
// Ex Libris — the session opening plate
// ──────────────────────────────────────────────────────────────
function ExLibris({ title = 'An Opening Hour', by = 'Fiona Bell', date = '7 May' }) {
  return (
    <div style={{
      background: WT.linenHi,
      border: `1px solid ${WT.hair}`,
      padding: `${WT.sp.xl}px ${WT.sp.lg}px`,
      textAlign: 'center', position: 'relative',
      backgroundImage: diagonalLines('rgba(22,20,18,0.04)', 9),
    }}>
      <div style={{ ...WT.microCapsLg, color: WT.muted, marginBottom: WT.sp.md }}>EX LIBRIS</div>
      <div style={{
        fontFamily: WT.display, fontSize: 36, fontWeight: 400, letterSpacing: -0.6,
        lineHeight: 1.15, color: WT.ink, marginBottom: WT.sp.sm,
      }}>{title}</div>
      <div style={{
        fontFamily: WT.display, fontSize: 17, fontStyle: 'italic',
        color: WT.muted, marginBottom: WT.sp.lg,
      }}>kept for {by}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: WT.sp.sm, marginBottom: WT.sp.sm }}>
        <div style={{ height: 1, width: 60, background: WT.hair }}/>
        <Fleuron size={14} color={WT.sage}/>
        <div style={{ height: 1, width: 60, background: WT.hair }}/>
      </div>
      <div style={{ ...WT.microCaps, color: WT.muted2, letterSpacing: 3 }}>
        {date}
      </div>
    </div>
  );
}

// Checkpoint — a STATEMENT the user wants to refer back to.
// A principle, not a quote. Lifted off the page with a warmer cream
// so it has presence without becoming a callout card.
function CheckpointPlate({ quote, date = '07 May' }) {
  return (
    <figure style={{
      background: '#F0E6CE',           // warmer cream — subtle lift from linen
      border: `1px solid rgba(92, 107, 78, 0.18)`,
      borderTop: `2px solid ${WT.sage}`,
      padding: `${WT.sp.xl}px ${WT.sp.xl}px ${WT.sp.lg}px`,
      margin: 0, position: 'relative',
      boxShadow: '0 1px 0 rgba(22,20,18,0.03), 0 10px 22px rgba(22,20,18,0.05)',
    }}>
      {/* Oversized opening quote, set in display, sage — the only ornament */}
      <span aria-hidden="true" style={{
        position: 'absolute', top: 6, left: 18,
        fontFamily: WT.display, fontStyle: 'italic',
        fontSize: 88, lineHeight: 1, color: WT.sage,
        opacity: 0.55, fontWeight: 400, userSelect: 'none',
      }}>“</span>

      <div style={{
        fontFamily: WT.display, fontSize: 24, lineHeight: 1.4,
        fontWeight: 400, color: WT.ink, letterSpacing: -0.2,
        textWrap: 'pretty', position: 'relative',
      }}>{quote}</div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: WT.sp.sm,
        marginTop: WT.sp.lg,
      }}>
        <div style={{ width: 32, height: 1, background: 'rgba(92, 107, 78, 0.4)' }}/>
        <span style={{ ...WT.microCaps, color: WT.muted, letterSpacing: 2.4 }}>
          KEPT · {date}
        </span>
      </div>
    </figure>
  );
}

// ──────────────────────────────────────────────────────────────
// Entry — an item in the manual, opened for reading
// ──────────────────────────────────────────────────────────────
function EntryPlate({ title, body, meta }) {
  return (
    <article style={{
      background: WT.linen, border: `1px solid ${WT.hair}`,
      padding: `${WT.sp.lg}px ${WT.sp.xl}px`,
    }}>
      <div style={{
        marginBottom: WT.sp.md,
      }}>
        <span style={{ ...WT.microCaps, color: WT.muted2 }}>{meta}</span>
      </div>
      <h3 style={{
        fontFamily: WT.display, fontSize: 28, fontWeight: 400,
        letterSpacing: -0.3, lineHeight: 1.2, margin: 0, color: WT.ink,
      }}>{title}</h3>
      <Rule color={WT.hairSoft} style={{ margin: `${WT.sp.md}px 0` }}/>
      <p style={{
        fontFamily: WT.display, fontSize: 17, lineHeight: 1.7, color: WT.ink85,
        margin: 0, textWrap: 'pretty',
      }}>{body}</p>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// Section starter — a full-width plate that opens a new section
// ──────────────────────────────────────────────────────────────
function SectionStarter({ chapter = 'THE THIRD CHAPTER', title = 'On tiredness', lede }) {
  return (
    <div style={{
      background: WT.linenDim,
      border: `1px solid ${WT.hair}`,
      padding: `${WT.sp.xxl}px ${WT.sp.lg}px`,
      textAlign: 'center',
    }}>
      <div style={{ ...WT.microCapsLg, color: WT.sage, marginBottom: WT.sp.md }}>
        {chapter}
      </div>
      <DoubleRule color={WT.ink} style={{ width: 120, margin: '0 auto' }}/>
      <h2 style={{
        fontFamily: WT.display, fontSize: 44, fontWeight: 400,
        letterSpacing: -0.8, lineHeight: 1.1, color: WT.ink,
        margin: `${WT.sp.md}px 0 ${WT.sp.sm}px`,
      }}>{title}</h2>
      {lede && (
        <p style={{
          fontFamily: WT.display, fontSize: 17, fontStyle: 'italic', lineHeight: 1.6,
          color: WT.muted, margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto',
        }}>{lede}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section assembly
// ──────────────────────────────────────────────────────────────
function SGPlatesReal() {
  return (
    <SGSection num="VI" anchor="plates" tone="cream"
      title="Book plates"
      lead="The framed objects in the product — each treated like a printed page lifted from a book. Ex libris opens a session; checkpoint marks a kept passage; entries live in the manual."
    >
      <SGSubhead num="06.1" title="Ex Libris — session opening" note="A dedicatory plate that names the hour and the reader. Diagonal linen behind for texture; a thin rule with a single sage fleuron marks the centre."/>
      <Specimen label="ex libris" padding={WT.sp.xl} align="top" height={480}>
        <div style={{ width: 480 }}>
          <ExLibris/>
        </div>
      </Specimen>

      <SGSubhead num="06.2" title="Checkpoint" note="A statement the user wants to return to — a principle kept. Warmer cream lifts it off the page; a sage top-rule marks it set aside; an oversized opening quote in sage is the only ornament. No numbering, no attribution — the statement is the thing."/>
      <Specimen label="checkpoint" padding={WT.sp.lg} align="top" height={320}>
        <div style={{ width: 560 }}>
          <CheckpointPlate
            quote="Today was hard and tender, and I tried anyway. That counts for something, even if no one sees it."
          />
        </div>
      </Specimen>
      <Specimen label="shorter statement" padding={WT.sp.lg} align="top" height={240}>
        <div style={{ width: 480 }}>
          <CheckpointPlate
            date="08 May"
            quote="I can be tired and still be present."
          />
        </div>
      </Specimen>

      <SGSubhead num="06.3" title="Entry — an item in the manual" note="Everything kept lives here, chronologically. An entry pairs a title with one paragraph of prose; longer passages get their own page."/>
      <Specimen label="entry" padding={WT.sp.lg} align="top" height={360}>
        <div style={{ width: 560 }}>
          <EntryPlate
            title="On tiredness that sleep won't reach"
            meta="KEPT · 07 MAY"
            body="When exhaustion isn't in the body, it's a thing the day put there. The answer isn't more sleep — it's a smaller day, or a hand held on the way through it. Name what you carried; don't try to carry less of it."
          />
        </div>
      </Specimen>

      <SGSubhead num="06.4" title="Section starter — opening a chapter of the manual" note="A full-width plate used once per chapter. Periodical-style double-rule; title in the large display; italic lede beneath."/>
      <Specimen label="section starter" padding={WT.sp.lg} align="top" height={400}>
        <div style={{ width: 640 }}>
          <SectionStarter
            chapter="THE THIRD CHAPTER"
            title="On tiredness"
            lede="Three passages on the kind that sleep does not reach, and what can be done instead."
          />
        </div>
      </Specimen>

      <Annot>A plate earns its frame by being something you'd keep. If it could be a paragraph of prose without losing meaning, it doesn't need a border.</Annot>
    </SGSection>
  );
}

Object.assign(window, { ExLibris, CheckpointPlate, EntryPlate, SectionStarter, SGPlatesReal });
