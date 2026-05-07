// sg-nav.jsx — §4 Navigation
// A single pattern: 56px top strip (wordmark + menu + context) and a
// narrow three-tab bottom bar. No more options — the pattern is decided.

// ──────────────────────────────────────────────────────────────
// Navigation primitives
// ──────────────────────────────────────────────────────────────

// Top bar — wordmark + optional right meta + optional left glyph.
// Hairline rule beneath always. 56px tall.
function TopBar({ title, left, right, muted = false }) {
  return (
    <div style={{ background: WT.linen }}>
      <div style={{
        height: 56, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ width: 44, display: 'flex', alignItems: 'center' }}>
          {left}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {title ? (
            <div style={{ ...WT.microCaps, color: WT.muted }}>{title}</div>
          ) : (
            <Wordmark size={18} tone={muted ? 'muted' : 'ink'}/>
          )}
        </div>
        <div style={{ width: 44, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {right}
        </div>
      </div>
      <Rule color={WT.hair}/>
    </div>
  );
}

// Bottom bar — narrow strip, quiet mono labels, sage dot under current.
function BottomBar({ current = 'hours', items }) {
  const tabs = items || [
    { id: 'hours',       label: 'hours' },
    { id: 'manual',      label: 'manual' },
    { id: 'arrangement', label: 'arrangement' },
  ];
  return (
    <div style={{
      background: WT.linen,
      borderTop: `1px solid ${WT.hair}`,
      paddingBottom: 18, // safe area
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        padding: '8px 0 6px',
      }}>
        {tabs.map(t => {
          const active = t.id === current;
          return (
            <div key={t.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                ...WT.microCaps,
                fontSize: 9.5, letterSpacing: 2.2,
                color: active ? WT.ink : WT.muted2,
                fontWeight: active ? 500 : 400,
              }}>{t.label}</div>
              <div style={{
                width: 3, height: 3, borderRadius: '50%',
                background: active ? WT.sage : 'transparent',
              }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Drawer menu — summoned by tapping the menu glyph.
function DrawerMenu({ current = 'hours' }) {
  const items = [
    { id: 'hours',       label: 'the hours',       note: 'your sessions' },
    { id: 'manual',      label: 'the manual',      note: 'things kept' },
    { id: 'arrangement', label: 'the arrangement', note: 'settings & care' },
    { id: 'about',       label: 'about mywalnut',  note: 'colophon' },
  ];
  return (
    <div style={{
      background: WT.linen, height: '100%',
      padding: `${WT.sp.xl}px ${WT.sp.lg}px`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: WT.sp.xl }}>
        <Wordmark size={20}/>
        <Glyph size={20}><path d="M6 6l12 12"/><path d="M18 6L6 18"/></Glyph>
      </div>
      <Rule color={WT.hair} style={{ marginBottom: WT.sp.lg }}/>
      {items.map(i => (
        <div key={i.id} style={{
          display: 'grid', gridTemplateColumns: '1fr auto',
          alignItems: 'center', gap: WT.sp.sm,
          padding: `${WT.sp.md}px 0`,
          borderBottom: `1px solid ${WT.hairSoft}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: WT.display, fontSize: 20, fontWeight: 400, lineHeight: 1.2,
              color: i.id === current ? WT.ink : WT.muted,
              fontStyle: i.id === current ? 'normal' : 'italic',
              letterSpacing: -0.2,
            }}>{i.label}</div>
            <div style={{
              fontFamily: WT.display, fontStyle: 'italic', fontSize: 13,
              color: WT.muted2, marginTop: 4, lineHeight: 1.3,
            }}>{i.note}</div>
          </div>
          {i.id === current
            ? <span style={{ color: WT.sage, fontSize: 22, lineHeight: 1 }}>·</span>
            : <span style={{ width: 1 }}/>}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Phone-frame specimen — framed rectangle, not a device bezel.
// The style guide is a document, not a phone demo.
// ──────────────────────────────────────────────────────────────
function NavFrame({ children, label, note }) {
  return (
    <div>
      {label && (
        <div style={{ ...WT.microCapsLg, color: WT.ink, marginBottom: WT.sp.sm }}>
          {label}
        </div>
      )}
      <div style={{
        width: 380, height: 640,
        border: `1px solid ${WT.hair}`,
        background: WT.linen, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: WT.lift,
      }}>
        {children}
      </div>
      {note && (
        <p style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.muted,
          margin: `${WT.sp.sm}px 0 0`, lineHeight: 1.55, maxWidth: 380,
        }}>{note}</p>
      )}
    </div>
  );
}

// Generic mock content for the three homes
function HoursContent() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', padding: '24px 24px' }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.md }}>
        Opening Hour · 07 May
      </div>
      <div style={{ fontFamily: WT.display, fontSize: 17.5, lineHeight: 1.7, color: WT.ink85 }}>
        Sit with me a while. Tell me, gently, what sort of day this has been.
      </div>
      <div style={{ marginTop: WT.sp.lg, paddingLeft: WT.sp.md, borderLeft: `2px solid ${WT.sageFaint}` }}>
        <div style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 16, lineHeight: 1.6,
          color: WT.ink85,
        }}>
          it was long. I'm tired.
        </div>
      </div>
      <div style={{ marginTop: WT.sp.lg, fontFamily: WT.display, fontSize: 17.5, lineHeight: 1.7, color: WT.ink85 }}>
        Long in what way — full, or heavy?
      </div>
    </div>
  );
}

function ManualContent() {
  return (
    <div style={{ flex: 1, padding: '24px' }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.md }}>Table of contents</div>
      {['On tiredness', 'Chosen names', 'Small ceremonies', 'What you said about your mother', 'The quiet between'].map((t, i) => (
        <div key={i} style={{ padding: `${WT.sp.sm}px 0`, borderBottom: `1px solid ${WT.hairSoft}` }}>
          <div style={{ fontFamily: WT.display, fontSize: 17, color: WT.ink }}>{t}</div>
          <div style={{ fontFamily: WT.mono, fontSize: 10, letterSpacing: 2, color: WT.muted, marginTop: 4 }}>§ {i+1}</div>
        </div>
      ))}
    </div>
  );
}

function ArrangementContent() {
  const rows = [
    { label: 'Opening hour',   value: 'weekdays · 9am' },
    { label: "Jove's voice",   value: 'plain-spoken' },
    { label: 'Weekly review',  value: 'Sundays' },
    { label: 'Gentle nudges',  value: 'off' },
  ];
  return (
    <div style={{ flex: 1, padding: '24px' }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.md }}>Care</div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: `${WT.sp.md}px 0`,
          borderBottom: `1px solid ${WT.hairSoft}`,
        }}>
          <span style={{ fontFamily: WT.display, fontSize: 17, color: WT.ink }}>{r.label}</span>
          <span style={{ fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.muted }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// The pattern
// ──────────────────────────────────────────────────────────────

function SGNavReal() {
  const menuGlyph = <IconBtn label="menu"><Glyph size={20}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></Glyph></IconBtn>;
  const moreGlyph = <IconBtn label="more"><Glyph size={20}><circle cx="5" cy="12" r="1" fill={WT.muted}/><circle cx="12" cy="12" r="1" fill={WT.muted}/><circle cx="19" cy="12" r="1" fill={WT.muted}/></Glyph></IconBtn>;
  const searchGlyph = <IconBtn label="search"><Glyph size={18}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></Glyph></IconBtn>;

  return (
    <SGSection num="IV" anchor="navigation" tone="cream"
      title="Navigation"
      lead="A 56px top strip with the wordmark and a hairline beneath; a narrow three-tab bottom bar with quiet mono labels and a sage dot under the current home. That is the whole pattern."
    >
      <SGSubhead num="04.1" title="The chrome" note="Top strip is always present. Bottom bar carries the three persistent homes: hours, manual, arrangement. Nothing else goes in the bar — deeper destinations live in the drawer."/>

      <SGGrid cols={2} gap={WT.sp.lg}>
        <Specimen label="top strip" padding={WT.sp.lg} align="top" height={160}>
          <div style={{ width: 380 }}>
            <TopBar left={menuGlyph} right={moreGlyph}/>
          </div>
        </Specimen>
        <Specimen label="bottom bar" padding={WT.sp.lg} align="top" height={160}>
          <div style={{ width: 380 }}>
            <BottomBar current="hours"/>
          </div>
        </Specimen>
      </SGGrid>

      <SGSubhead num="04.2" title="The three homes" note="Same chrome; different content. The active tab gets a sage dot beneath — the smallest possible 'you are here.'"/>
      <SGGrid cols={3} gap={WT.sp.lg}>
        <NavFrame label="hours" note="Your sessions. The default home on open.">
          <TopBar left={menuGlyph} right={moreGlyph}/>
          <HoursContent/>
          <BottomBar current="hours"/>
        </NavFrame>
        <NavFrame label="manual" note="Things kept. Section title replaces the wordmark in the top strip.">
          <TopBar title="THE MANUAL" left={menuGlyph} right={searchGlyph}/>
          <ManualContent/>
          <BottomBar current="manual"/>
        </NavFrame>
        <NavFrame label="arrangement" note="Care & settings. The quietest of the three homes.">
          <TopBar title="THE ARRANGEMENT" left={menuGlyph} right={<span style={{ width: 44 }}/>}/>
          <ArrangementContent/>
          <BottomBar current="arrangement"/>
        </NavFrame>
      </SGGrid>

      <SGSubhead num="04.3" title="Drawer menu" note="Summoned from the menu glyph. Deeper navigation and account-level actions live here — not in the bottom bar."/>
      <SGGrid cols={3}>
        <NavFrame label="drawer — open" note="Stacked items with italic descriptors. Current item in ink; others in muted italic.">
          <DrawerMenu current="hours"/>
        </NavFrame>
      </SGGrid>

      <Annot>
        Three bottom tabs, not four. A four-tab bar is already a dashboard. If the product grows, the fourth home goes in the drawer, not the bar.
      </Annot>
    </SGSection>
  );
}

Object.assign(window, { TopBar, BottomBar, DrawerMenu, SGNavReal });
