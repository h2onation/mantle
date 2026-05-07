// sg-long-content.jsx — §12 Long-content patterns
// How the system handles entries longer than a screen, transcripts that
// run for thirty minutes, lists past 50 rows, and the truncation rules.

// ──────────────────────────────────────────────────────────────
// Long entry — gentle continuation, no fade
// ──────────────────────────────────────────────────────────────
function LongEntryView() {
  const text = `I went from noticing the tone shift, to feeling my chest tighten, to leaving the room. The whole arc took maybe ninety seconds. I kept replaying the moment in the doorway and trying to decide whether I had been honest about why I left.

For most of my life I would have called this avoidance and moved on. What's different now is that I can name the parts. There's the noticing — quick, almost involuntary. There's the reading — where I decide what the shift means, and that's where I'm usually wrong. And then there's the leaving, which feels like the only choice once I've already decided.

I think the work, if there is work, is in the reading. Not the noticing, not the leaving. The story I tell about the silence in the half-second after someone changes their face.`;
  return (
    <div style={{
      width: 360,
      background: WT.cream,
      border: `1px solid ${WT.hair}`,
      borderRadius: 1,
      boxShadow: '0 1px 0 rgba(20,16,10,0.04), 0 12px 32px -18px rgba(20,16,10,0.18)',
      padding: '28px 30px',
      fontFamily: WT.body, fontSize: 17, lineHeight: 1.62,
      color: WT.ink,
      position: 'relative',
    }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: 16 }}>VOL. I · ENTRY 47</div>
      <div style={{
        fontFamily: WT.display, fontSize: 22, fontStyle: 'italic',
        color: WT.ink, lineHeight: 1.35, marginBottom: 14,
      }}>
        On reading silence
      </div>
      <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{text}</p>
      <div style={{
        marginTop: 22, paddingTop: 14, borderTop: `1px solid ${WT.hair}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span style={{ ...WT.microCaps, color: WT.muted }}>PG. 47 OF 73</span>
        <span style={{ fontFamily: WT.display, fontStyle: 'italic', fontSize: 15, color: WT.ink }}>
          turn the page <span style={{ color: WT.sage }}>›</span>
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Truncation pattern — where we cut, where we don't
// ──────────────────────────────────────────────────────────────
function TruncationCard({ kind, title, body, lines }) {
  return (
    <div style={{
      width: '100%',
      borderTop: `1px solid ${WT.hair}`,
      padding: '18px 0',
    }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: 6 }}>{kind}</div>
      <div style={{
        fontFamily: WT.display, fontStyle: 'italic', fontSize: 17,
        color: WT.ink, lineHeight: 1.4, marginBottom: 6,
        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: WT.body, fontSize: 14, color: WT.muted, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {body}
      </div>
    </div>
  );
}

function TruncationDemo() {
  const longTitle = 'On reading silence and the half-second before I decide it means something';
  const longBody = 'I went from noticing the tone shift, to feeling my chest tighten, to leaving the room. The whole arc took maybe ninety seconds. I kept replaying the moment in the doorway and trying to decide whether I had been honest about why I left.';
  return (
    <div style={{ width: 380 }}>
      <TruncationCard kind="ENTRY ROW · LIST" title={longTitle} body={longBody} lines={2}/>
      <TruncationCard kind="ENTRY CARD · GRID" title={longTitle} body={longBody} lines={3}/>
      <TruncationCard kind="SEARCH RESULT" title={longTitle} body={longBody} lines={1}/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Transcript — long session, chapter markers, no avatars
// ──────────────────────────────────────────────────────────────
function TranscriptMarker({ label, time }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      margin: '20px 0 16px',
    }}>
      <span style={{ ...WT.microCaps, color: WT.sage }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: WT.sageSoft }}/>
      <span style={{ ...WT.microCaps, color: WT.muted }}>{time}</span>
    </div>
  );
}

function TranscriptTurn({ role, text }) {
  if (role === 'jove') {
    return (
      <p style={{
        margin: '14px 0', fontFamily: WT.body, fontSize: 17, lineHeight: 1.55,
        color: WT.ink,
      }}>{text}</p>
    );
  }
  return (
    <div style={{
      margin: '14px 0',
      paddingLeft: 16, borderLeft: `2px solid ${WT.sage}`,
    }}>
      <p style={{
        margin: 0, fontFamily: WT.display, fontStyle: 'italic',
        fontSize: 17, lineHeight: 1.5, color: WT.ink85,
      }}>{text}</p>
    </div>
  );
}

function TranscriptView() {
  return (
    <div style={{
      width: 380,
      background: WT.cream,
      border: `1px solid ${WT.hair}`,
      padding: '24px 26px',
      maxHeight: 520, overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: 4 }}>TRANSCRIPT · SESSION 14</div>
      <div style={{ fontFamily: WT.display, fontStyle: 'italic', fontSize: 22, color: WT.ink, marginBottom: 8 }}>
        a forty-three minute exchange
      </div>

      <TranscriptMarker label="OPENING" time="00:00"/>
      <TranscriptTurn role="jove" text="Tell me what's been on your mind this week, even if it doesn't feel like much."/>
      <TranscriptTurn role="user" text="Actually a lot. The thing with my brother last weekend keeps coming back."/>

      <TranscriptMarker label="INTO IT" time="04:22"/>
      <TranscriptTurn role="jove" text="What's the part you keep returning to?"/>
      <TranscriptTurn role="user" text="The doorway. The look on his face right before I left."/>
      <TranscriptTurn role="jove" text="And what story do you tell about that look?"/>

      <TranscriptMarker label="THE CATCH" time="11:47"/>
      <TranscriptTurn role="jove" text="You said something a minute ago — that you decided what it meant before you asked. That feels like the door."/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Pagination, infinite scroll, jump-to
// ──────────────────────────────────────────────────────────────
function Pagination() {
  const pages = [1, 2, 3, '…', 12, 13];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18,
      paddingTop: 18, borderTop: `1px solid ${WT.hair}`,
    }}>
      <span style={{ ...WT.microCaps, color: WT.muted }}>← PREV</span>
      {pages.map((p, i) => (
        <span key={i} style={{
          fontFamily: WT.display, fontStyle: 'italic', fontSize: 17,
          color: p === 3 ? WT.ink : WT.muted,
          textDecoration: p === 3 ? `underline ${WT.sage}` : 'none',
          textUnderlineOffset: 4,
        }}>{p}</span>
      ))}
      <span style={{ ...WT.microCaps, color: WT.ink }}>NEXT →</span>
    </div>
  );
}

function JumpTo() {
  const items = [
    { lab: 'BEGINNING', meta: 'Apr 03' },
    { lab: 'SESSION 14', meta: 'Apr 17 · TODAY' },
    { lab: 'A MONTH AGO', meta: 'Mar 17' },
    { lab: 'THE OPENING HOUR', meta: 'Apr 03' },
  ];
  return (
    <div style={{ width: 360 }}>
      <div style={{ ...WT.microCaps, color: WT.muted, marginBottom: 10 }}>JUMP TO</div>
      <div style={{ borderTop: `1px solid ${WT.hair}` }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '12px 0', borderBottom: `1px solid ${WT.hair}`,
            cursor: 'pointer',
          }}>
            <span style={{ fontFamily: WT.display, fontStyle: 'italic', fontSize: 17, color: WT.ink }}>
              {it.lab.toLowerCase()}
            </span>
            <span style={{ ...WT.microCaps, color: WT.muted }}>{it.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Section
// ──────────────────────────────────────────────────────────────
function SGLongContent() {
  return (
    <SGSection num="XII" anchor="long-content"
      title="Long content"
      lead="The journal is meant to be read end-to-end, and many entries grow past a screen. These patterns govern how length is handled — without losing the page."
    >
      <SGSubhead num="12.1" title="Long entries" note="Set a comfortable measure (≈ 65ch) and let the page grow. Never hide content behind a fade or a 'show more' on the entry itself."/>
      <Specimen label="long entry" padding={WT.sp.xl} height={620}><LongEntryView/></Specimen>

      <SGSubhead num="12.2" title="Truncation" note="Trim only in summaries — list rows, grid cards, search results. Use line-clamp, never raw ellipsis on the title. Bodies clamp to 1–3 lines depending on density."/>
      <Specimen label="truncation rules" padding={WT.sp.lg} align="top"><TruncationDemo/></Specimen>

      <SGSubhead num="12.3" title="Long transcripts" note="Chapter markers in mono-caps, sage-rule between, with the rough timecode on the right. No avatars; voice alone carries the speaker."/>
      <Specimen label="transcript with chapters" padding={WT.sp.xl} height={580}><TranscriptView/></Specimen>

      <SGSubhead num="12.4" title="Pagination &amp; jumps" note="Past fifty rows, paginate. Inside the manual itself, offer named jumps (beginning, today, the opening hour) rather than page numbers."/>
      <SGGrid cols={2}>
        <Specimen label="numbered pagination" padding={WT.sp.xl} height={140}><Pagination/></Specimen>
        <Specimen label="named jumps" padding={WT.sp.xl} align="top"><JumpTo/></Specimen>
      </SGGrid>

      <Annot>If a screen has a scroll, the masthead and bottom nav stay anchored. Only the body scrolls.</Annot>
    </SGSection>
  );
}

Object.assign(window, { SGLongContent });
