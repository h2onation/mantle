// sg-overlays.jsx — §8 Modals, sheets, toasts

function Modal({ title, body, primary, secondary }) {
  return (
    <div style={{
      background: WT.linenHi, border: `1px solid ${WT.hair}`,
      width: 420, padding: `${WT.sp.xl}px ${WT.sp.lg}px`,
      boxShadow: WT.liftHi, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 14, right: 14,
      }}>
        <Glyph size={16}><path d="M6 6l12 12"/><path d="M18 6L6 18"/></Glyph>
      </div>
      <Fleuron size={16}/>
      <h3 style={{
        fontFamily: WT.display, fontSize: 26, fontWeight: 400,
        letterSpacing: -0.3, lineHeight: 1.2, margin: `${WT.sp.sm}px 0 ${WT.sp.sm}px`,
        color: WT.ink,
      }}>{title}</h3>
      <p style={{
        fontFamily: WT.display, fontSize: 16, lineHeight: 1.6, color: WT.ink85,
        margin: 0, textWrap: 'pretty',
      }}>{body}</p>
      <Rule color={WT.hairSoft} style={{ margin: `${WT.sp.lg}px 0 ${WT.sp.md}px` }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ItalicLink label={secondary || 'not yet'}/>
        <TextBtn label={primary || 'continue'} arrow="›"/>
      </div>
    </div>
  );
}

function Sheet({ title, children }) {
  return (
    <div style={{
      background: WT.linen, border: `1px solid ${WT.hair}`,
      width: 420, padding: `${WT.sp.lg}px ${WT.sp.lg}px ${WT.sp.xl}px`,
      boxShadow: WT.liftHi, position: 'relative',
    }}>
      {/* Handle */}
      <div style={{
        width: 40, height: 4, background: WT.hair, borderRadius: 2,
        margin: `0 auto ${WT.sp.md}px`,
      }}/>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.sm }}>{title}</div>
      {children}
    </div>
  );
}

function Toast({ kind = 'default', icon, children }) {
  const colorMap = {
    default: { bg: WT.ink,     fg: WT.linen,  mark: WT.sage },
    success: { bg: WT.ink,     fg: WT.linen,  mark: WT.sage },
    warn:    { bg: WT.amber,   fg: WT.linen,  mark: WT.linen },
    error:   { bg: WT.oxblood, fg: WT.linen,  mark: WT.linen },
  };
  const c = colorMap[kind];
  return (
    <div style={{
      background: c.bg, color: c.fg,
      padding: `${WT.sp.sm}px ${WT.sp.md}px`,
      display: 'inline-flex', alignItems: 'center', gap: WT.sp.sm,
      border: `1px solid ${c.bg}`,
      boxShadow: WT.lift,
      maxWidth: 420,
    }}>
      {icon && <span style={{ color: c.mark }}>{icon}</span>}
      <span style={{ fontFamily: WT.display, fontSize: 15, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function SGOverlaysReal() {
  return (
    <SGSection num="VIII" anchor="overlays" tone="cream"
      title="Modals · sheets · toasts"
      lead="Things that arrive and depart. Kept rare — a modal interrupts a book; a toast is a whisper, not an announcement."
    >
      <SGSubhead num="08.1" title="Modal" note="For decisive moments that require deliberate attention: closing an hour, forgetting a passage, signing out. Opens with a fleuron; always has an italic 'not yet' escape."/>
      <SGGrid cols={2}>
        <Specimen label="confirm" padding={WT.sp.xl} align="top" height={340}>
          <Modal
            title="Close the hour?"
            body="Nothing kept will be forgotten. We can pick it up again tomorrow, or the next time you sit down."
            primary="close gently"
            secondary="not yet"
          />
        </Specimen>
        <Specimen label="destructive" padding={WT.sp.xl} align="top" height={340}>
          <Modal
            title="Forget this passage?"
            body="It will be removed from the manual. The session it came from will stay, but this clipping will not."
            primary="forget"
            secondary="keep it"
          />
        </Specimen>
      </SGGrid>

      <SGSubhead num="08.2" title="Sheet — bottom-anchored" note="For in-flow choices: picking a time, expanding the composer. Slides up; a small handle marks it as dismissable."/>
      <SGGrid cols={2}>
        <Specimen label="sheet · choices" padding={WT.sp.xl} align="top" height={380}>
          <Sheet title="HOW LONG?">
            <OptionRow label="a quarter-hour" meta="15 min" kind="radio"/>
            <OptionRow label="half an hour"   meta="30 min" kind="radio" checked/>
            <OptionRow label="a full hour"    meta="60 min" kind="radio"/>
            <OptionRow label="as long as it takes" meta="open" kind="radio"/>
            <div style={{ marginTop: WT.sp.md, display: 'flex', justifyContent: 'flex-end' }}>
              <TextBtn label="keep" arrow="›"/>
            </div>
          </Sheet>
        </Specimen>
        <Specimen label="composer sheet" padding={WT.sp.xl} align="top" height={380}>
          <Sheet title="REPLY TO JOVE">
            <div style={{
              fontFamily: WT.display, fontSize: 17, fontStyle: 'italic', lineHeight: 1.7,
              color: WT.ink85, minHeight: 140,
            }}>
              today was full. not heavy. just — long. I kept thinking about the thing she didn't say.
            </div>
            <Rule color={WT.hair} style={{ margin: `${WT.sp.md}px 0` }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <ItalicLink label="set aside"/>
              <TextBtn label="send" arrow="›"/>
            </div>
          </Sheet>
        </Specimen>
      </SGGrid>

      <SGSubhead num="08.3" title="Toasts — a whisper" note="One line. Dismisses itself after ~4s. The success tone has a sage micro-dot; the error tone is oxblood."/>
      <SGGrid cols={2}>
        <Specimen label="kept" padding={WT.sp.xl} height={140}>
          <Toast kind="success" icon={<span style={{ fontSize: 14 }}>·</span>}>
            Kept to the manual.
          </Toast>
        </Specimen>
        <Specimen label="info" padding={WT.sp.xl} height={140}>
          <Toast kind="default" icon={<Fleuron size={12} color={WT.sage}/>}>
            Jove's away — I'll have this for you when you next sit down.
          </Toast>
        </Specimen>
        <Specimen label="warn" padding={WT.sp.xl} height={140}>
          <Toast kind="warn">
            Offline. Your words are saved locally.
          </Toast>
        </Specimen>
        <Specimen label="error" padding={WT.sp.xl} height={140}>
          <Toast kind="error">
            Something slipped. Try once more.
          </Toast>
        </Specimen>
      </SGGrid>

      <Annot>Overlays should feel like a letter arriving, not a notification system firing. If a toast could be said once, it should say less than that.</Annot>
    </SGSection>
  );
}

Object.assign(window, { Modal, Sheet, Toast, SGOverlaysReal });
