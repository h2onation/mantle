// sg-donts.jsx — §10 Do & don't

function DoDontCard({ verdict, note, children }) {
  const isDo = verdict === 'do';
  return (
    <figure style={{ margin: 0 }}>
      <div style={{
        background: isDo ? WT.linen : WT.linenDim,
        border: `1px solid ${isDo ? WT.sageFaint : WT.hairSoft}`,
        borderTop: `2px solid ${isDo ? WT.sage : WT.oxblood}`,
        padding: WT.sp.lg,
        minHeight: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isDo ? 1 : 0.88,
      }}>
        {children}
      </div>
      <figcaption style={{ paddingTop: WT.sp.sm, display: 'flex', gap: WT.sp.sm, alignItems: 'baseline' }}>
        <span style={{ ...WT.microCaps, color: isDo ? WT.sage : WT.oxblood, letterSpacing: 3 }}>
          {isDo ? 'DO' : "DON'T"}
        </span>
        <span style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.muted,
          lineHeight: 1.5,
        }}>{note}</span>
      </figcaption>
    </figure>
  );
}

function SGDontsReal() {
  return (
    <SGSection num="X" anchor="donts" tone="cream"
      title="Do & don't"
      lead="Small lessons from building the first nine screens. Not rules for their own sake — each one names a way the product loses its voice."
    >
      <SGGrid cols={2}>
        <DoDontCard verdict="do" note="Jove speaks in plain roman. The user's voice is italic, indented behind a sage rule.">
          <div style={{ width: 340 }}>
            <JoveBlock>Long in what way — full, or heavy?</JoveBlock>
            <UserBlock>heavy.</UserBlock>
          </div>
        </DoDontCard>
        <DoDontCard verdict="dont" note="Don't use speech bubbles, rounded fills, or avatar circles. They collapse the literary conceit into a messaging app.">
          <div style={{ width: 340 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: WT.muted2 }}/>
              <div style={{ background: '#E0D8C0', padding: '10px 14px', borderRadius: 16, fontFamily: WT.display, fontSize: 14, color: WT.ink, maxWidth: 240 }}>
                Long in what way — full, or heavy?
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ background: WT.sage, color: WT.linen, padding: '10px 14px', borderRadius: 16, fontFamily: WT.display, fontSize: 14, maxWidth: 200 }}>
                heavy.
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: WT.sage, opacity: 0.6 }}/>
            </div>
          </div>
        </DoDontCard>

        <DoDontCard verdict="do" note="One plate button per screen. Quiet choices become italic links.">
          <div style={{ display: 'flex', gap: WT.sp.xl, alignItems: 'center' }}>
            <PlateBtn label="begin the hour" arrow="›"/>
            <ItalicLink label="not tonight"/>
          </div>
        </DoDontCard>
        <DoDontCard verdict="dont" note="Don't use two plate buttons side-by-side. They compete, and the quiet is broken.">
          <div style={{ display: 'flex', gap: WT.sp.md, alignItems: 'center' }}>
            <PlateBtn label="begin" arrow="›"/>
            <PlateBtn label="skip" variant="sage"/>
          </div>
        </DoDontCard>

        <DoDontCard verdict="do" note="Rules hold the page together. A hairline says 'these belong with each other.'">
          <div style={{ width: 340 }}>
            <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.xs }}>CARE</div>
            <SettingsRow first label="Opening hour" trailing="edit"/>
            <SettingsRow label="Weekly review" toggle/>
          </div>
        </DoDontCard>
        <DoDontCard verdict="dont" note="Don't wrap rows in boxed cards with shadows. The book becomes a dashboard.">
          <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Opening hour', 'Weekly review'].map((t, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 12, padding: 14,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)',
                display: 'flex', justifyContent: 'space-between',
                fontFamily: WT.display, fontSize: 16, color: WT.ink,
              }}>{t}<span style={{ color: WT.muted2 }}>›</span></div>
            ))}
          </div>
        </DoDontCard>

        <DoDontCard verdict="do" note="The sage accent is used for one thing per screen — a focus state, a section dot, a kept mark.">
          <div style={{ width: 340 }}>
            <BottomBar current="hours"/>
          </div>
        </DoDontCard>
        <DoDontCard verdict="dont" note="Don't paint multiple things sage at once. The accent stops meaning anything.">
          <div style={{ width: 340 }}>
            <div style={{ background: WT.linen, borderTop: `1px solid ${WT.hair}`, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {['hours', 'manual', 'arrangement'].map((t, i) => (
                  <div key={i} style={{
                    ...WT.microCaps, fontSize: 10, letterSpacing: 2.4,
                    color: WT.sage, fontWeight: 500,
                  }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </DoDontCard>

        <DoDontCard verdict="do" note="A warning speaks in its own voice: oxblood top-rule, plain apology, a way forward.">
          <div style={{ width: 340 }}>
            <ErrorInline title="A LINE DROPPED" body="Your words are still here. We'll try again when you're ready." action="try again"/>
          </div>
        </DoDontCard>
        <DoDontCard verdict="dont" note="Don't use an emoji, a red pill badge, or a system alert dialog. The book doesn't have those.">
          <div style={{ width: 340 }}>
            <div style={{
              background: '#FFE5E0', border: '1px solid #E8B3A8', borderRadius: 10,
              padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
              fontFamily: WT.display, fontSize: 14, color: '#7A1F10',
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span>Error: Connection failed. Please retry.</span>
            </div>
          </div>
        </DoDontCard>
      </SGGrid>
    </SGSection>
  );
}

Object.assign(window, { SGDontsReal });
