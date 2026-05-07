// sg-inputs.jsx — §3 Inputs & forms

function TextField({ label, placeholder, value, state = 'default', hint, error, multiline = false }) {
  const focus = state === 'focus';
  const filled = state === 'filled' || value;
  const disabled = state === 'disabled';
  const hasError = state === 'error' || error;

  const ruleColor = disabled ? WT.hairSoft
    : hasError ? WT.oxblood
    : focus ? WT.sage
    : WT.hair;
  const ruleWeight = focus || hasError ? 2 : 1;

  const textColor = disabled ? WT.muted2 : WT.ink;
  const placeColor = disabled ? WT.muted2 : WT.muted;

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {label && (
        <div style={{ ...WT.microCaps, color: hasError ? WT.oxblood : WT.muted, marginBottom: WT.sp.xs }}>
          {label}
        </div>
      )}
      {multiline ? (
        <div style={{
          position: 'relative', borderBottom: `${ruleWeight}px solid ${ruleColor}`,
          padding: `${WT.sp.xs}px 0 ${WT.sp.sm}px`,
        }}>
          <div style={{
            fontFamily: WT.display, fontSize: 17.5, lineHeight: 1.7,
            fontStyle: filled ? 'italic' : 'normal',
            color: filled ? textColor : placeColor,
            minHeight: 68,
          }}>
            {filled ? (value || "I'm tired of being the one who holds everything. I don't know how to ask for help without feeling like a burden.") : (placeholder || 'Write back to Jove…')}
            {focus && <span style={{
              display: 'inline-block', width: 1.5, height: 18, background: WT.sage,
              marginLeft: 2, verticalAlign: 'middle', animation: 'mwBlink 1s infinite',
            }}/>}
          </div>
        </div>
      ) : (
        <div style={{
          position: 'relative', borderBottom: `${ruleWeight}px solid ${ruleColor}`,
          padding: `${WT.sp.xs}px 0 ${WT.sp.xs}px`,
        }}>
          <div style={{
            fontFamily: WT.display, fontSize: 17.5,
            color: filled ? textColor : placeColor,
            fontStyle: filled ? 'normal' : 'italic',
          }}>
            {filled ? (value || 'Fiona Bell') : (placeholder || 'your name')}
            {focus && <span style={{
              display: 'inline-block', width: 1.5, height: 18, background: WT.sage,
              marginLeft: 2, verticalAlign: 'middle', animation: 'mwBlink 1s infinite',
            }}/>}
          </div>
        </div>
      )}
      {(hint || error) && (
        <div style={{
          fontFamily: WT.display, fontSize: 14, fontStyle: 'italic',
          color: hasError ? WT.oxblood : WT.muted,
          marginTop: WT.sp.xs, lineHeight: 1.5,
        }}>{error || hint}</div>
      )}
    </div>
  );
}

function Toggle({ on = false, disabled = false }) {
  const bg = disabled ? WT.hairSoft : on ? WT.sage : WT.hair;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      width: 36, height: 20, borderRadius: 10,
      background: bg, padding: 2,
      opacity: disabled ? 0.5 : 1,
      transition: 'background 150ms',
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%',
        background: WT.linen,
        transform: `translateX(${on ? 16 : 0}px)`,
        transition: 'transform 150ms',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}/>
    </span>
  );
}

function Radio({ checked = false, disabled = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%',
      border: `1.5px solid ${disabled ? WT.hairSoft : checked ? WT.sage : WT.hair}`,
      opacity: disabled ? 0.5 : 1,
    }}>
      {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: WT.sage }}/>}
    </span>
  );
}

function Checkbox({ checked = false, disabled = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18,
      border: `1.5px solid ${disabled ? WT.hairSoft : checked ? WT.sage : WT.hair}`,
      background: checked ? WT.sage : 'transparent',
      opacity: disabled ? 0.5 : 1,
    }}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={WT.linen} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l5 5 11-11"/>
        </svg>
      )}
    </span>
  );
}

function Select({ label, value, placeholder, state = 'default' }) {
  const focus = state === 'focus';
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {label && <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.xs }}>{label}</div>}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `${focus ? 2 : 1}px solid ${focus ? WT.sage : WT.hair}`,
        padding: `${WT.sp.xs}px 0`,
      }}>
        <span style={{
          fontFamily: WT.display, fontSize: 17.5,
          color: value ? WT.ink : WT.muted,
          fontStyle: value ? 'normal' : 'italic',
        }}>{value || placeholder}</span>
        <Glyph size={16}><path d="M6 9l6 6 6-6"/></Glyph>
      </div>
    </div>
  );
}

function OptionRow({ label, meta, checked, kind = 'radio', onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: WT.sp.sm,
      padding: `${WT.sp.sm}px 0`,
      borderBottom: `1px solid ${WT.hairSoft}`,
      cursor: 'pointer',
    }}>
      {kind === 'radio' ? <Radio checked={checked}/> : <Checkbox checked={checked}/>}
      <span style={{ flex: 1, fontFamily: WT.display, fontSize: 16, color: WT.ink }}>{label}</span>
      {meta && <span style={{ ...WT.microCaps, color: WT.muted }}>{meta}</span>}
    </div>
  );
}

function SGInputsReal() {
  return (
    <SGSection num="III" anchor="inputs"
      title="Inputs & forms"
      lead="The user writes into a book. Every input is a rule under a line of type — no rounded rectangles, no fills, no shadows."
    >
      <SGSubhead num="03.1" title="Text field" note="Hairline rule beneath. Focus thickens the rule to 2px sage. Placeholder is italic muted — the same way a journal prompts you."/>
      <SGGrid cols={2}>
        <Specimen label="default" height={160} padding={WT.sp.lg} align="top"><TextField label="your name"/></Specimen>
        <Specimen label="filled" height={160} padding={WT.sp.lg} align="top"><TextField label="your name" state="filled" value="Fiona Bell"/></Specimen>
        <Specimen label="focus" height={160} padding={WT.sp.lg} align="top"><TextField label="your name" state="focus"/></Specimen>
        <Specimen label="error" height={160} padding={WT.sp.lg} align="top"><TextField label="your name" state="error" value="" error="a name, even a chosen one, will do."/></Specimen>
        <Specimen label="disabled" height={160} padding={WT.sp.lg} align="top"><TextField label="your name" state="disabled" value="Fiona Bell"/></Specimen>
        <Specimen label="hinted" height={160} padding={WT.sp.lg} align="top"><TextField label="your name" hint="only you will see it."/></Specimen>
      </SGGrid>

      <SGSubhead num="03.2" title="Textarea (composer)" note="The composer is inline by default, three lines tall, growing as you write. Tapping expands it to a full-screen sheet for longer passages."/>
      <SGGrid cols={2}>
        <Specimen label="empty" height={200} padding={WT.sp.lg} align="top"><TextField multiline placeholder="Write back to Jove…"/></Specimen>
        <Specimen label="writing" height={200} padding={WT.sp.lg} align="top"><TextField multiline state="filled"/></Specimen>
      </SGGrid>

      <SGSubhead num="03.3" title="Toggle, radio, checkbox" note="All filled with sage when on. Never invented shapes; never fancy animations."/>
      <SGGrid cols={3}>
        <Specimen label="toggle · off" height={100}><Toggle/></Specimen>
        <Specimen label="toggle · on" height={100}><Toggle on/></Specimen>
        <Specimen label="toggle · disabled" height={100}><Toggle on disabled/></Specimen>
        <Specimen label="radio · off" height={100}><Radio/></Specimen>
        <Specimen label="radio · on" height={100}><Radio checked/></Specimen>
        <Specimen label="checkbox" height={100}><div style={{ display: 'flex', gap: WT.sp.md }}><Checkbox/><Checkbox checked/></div></Specimen>
      </SGGrid>

      <SGSubhead num="03.4" title="Select & option rows" note="A select is a field with a small chevron. Option rows stack with hairlines between — never boxed."/>
      <SGGrid cols={2}>
        <Specimen label="select · default" height={140} padding={WT.sp.lg} align="top">
          <Select label="how long, most hours?" placeholder="choose an hour…"/>
        </Specimen>
        <Specimen label="select · focus" height={140} padding={WT.sp.lg} align="top">
          <Select label="how long, most hours?" value="a quarter-hour" state="focus"/>
        </Specimen>
      </SGGrid>
      <Specimen label="option list — radio" height={260} padding={WT.sp.lg} align="top">
        <div style={{ width: 420 }}>
          <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.sm }}>how long, most hours?</div>
          <OptionRow label="a quarter-hour" meta="15 min" kind="radio"/>
          <OptionRow label="half an hour"   meta="30 min" kind="radio" checked/>
          <OptionRow label="a full hour"    meta="60 min" kind="radio"/>
          <OptionRow label="as long as it takes" meta="open" kind="radio"/>
        </div>
      </Specimen>

      <Annot>A focused input turns its rule sage. That single cue is the whole focus state — no haloes, no fills, no shadows.</Annot>
    </SGSection>
  );
}

Object.assign(window, { TextField, Toggle, Radio, Checkbox, Select, OptionRow, SGInputsReal });
