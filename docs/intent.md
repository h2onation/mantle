# intent.md — What We're Building and Why

> **Authority level**: Strategic. Changes when the phase changes.  
> **Audience**: You (to maintain strategic clarity) and Claude Code agents (to understand what matters right now).  
> **What belongs here**: Product thesis, current phase definition, success criteria, what's deliberately excluded. This is the "why" behind every product decision.

---

## Product Thesis

You've spent your life translating yourself for people who didn't have the manual. Mantle helps you write the one you needed.

Mantle is built for late-diagnosed autistic adults, ages 25 to 45. People who learned to function before they learned what was actually happening underneath. People who can describe the situation but not the wiring. People who've been told their behavior means one thing when it actually meant another — and have stopped trying to explain.

The first audience is autism level 1 and AuDHD: high-masking, high-context, often articulate, often exhausted. People who recognize that what looks like resistance is recalculation, what looks like withdrawal is shutdown, what looks like a preference is a non-negotiable need. They have the experience. They don't always have language for it.

People come to Mantle for three reasons, sometimes all at once:

1. **They want a map of their own system.** What actually happens in their body when plans change. Why certain rooms drain them. What "going offline" looks like from the inside. The mechanics, not the labels.
2. **They want something they can hand to other people.** A manual that explains how they work, in their own language, without having to perform calm or translate themselves in real time.
3. **They have a situation right now.** Sensory overload at work, a conflict with a partner, an exchange that didn't land. They need to think it through and they want something sharper than journaling and more available than therapy.

Sage helps with all three in the same conversation. The situation is what brings someone in. The map is what keeps them coming back. And the accumulation — session 5 being sharper than session 1 because Sage remembers their patterns and connects them to new situations — is what no other tool can do.

The manual is not the pitch. It's the moat. Users discover its value through accumulation, not explanation.

### Value Ranking (from strategic review)

1. **Decision-making tool**: Help me navigate this situation using my patterns.
2. **Relationship bridge**: Share how I work with people who matter. Show where our patterns collide.
3. **Self-knowledge**: See my wiring. Name my patterns. Understand why I do what I do.

The product currently delivers #3. Phase 1 adds #1. #2 is Phase 2 — when two people's pattern networks connect and they can see where their loops interlock.

## What Sage Actually Is

Sage is not one prompt. It's a three-stage pipeline (extraction → conversation → classification) that runs on every turn. The extraction layer is the strategist — it tracks what the user has revealed, in their own words, across which layers, at what depth. Sage is the conversationalist — it takes that research brief and has a great conversation. The classifier is a lightweight detector that catches checkpoints Sage didn't explicitly flag.

Sage is grounded in three published clinical frameworks used as self-reflection tools, not clinical interventions: Schema Therapy, Attachment Theory, and Functional Analysis. See rules.md for how these are used and the legal boundaries around them.

## The Five-Layer Manual

> Canonical layer definitions live in `src/lib/manual/layers.ts` — single source of truth. Renaming a layer is a one-line change there. Do not duplicate layer names in other files.

The manual is structured in five layers (also called sections in user-facing copy), each capturing a different dimension of how an autistic adult actually operates:

1. **Some of My Patterns**: What behavior means when you can't explain it in the moment. Silence, freezing, shutdown, masking — the signals other people misread.
2. **How I Process Things**: Sensory experience, how change lands, how information gets taken in, what overload looks and feels like.
3. **What Helps**: What you need to function. Alone time, routine, environment, recovery, structure — and why these are non-negotiable, not preferences.
4. **How I Show Up with People**: How you connect, handle conflict, show care. What withdrawal and closeness actually look like from your side.
5. **Where I'm Strong**: What you bring when conditions are right. Strengths in context, not in isolation.

Each layer can have 1 component (the integrated portrait, 150-250 words) and up to 2 patterns (specific recurring loops, 80-150 words each). Components always come first — they provide the frame that gives patterns meaning.

*Note: The five-layer structure is the current architecture but may evolve as the product matures. See decisions.md ADR-015 for the rationale behind the current design.*

## Current Phase: Phase 1 — Situation-First Sage

### What Changed

Early testing with 5 users revealed: 4 bounced early. The 1 who engaged had an acute, specific situation. The insight: the entry point is the situation, not the manual.

Phase 1 reframes Sage so that when a user brings a situation, Sage helps them think through it (immediate value) while extracting behavioral patterns (accumulating value). Both happen in the same conversation.

**Key reframe**: "Advisor" is not a separate feature. It's Sage doing what it already does, in the context of a live situation. Same conversation engine, same legal framework, different entry context.

### Phase 1 Scope

1. Sage system prompt: situation-navigation mode. When user brings a situation, Sage helps navigate it while building the manual underneath. After a checkpoint confirms, Sage connects the insight back: "This pattern is likely active right now. What do you want to do differently?"
2. Sage first message: No introduction, no process explanation. Goes straight into the user's seed topic.
3. Session re-entry: Returning user gets "what's happening now?" not "let's pick up where we left off."
4. Post-checkpoint flow: Fork between "work with it" (apply insight to current situation) and "keep building."
5. Housekeeping: seed screen verification, legal doc update for situation-navigation, nav cleanup (remove dead Guidance tab), manual page walkthrough with real content.

### The First Session Arc

The intended experience: user describes a situation. Sage deepens into what's underneath it. At some point, something takes shape — a pattern the user has never named but immediately recognizes. Sage reflects it back. The user feels seen, not analyzed. They confirm the checkpoint, it writes to the manual, and Sage asks: do you want to apply this to your situation, or keep building? That moment of recognition is what brings them back.

### What Phase 1 Does NOT Include

- Sharing, export, or any social features (Phase 2)
- Advisor as a separate mode or toggle
- Explore, learning paths, or educational content
- Proxy manuals (building a manual about someone else)
- New UI components beyond what exists
- Design refresh
- New spec documents
- MMS / text messaging (scoped separately)

### Success Criteria

After the build, recruit 10 late-diagnosed autistic adults, ages 25 to 45. People with an active situation they're trying to think through, not casual browsers. (Recruitment channels are a separate concern — the audience description here is the user we're building for, not where we find them.)

**The test**: Do 3+ out of 10 return for a 3rd session unprompted within 2 weeks?

### Principles

- **Subtract, don't add.** The product has enough features. The work is reframing how Sage engages.
- **The manual is the moat, not the pitch.** Users discover its value through accumulation, not explanation.
- **Build, then test with users.** The direction question gets answered by behavior, not planning.

### Why People Come Back

The retention mechanic is accumulation. The manual gets richer. Sage gets sharper because it remembers your patterns and connects them to new situations. Session 5 is better than session 1 not because of new features but because Sage has context no other tool has. The return trigger is: something happened since last time, and the user knows Sage already knows their patterns.

---

## Sections to Add (flagged, not yet written)

- **Target user profile**: Late-diagnosed autistic adults, ages 25 to 45. Often AuDHD. High-masking, high-context, often articulate about other people but not themselves. Have learned to function before they learned what was happening underneath. Stuck explaining themselves to people who don't have the right frame.
- **Competitive positioning**: What Mantle does that ChatGPT (no memory), therapy apps (scripted CBT), journaling apps (no pattern mapping), and personality tests (static snapshot) don't. The living manual and cross-session accumulation.
- **Vision / north star**: Where this goes beyond Phase 2. Pattern collision maps between two people's manuals. Third-party perspectives in conversations. Real-time situation navigation. Not a roadmap, just a direction.
