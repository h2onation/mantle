// sg-lists.jsx — §7 List rows
// Settings rows, TOC rows, entry rows.

function SettingsRow({ label, value, toggle, trailing, first = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: WT.sp.md,
      padding: `${WT.sp.md}px 0`,
      borderTop: first ? 'none' : `1px solid ${WT.hairSoft}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: WT.display, fontSize: 17, color: WT.ink }}>{label}</div>
        {value && typeof value === 'string' && !toggle && (
          <div style={{
            fontFamily: WT.display, fontStyle: 'italic', fontSize: 14,
            color: WT.muted, marginTop: 2,
          }}>{value}</div>
        )}
      </div>
      {toggle !== undefined && <Toggle on={toggle}/>}
      {trailing && (
        <div style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.muted,
        }}>{trailing}</div>
      )}
      {toggle === undefined && !trailing && <Glyph size={16}><path d="M9 6l6 6-6 6"/></Glyph>}
    </div>
  );
}

function TocRow({ title, meta, first = false }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: WT.sp.md, alignItems: 'baseline',
      padding: `${WT.sp.md}px 0`,
      borderTop: first ? 'none' : `1px solid ${WT.hairSoft}`,
    }}>
      <div style={{ fontFamily: WT.display, fontSize: 20, color: WT.ink, lineHeight: 1.3, fontWeight: 400 }}>{title}</div>
      <div style={{ ...WT.microCaps, color: WT.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{meta}</div>
    </div>
  );
}

function EntryRow({ title, excerpt, date, first = false }) {
  return (
    <div style={{
      display: 'flex', gap: WT.sp.md, alignItems: 'baseline',
      padding: `${WT.sp.md}px 0`,
      borderTop: first ? 'none' : `1px solid ${WT.hairSoft}`,
    }}>
      <div style={{ ...WT.microCaps, color: WT.muted2, minWidth: 56, whiteSpace: 'nowrap' }}>{date}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: WT.display, fontSize: 18, color: WT.ink, fontWeight: 500, lineHeight: 1.3 }}>{title}</div>
        <div style={{
          fontFamily: WT.body, fontStyle: 'italic', fontSize: 15,
          color: WT.muted, marginTop: 4, lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{excerpt}</div>
      </div>
    </div>
  );
}

function SGListsReal() {
  return (
    <SGSection num="VII" anchor="lists"
      title="List rows"
      lead="Rows stacked with hairlines between — never boxed. Three shapes: settings, a table of contents, and a manual entry preview."
    >
      <SGSubhead num="07.1" title="Settings row" note="Label left, value or toggle right. Optional italic hint beneath the label."/>
      <Specimen label="settings" padding={WT.sp.xl} align="top" height={360}>
        <div style={{ width: 480 }}>
          <SettingsRow first label="Opening hour" value="kept weekdays at 9am" trailing="edit"/>
          <SettingsRow label="Jove's voice" value="plain-spoken" trailing="change"/>
          <SettingsRow label="Weekly review" toggle={true}/>
          <SettingsRow label="Gentle nudges" toggle={false}/>
          <SettingsRow label="End-of-week summary" toggle={true}/>
        </div>
      </Specimen>

      <SGSubhead num="07.2" title="Table of contents" note="Title left, count of entries right — nothing else. The chapters speak for themselves; numbering them is noise."/>
      <Specimen label="TOC" padding={WT.sp.xl} align="top" height={360}>
        <div style={{ width: 560 }}>
          <TocRow first title="On tiredness"                meta="3 entries"/>
          <TocRow       title="Chosen names"                meta="1 entry"/>
          <TocRow       title="Small ceremonies"            meta="4 entries"/>
          <TocRow       title="What you said about your mother" meta="2 entries"/>
          <TocRow       title="The quiet between"           meta="1 entry"/>
        </div>
      </Specimen>

      <SGSubhead num="07.3" title="Entry row" note="A preview with an excerpt; tapping opens the entry plate. The date on the left is the only mark — it anchors the entry in time without numbering it."/>
      <Specimen label="entries" padding={WT.sp.lg} align="top" height={340}>
        <div style={{ width: 560 }}>
          <EntryRow first date="07 MAY"
            title="On tiredness that sleep won't reach"
            excerpt="When exhaustion isn't in the body, it's a thing the day put there. The answer isn't more sleep — it's a smaller day, or a hand held on the way through it."/>
          <EntryRow date="05 MAY"
            title="Chosen names"
            excerpt="A chosen name is still a true one. Treat the name she gives as the only one that matters when you're speaking to her."/>
          <EntryRow date="03 MAY"
            title="Small ceremonies"
            excerpt="Light the candle even on Tuesday. The ritual isn't for the occasion — it's for you."/>
        </div>
      </Specimen>
    </SGSection>
  );
}

Object.assign(window, { SettingsRow, TocRow, EntryRow, SGListsReal });
