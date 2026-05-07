// sg-chat.jsx — §5 Chat primitives
// The core medium of the product: Jove's voice, the user's voice, replies, composer.

// ──────────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────────

// Jove block — plain roman, flush-left, primary voice
function JoveBlock({ children, time, first = false }) {
  return (
    <div style={{
      padding: first ? 0 : `${WT.sp.md}px 0 0`,
    }}>
      {first && (
        <div style={{ ...WT.microCaps, color: WT.sage, marginBottom: WT.sp.xs }}>
          Jove
        </div>
      )}
      <div style={{
        fontFamily: WT.body, fontSize: 18, lineHeight: 1.65, fontWeight: 400,
        color: WT.ink, textWrap: 'pretty',
      }}>
        {children}
      </div>
      {time && (
        <div style={{
          fontFamily: WT.mono, fontSize: 10, letterSpacing: 2, color: WT.muted2,
          textTransform: 'uppercase', marginTop: WT.sp.xs,
        }}>{time}</div>
      )}
    </div>
  );
}

// User block — italic serif, behind a 2px sage rule, indented.
// Tighter vertical presence than Jove's — the interjection is quieter.
function UserBlock({ children, time }) {
  return (
    <div style={{
      padding: `${WT.sp.sm}px 0 0`,
      paddingLeft: WT.sp.md,
      borderLeft: `2px solid ${WT.sageFaint}`,
    }}>
      <div style={{
        fontFamily: WT.body, fontSize: 17.5, lineHeight: 1.6, fontStyle: 'italic',
        color: WT.ink85, textWrap: 'pretty',
      }}>{children}</div>
      {time && (
        <div style={{
          fontFamily: WT.mono, fontSize: 10, letterSpacing: 2, color: WT.muted2,
          textTransform: 'uppercase', marginTop: WT.sp.xs, fontStyle: 'normal',
        }}>{time}</div>
      )}
    </div>
  );
}

// Reply options — small mono-caps with a hairline above, stacked
function ReplyOptions({ options, onPick }) {
  return (
    <div style={{ marginTop: WT.sp.lg }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: WT.sp.sm }}>
        or reply in kind
      </div>
      {options.map((o, i) => (
        <div key={i} onClick={() => onPick && onPick(o)} style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: `${WT.sp.sm}px 0`,
          borderBottom: `1px solid ${WT.hairSoft}`,
          cursor: 'pointer',
        }}>
          <div style={{
            fontFamily: WT.display, fontStyle: 'italic', fontSize: 16,
            color: WT.ink85, lineHeight: 1.5,
          }}>{o}</div>
          <span style={{ color: WT.muted2, fontSize: 14, marginLeft: WT.sp.sm }}>›</span>
        </div>
      ))}
    </div>
  );
}

// Composer — inline 3-line textarea with a hairline beneath and a send affordance
function Composer({ state = 'default' }) {
  const focus = state === 'focus';
  const filled = state === 'filled';
  return (
    <div style={{
      padding: `${WT.sp.md}px 0 ${WT.sp.sm}px`,
      borderTop: `1px solid ${WT.hair}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: WT.sp.md }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: WT.display, fontSize: 17, lineHeight: 1.7,
            fontStyle: filled ? 'italic' : 'italic',
            color: filled ? WT.ink85 : WT.muted,
            minHeight: 48,
          }}>
            {filled ? "today was full. not heavy. just — long." : "Write back to Jove…"}
            {focus && <span style={{
              display: 'inline-block', width: 1.5, height: 18, background: WT.sage,
              marginLeft: 2, verticalAlign: 'middle', animation: 'mwBlink 1s infinite',
            }}/>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: WT.sp.xs, paddingBottom: 4, flexShrink: 0 }}>
          <button aria-label="expand" style={{
            all: 'unset', cursor: 'pointer',
            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: WT.muted,
          }}><Glyph size={16}><path d="M4 14v6h6"/><path d="M20 10V4h-6"/><path d="M14 10l6-6"/><path d="M10 14l-6 6"/></Glyph></button>
          {filled && <TextBtn label="send" arrow="›" tone={filled ? 'ink' : 'quiet'}/>}
        </div>
      </div>
    </div>
  );
}

// Typing indicator — a single sage fleuron pulsing
function TypingIndicator({ who = 'Jove' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: WT.sp.xs,
      padding: `${WT.sp.md}px 0 0`,
    }}>
      <span style={{ ...WT.microCaps, color: WT.muted2 }}>{who}</span>
      <span style={{ color: WT.sage, fontSize: 14, animation: 'mwPulse 1.4s infinite' }}>…</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Specimens — framed to show each primitive in the shape of a page
// ──────────────────────────────────────────────────────────────
function PageFrame({ children, width = 420, height, padding = '32px 28px' }) {
  return (
    <div style={{
      width, minHeight: height,
      background: WT.linen, border: `1px solid ${WT.hair}`,
      padding, boxShadow: WT.lift,
    }}>{children}</div>
  );
}

function SGChatReal() {
  return (
    <SGSection num="V" anchor="chat"
      title="Chat primitives"
      lead="Jove speaks in plain roman. The user's voice is italic, indented behind a 2px sage rule — a typographic aside. The product belongs to Jove's voice; the user is the interjection."
    >
      <SGSubhead num="05.1" title="Jove block" note="Source Serif 18px, 1.65 line-height, near-black ink. The primary voice. The first block of a session is labeled with a micro-caps 'Jove' tag in sage."/>
      <SGGrid cols={2}>
        <Specimen label="opening — labeled" padding={WT.sp.lg} align="top" height={220}>
          <PageFrame width={420} padding="28px 28px">
            <JoveBlock first>
              Sit with me a while. Tell me, gently, what sort of day this has been — and what, if anything, is asking to be said.
            </JoveBlock>
          </PageFrame>
        </Specimen>
        <Specimen label="following" padding={WT.sp.lg} align="top" height={220}>
          <PageFrame width={420} padding="28px 28px">
            <JoveBlock>
              Long in what way — full, or heavy? Take the word that fits; the other one will wait.
            </JoveBlock>
          </PageFrame>
        </Specimen>
      </SGGrid>

      <SGSubhead num="05.2" title="User block" note="Italic Source Serif 17.5px, indented behind a 2px sage rule. Softer ink. The rule marks the block as the user's aside within Jove's flow."/>
      <Specimen label="user reply" padding={WT.sp.lg} align="top" height={220}>
        <PageFrame width={560} padding="28px 28px">
          <UserBlock>
            it was long. I'm tired in a way sleep won't reach. I don't know how to say it better than that.
          </UserBlock>
        </PageFrame>
      </Specimen>

      <SGSubhead num="05.3" title="An exchange" note="The way a full session reads — Jove, user, Jove — with generous space between. No timestamps inside the exchange; the page is timestamp enough."/>
      <Specimen label="session excerpt" padding={WT.sp.lg} align="top" height={560}>
        <PageFrame width={560} padding="28px 28px">
          <JoveBlock first>
            Sit with me a while. Tell me, gently, what sort of day this has been.
          </JoveBlock>
          <UserBlock>
            it was long.
          </UserBlock>
          <JoveBlock>
            Long in what way — full, or heavy? Take the word that fits; the other one will wait.
          </JoveBlock>
          <UserBlock>
            heavy. I keep thinking about the phone call with my mother.
          </UserBlock>
          <JoveBlock>
            I'll hold that with you for a moment. What did the call leave behind — was it something she said, or something left unsaid?
          </JoveBlock>
          <TypingIndicator who="you"/>
        </PageFrame>
      </Specimen>

      <SGSubhead num="05.4" title="Reply options" note="When Jove offers a way in, he lays out a few gently-phrased options in italic, stacked with hairlines. The user can pick one or write their own."/>
      <Specimen label="reply options" padding={WT.sp.lg} align="top" height={360}>
        <PageFrame width={480} padding="28px 28px">
          <JoveBlock first>
            If it helps to start narrower, you might begin here.
          </JoveBlock>
          <ReplyOptions options={[
            "something small is weighing on me.",
            "I had a good hour today, and I want to keep it.",
            "I don't know where to start.",
            "not this one — I want to write my own.",
          ]}/>
        </PageFrame>
      </Specimen>

      <SGSubhead num="05.5" title="Composer" note="Three-line textarea anchored at the foot of the page. A chevron-out glyph expands it to a full-screen sheet for longer passages. The send affordance appears only when there's text."/>
      <SGGrid cols={2}>
        <Specimen label="empty" padding={WT.sp.lg} align="top" height={200}>
          <PageFrame width={420} padding="20px 28px"><Composer/></PageFrame>
        </Specimen>
        <Specimen label="focused — empty" padding={WT.sp.lg} align="top" height={200}>
          <PageFrame width={420} padding="20px 28px"><Composer state="focus"/></PageFrame>
        </Specimen>
        <Specimen label="writing" padding={WT.sp.lg} align="top" height={200}>
          <PageFrame width={420} padding="20px 28px"><Composer state="filled"/></PageFrame>
        </Specimen>
        <Specimen label="typing indicator" padding={WT.sp.lg} align="top" height={200}>
          <PageFrame width={420} padding="28px 28px">
            <JoveBlock first>Long in what way — full, or heavy?</JoveBlock>
            <TypingIndicator who="you"/>
          </PageFrame>
        </Specimen>
      </SGGrid>

      <Annot>
        Avoid speech-bubble chrome at all costs. No rounded rectangles, no color fills behind blocks, no avatar circles. The type itself does the role-marking — roman for Jove, italic-behind-rule for the user.
      </Annot>
    </SGSection>
  );
}

Object.assign(window, { JoveBlock, UserBlock, ReplyOptions, Composer, TypingIndicator, PageFrame, SGChatReal });
