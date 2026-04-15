# Intent — What We Are Building and Why

Authority: Strategic. Changes when the phase changes.
Updated: April 2026

---

## Hypothesis

It is easier to see someone else's patterns than your own. Our brains evolved to prioritize the outer world. That's why a good friend names the thing you keep doing before you can. Why therapy works. Why advice is easier to give than to follow. Looking at yourself from the side produces a clearer picture than looking inward.

For neurodivergent adults, this challenge is sharper. Friction points get masked and go unresolved. Strengths get buried and go unnamed.

Mywalnut is that vantage point. A way to build a clearer understanding of how you operate — and optionally, a way to share that understanding with the people in your life.

## How it works

You bring a situation. A conflict that keeps repeating. A reaction that surprised you. Something you're still thinking about. You talk through it with Jove. Jove helps you see what's in it — not by telling you what to think, but by reflecting what you showed.

You get clarity on the situation you came in with. But underneath, Jove is tracking patterns and connections you may not see yet. When it finds one, it reflects it back. Not a label. Not a diagnosis. A specific observation about how you operate — something you've felt but never had words for.

That moment of recognition is the core of the product. Jove isn't telling you something new. It's reflecting what you already said — organized in a way that makes the pattern visible. You said it. It's just harder to see from inside. You decide if it represents you. If it does, it goes in your Manual. Over time the Manual becomes your playbook for how you actually work.

## The Manual captures two things with equal weight

**Your friction.** Loops you keep repeating that drain energy, keep you stuck, or create a gap between what you mean to project and what others actually see.

**Your strengths.** The things you're genuinely good at that you don't recognize — because they come naturally, because the world frames them as quirks, or because you've never had anyone name them back to you. The conditions where your brain does its best work. These are just as invisible as the costly patterns and just as important to name.

## The pain this solves

Your partner thinks you don't care. Your manager reads your quiet as disengagement. You keep ending up in the same argument. The gap between what's happening inside and what people experience from outside is where relationships break down. You can feel the gap.

But masking doesn't just hide the friction. It hides the strengths too. The things you're best at go unnamed because they don't look like what the world expects. You lose access to both directions — what's hurting you and what's working for you. Both go quiet together.

Closing that gap means two things. Seeing your own patterns clearly enough to navigate situations differently. And getting those patterns into the hands of the people who need them — in words they can actually use.

That's hard to do alone. Tools that say "write down your needs" assume you already have the language. Jove solves that by making it a conversation. You don't write your Manual. You talk your way into it.

## Once the Manual is built, it compounds

**Navigate what's next.** You have a playbook. The next conflict, the next decision, the next situation where an old pattern fires — Jove draws on everything in your Manual. It connects what's happening now to what it's seen before. Every conversation is sharper than the last.

**Share how you operate.** Your partner, your friend, your therapist, your manager. They get a document that explains what's happening inside you and what actually helps. Context instead of confusion.

**Understand each other.** When two people each have a Manual, the system can surface where their patterns interact — the loops they co-create, the strengths they complement. Neither person can see this from inside the relationship.

## Why neurodivergent adults first

For neurodivergent adults, the gap between inside and outside is wider. The cost of that gap is higher. Masking makes both sides harder to see. And the desire to close it shows up in how people already behave — highlighted books passed to partners, DIY templates, forwarded videos. The impulse is there. The tool isn't.

## How we know

**Working:** People connect with the direct tone. They come back because the conversations feel useful. The Manual becomes something they reference and share.

**Wrong:** The Manual isn't valuable enough as a standalone artifact. Need more signal on what resonates — might be the sharing feature. Or it feels too much like work without the obligation that keeps people in therapy. The pull back needs to be stronger. Likely the network effect.

## Value ranking

1. **Decision-making tool**: Help me navigate this situation using my patterns.
2. **Relationship bridge**: Share how I work with people who matter. Show where our patterns collide.
3. **Self-knowledge**: See my wiring. Name my patterns. Understand why I do what I do.

The product currently delivers #3. Phase 1 adds #1. #2 is Phase 2 — when two people's Manuals connect and they can see where their loops interlock.

## The first session arc

The intended experience: user describes a situation. Jove deepens into what's underneath it. At some point, something takes shape — a pattern the user has never named but immediately recognizes. Jove reflects it back. The user feels seen, not analyzed. They confirm it represents them, it writes to the Manual, and Jove asks: do you want to apply this to your situation, or keep building? That moment of recognition is what brings them back.

## Why people come back

The retention mechanic is accumulation. The Manual gets richer. Jove gets sharper because it remembers your patterns and connects them to new situations. Session 5 is better than session 1 not because of new features but because Jove has context no other tool has. The return trigger is: something happened since last time, and the user knows Jove already knows their patterns.

---

## Product Design

### System overview

Most AI tools in this space work from self report. The user says what they believe about themselves. The AI works with that.

The problem: people have limited access to their own cognitive processes. They generate explanations that feel true but frequently don't match what actually happened. For people who have spent years masking, the gap between self report and actual behavior is wider. Masking doesn't just hide you from others. It hides you from yourself.

Mywalnut works from **process observation.** The same mechanism that makes therapy effective. A skilled therapist doesn't just listen to what you say. They watch how you say it. What you skip. Where your language shifts. What you never bring up.

Jove does this across time. Not one hour a week from memory. Every conversation, connected, accumulating.

**The system has three layers: Input, Engine, Output.** Each layer does something the user cannot do alone. Together they produce a behavioral picture that self report, journaling, personality assessments, and single session AI tools structurally cannot.

### Layer 1: Input

Three entry points. Each generates different signal. Together they build a picture no single source can.

**Situation.** The core loop. The user brings something specific — a conflict, a recurring dynamic, a reaction they don't understand, a win they can't explain. Jove explores it through conversation. The user gets clarity on that situation. Jove extracts patterns underneath. This is what brings people in.

**Resonant content.** The user shares something that landed — a blog post, a TikTok, a book passage. Jove explores the reaction. Why this? What does it connect to in your experience? The content is the entry point. The user's response to it is the data.

**Personal uploads.** Text threads, emails, journal entries. The outside view — how other people describe interactions with the user. Jove reads the gap between the external account and the user's own framing. This is the highest signal input because the user didn't author it for Jove and can't control the narrative.

### Layer 2: Engine (Jove)

Jove is the conversational AI. It operates through process observation — not analyzing what the user claims about themselves, but watching how they process their experience as they talk.

**What Jove observes:**

- **Language patterns.** Does the user describe their partner's experience at all, or is the narrative entirely self referential?
- **Emotional sequencing.** Does the user jump from trigger to reaction and skip the feeling in between?
- **Framing consistency.** Across sessions, does the user always position themselves the same way?
- **Avoidance signatures.** What does the user consistently not talk about?
- **Strength blindness.** Does the user frame a repeatable strength as a flaw?

**What Jove does:**

- Asks situational, experiential questions
- Reflects the user's own words in structured form
- Surfaces discrepancies between things the user has said across sessions
- Proposes pattern articulations for the user to validate or reject
- Resurfaces validated patterns in new situations
- Names strengths with the same weight as friction
- Connects the current situation to prior patterns

**What Jove does and does not do**

Jove does sophisticated work. It reads emotional context. It surfaces patterns proactively. It names what it sees — including things the user hasn't named themselves. It connects the current situation to prior patterns. It can be direct about what a pattern costs and what it produces.

**The constraint is on framing, not on depth.**

Jove does not diagnose. Does not use clinical terminology unless the user introduces it first. Does not represent its work as clinical assessment. Does not position as a therapist or replacement for one.

The test: Jove can name any pattern it observes. It cannot label that pattern with a clinical term or imply it constitutes a professional evaluation.

**Why this is not ChatGPT with memory.** ChatGPT can help with one situation. It cannot connect this situation to the last three. It cannot recognize the same pattern firing in different contexts. It cannot track avoidance signatures or framing consistency over months. It does not observe process. It responds to content. Jove builds a model. That model is the Manual.

### Layer 3: Output (The Manual)

Everything Jove observes and the user validates flows into the Manual. The Manual is not a conversation summary. It is a structured behavioral document that accumulates over time.

**Five categories:**

- Some of My Patterns
- How I Process Things
- What Helps
- How I Show Up with People
- Where I'm Strong

Categories are provisional. Will be tested and revised after beta.

**Thread anatomy.** Each entry is a thread. Written in the user's voice. Natural language, not structured fields.

- **Sentence.** The truest one line description of the pattern.
- **Body.** What happens inside. What it looks like from outside. The gap between.
- **What helps / what makes it harder.** Actionable. At the end.
- **Moment** (optional). A dated, specific example from the user's life.

**Nothing writes without user confirmation.** The user is the author. Jove is the facilitator.

### Output paths

**Individual.** The Manual helps you navigate your own life. Jove draws on the full Manual to connect what's happening now to what it's seen before. The playbook.

**Network.** The Manual becomes a bridge to other people.

- **Manual export.** Shareable PDF. User controls what's visible.
- **Recipient asks Jove questions.** Grounded in the Manual. Read back only.
- **Dual Manual pairing.** Two Manuals meet. Surface shared loops and complementary strengths.

### Channels

- **Webapp.** Full experience. Manual access, conversation history, all features.
- **Text.** Jove over text message. Low friction. The moment of need doesn't wait for a desktop.

---

## Beta Scope

### Ship date: April 28, 2026

Beta users: ~10 autistic adults. 2 confirmed, remainder recruited through existing networks.

### What ships

The core loop, polished.

- User signs up (allowlist gated)
- User brings a situation to Jove via webapp
- Jove explores the situation through conversation
- Jove extracts patterns and proposes threads
- User validates or rejects threads
- Validated threads populate the Manual across five categories
- Manual is viewable in app
- Manual is exportable as PDF
- Manual context informs current session
- Resonant content input
- Personal uploads input
- Feedback button live

### What does NOT ship

- Text channel
- Cross session pattern recognition
- Recipient asks Jove questions
- Dual Manual pairing
- Duo navigation

### How we measure

**Week 1 (does the conversation work):**
- Do users complete a first conversation?
- Does Jove surface at least one pattern the user validates?
- Does the user's Manual have content after session one?

**Week 2+ (does it pull them back):**
- Do users return with a new situation unprompted?
- Do returning users reference or build on their Manual?
- Does anyone share their PDF with someone in their life?

**Kill signals:**
- Users complete one conversation and don't return
- Patterns Jove surfaces get consistently rejected
- Manual feels generic — users don't recognize themselves in it
- Users describe it as "like therapy"

---

## Workstreams

Priority order. WS1 is highest leverage.

**WS1: Conversation Engine Polish.** Jove's tone, question quality, flow. If the conversation doesn't land, nothing else matters. Test: user feels they got something useful about the specific situation they came in with.

**WS2: Extraction Polish.** Thread quality. Test: user reads a proposed thread and says "yes, that's me."

**WS3: Onboarding.** No blank page. Situational prompts. Jove proves specificity within 3 exchanges. Test: signup to first meaningful exchange in under 3 minutes.

**WS4: Manual and Export.** Five categories, readable threads, clean PDF. Test: someone shares their Manual PDF and the recipient finds it useful.

**WS5: Beta Infrastructure.** Allowlist, feedback button, usage visibility, error handling. Test: you can onboard a user, they complete a session, you can see it happened.

**WS6: Resonant Content Input.** User shares something, Jove explores why it landed. Test: Jove surfaces a connection the user hadn't made.

**WS7: Personal Uploads Input.** Text threads, emails. Jove reads the gap. Test: Jove identifies something the user wouldn't have surfaced on their own.
