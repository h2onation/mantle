// sg-component-states.jsx — §11 Interaction states
// Focus, hover, pressed, disabled, loading — applied to every primitive.

// ──────────────────────────────────────────────────────────────
// Focus ring spec
// ──────────────────────────────────────────────────────────────
function FocusSwatch({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: WT.sp.sm }}>
      <span style={{ ...WT.microCaps, color: WT.muted }}>{label}</span>
      {children}
    </div>
  );
}

// A reusable focused element — sage 2px ring, 3px offset, 0 radius
function focusRing(focused) {
  return focused ? {
    outline: `2px solid ${WT.sage}`,
    outlineOffset: 3,
  } : {};
}

// ──────────────────────────────────────────────────────────────
// Stateful buttons
// ──────────────────────────────────────────────────────────────
function StateBtnText({ state }) {
  const focused = state === 'focus';
  const muted   = state === 'disabled';
  return (
    <span style={{
      fontFamily: WT.display, fontSize: 18, fontStyle: 'italic',
      color: muted ? WT.muted2 : WT.ink,
      paddingBottom: 2,
      borderBottom: state === 'hover' || state === 'pressed' ? `1px solid ${WT.sage}` : `1px solid ${WT.hair}`,
      opacity: state === 'pressed' ? 0.7 : (muted ? 0.45 : 1),
      cursor: muted ? 'not-allowed' : 'pointer',
      ...focusRing(focused),
    }}>
      keep this <span style={{ marginLeft: 6 }}>›</span>
    </span>
  );
}

function StateBtnPlate({ state }) {
  const focused = state === 'focus';
  const muted   = state === 'disabled';
  return (
    <button style={{
      fontFamily: WT.mono, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase',
      padding: '12px 22px',
      background: state === 'hover' ? WT.ink : (state === 'pressed' ? '#000' : 'transparent'),
      color:      state === 'hover' || state === 'pressed' ? WT.linen : (muted ? WT.muted2 : WT.ink),
      border: `1px solid ${muted ? WT.hairSoft : WT.ink}`,
      borderRadius: 0, cursor: muted ? 'not-allowed' : 'pointer',
      opacity: muted ? 0.55 : 1,
      transform: state === 'pressed' ? 'translateY(1px)' : 'none',
      ...focusRing(focused),
    }}>
      BEGIN
    </button>
  );
}

function StateBtnDestructive({ state }) {
  const focused = state === 'focus';
  const muted   = state === 'disabled';
  return (
    <span style={{
      fontFamily: WT.display, fontSize: 16, fontStyle: 'italic',
      color: muted ? WT.muted2 : WT.oxblood,
      paddingBottom: 2,
      borderBottom: `1px solid ${state === 'hover' || state === 'pressed' ? WT.oxblood : WT.oxbloodSoft}`,
      opacity: state === 'pressed' ? 0.7 : 1,
      cursor: muted ? 'not-allowed' : 'pointer',
      ...focusRing(focused),
    }}>
      delete the manual
    </span>
  );
}

function StateBtnLoading() {
  return (
    <span style={{
      fontFamily: WT.display, fontSize: 18, fontStyle: 'italic', color: WT.muted,
      paddingBottom: 2, borderBottom: `1px solid ${WT.hair}`,
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      keeping
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite' }}/>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.18s' }}/>
        <span style={{ width: 3, height: 3, background: WT.sage, borderRadius: '50%', animation: 'mwPulse 1.2s infinite', animationDelay: '0.36s' }}/>
      </span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// Stateful input
// ──────────────────────────────────────────────────────────────
function StateField({ state }) {
  const focused = state === 'focus';
  const error   = state === 'error';
  const muted   = state === 'disabled';
  return (
    <div style={{ width: 320 }}>
      <div style={{
        ...WT.microCaps, color: error ? WT.oxblood : WT.muted,
        marginBottom: WT.sp.xs,
      }}>NAME</div>
      <input
        defaultValue={state === 'filled' || error ? 'Maren Keller' : ''}
        placeholder="your name"
        readOnly={muted}
        style={{
          width: '100%',
          fontFamily: WT.body, fontSize: 17, color: muted ? WT.muted2 : WT.ink,
          background: muted ? WT.linenDim : 'transparent',
          padding: '10px 0',
          border: 'none',
          borderBottom: `1px solid ${error ? WT.oxblood : (focused ? WT.sage : WT.hair)}`,
          borderBottomWidth: focused || error ? 2 : 1,
          outline: 'none',
          opacity: muted ? 0.6 : 1,
          cursor: muted ? 'not-allowed' : 'text',
        }}
      />
      {error && (
        <div style={{ ...WT.bodySm, color: WT.oxblood, fontStyle: 'italic', marginTop: WT.sp.xs }}>
          That name is already in the book.
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Stateful list row
// ──────────────────────────────────────────────────────────────
function StateRow({ state }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px',
      borderBottom: `1px solid ${WT.hair}`,
      background: state === 'pressed' ? WT.linenDim : (state === 'hover' ? WT.linenHi : 'transparent'),
      ...focusRing(state === 'focus'),
      cursor: 'pointer',
      width: 360,
    }}>
      <span style={{ fontFamily: WT.body, fontSize: 16, color: WT.ink }}>Notifications</span>
      <span style={{ ...WT.microCaps, color: WT.muted }}>QUIET</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Hit-target diagram
// ──────────────────────────────────────────────────────────────
function HitTargetDiagram() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.xl }}>
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        {/* Visual element 24px */}
        <div style={{
          position: 'absolute', top: 18, left: 18, width: 24, height: 24,
          border: `1.4px solid ${WT.ink}`, borderRadius: '50%',
        }}/>
        {/* Hit area 44px (dashed) */}
        <div style={{
          position: 'absolute', top: 8, left: 8, width: 44, height: 44,
          border: `1px dashed ${WT.sage}`, borderRadius: 4, pointerEvents: 'none',
        }}/>
      </div>
      <div>
        <div style={{ ...WT.microCaps, color: WT.muted }}>HIT TARGET</div>
        <div style={{ fontFamily: WT.display, fontSize: 17, color: WT.ink, marginTop: 4 }}>
          44 × 44 minimum, even when the visual element is smaller.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section
// ──────────────────────────────────────────────────────────────
const STATES = ['default','hover','focus','pressed','disabled'];

function StateGrid({ render }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      gap: WT.sp.lg, marginTop: WT.sp.md,
    }}>
      {STATES.map(s => (
        <FocusSwatch key={s} label={s}>{render(s)}</FocusSwatch>
      ))}
    </div>
  );
}

function SGComponentStates() {
  return (
    <SGSection num="XI" anchor="component-states"
      title="Interaction states"
      lead="The five states every primitive must support, the focus ring that ties them together, and the hit targets that make them tappable."
      tone="cream"
    >
      <SGSubhead num="11.1" title="Focus ring" note="A 2px sage outline, 3px offset, never a glow. Square corners. The same ring on every focusable thing — buttons, fields, rows, links."/>
      <Specimen label="focus ring spec" padding={WT.sp.xl} height={180}>
        <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.xl }}>
          <button style={{
            fontFamily: WT.mono, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase',
            padding: '12px 22px', background: 'transparent', color: WT.ink,
            border: `1px solid ${WT.ink}`, borderRadius: 0,
            outline: `2px solid ${WT.sage}`, outlineOffset: 3,
          }}>BEGIN</button>
          <div style={{ ...WT.bodySm, color: WT.muted, fontStyle: 'italic', maxWidth: 320 }}>
            Always visible on keyboard focus. Hidden on pointer focus via{' '}
            <code style={{ fontFamily: WT.mono, fontSize: 12, color: WT.ink }}>:focus-visible</code>.
          </div>
        </div>
      </Specimen>

      <SGSubhead num="11.2" title="Buttons — five states" note="Text buttons, plate buttons, and destructive buttons share the same state grammar. Loading is a sixth state used only when the action will take more than 200ms."/>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 0` }}>Text button</div>
      <Specimen label="" padding={WT.sp.lg} height={140}>
        <StateGrid render={(s) => <StateBtnText state={s}/>}/>
      </Specimen>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 0` }}>Plate button</div>
      <Specimen label="" padding={WT.sp.lg} height={160}>
        <StateGrid render={(s) => <StateBtnPlate state={s}/>}/>
      </Specimen>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 0` }}>Destructive</div>
      <Specimen label="" padding={WT.sp.lg} height={140}>
        <StateGrid render={(s) => <StateBtnDestructive state={s}/>}/>
      </Specimen>

      <div style={{ ...WT.microCapsLg, color: WT.ink, margin: `${WT.sp.lg}px 0 0` }}>Loading</div>
      <Specimen label="" padding={WT.sp.lg} height={120}><StateBtnLoading/></Specimen>

      <SGSubhead num="11.3" title="Fields — six states" note="Default, filled, focus (sage 2px bottom rule), error (oxblood with italic message), disabled, read-only."/>
      <SGGrid cols={3}>
        <Specimen label="default" padding={WT.sp.lg} align="top" height={140}><StateField state="default"/></Specimen>
        <Specimen label="filled"  padding={WT.sp.lg} align="top" height={140}><StateField state="filled"/></Specimen>
        <Specimen label="focus"   padding={WT.sp.lg} align="top" height={140}><StateField state="focus"/></Specimen>
        <Specimen label="error"   padding={WT.sp.lg} align="top" height={180}><StateField state="error"/></Specimen>
        <Specimen label="disabled"padding={WT.sp.lg} align="top" height={140}><StateField state="disabled"/></Specimen>
      </SGGrid>

      <SGSubhead num="11.4" title="List rows" note="Hover gets the next-warmer linen. Pressed darkens by one more step. Focus shows the same sage ring."/>
      <SGGrid cols={2}>
        <Specimen label="default" padding={WT.sp.lg} align="top" height={120}><StateRow state="default"/></Specimen>
        <Specimen label="hover"   padding={WT.sp.lg} align="top" height={120}><StateRow state="hover"/></Specimen>
        <Specimen label="focus"   padding={WT.sp.lg} align="top" height={120}><StateRow state="focus"/></Specimen>
        <Specimen label="pressed" padding={WT.sp.lg} align="top" height={120}><StateRow state="pressed"/></Specimen>
      </SGGrid>

      <SGSubhead num="11.5" title="Hit targets" note="The visible element can be as small as 24px, but the tappable area is always at least 44 × 44. Pad the gap with transparent space, never with visible chrome."/>
      <Specimen label="hit target" padding={WT.sp.xl} height={140}><HitTargetDiagram/></Specimen>

      <Annot>If you can't tab to it, you can't use it. Every primitive in this book must accept keyboard focus and show the sage ring.</Annot>
    </SGSection>
  );
}

Object.assign(window, { focusRing, SGComponentStates });
