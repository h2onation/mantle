# rules.md — What Never Changes

> **Authority level**: Constitutional. These constraints override all other considerations.  
> **Audience**: You (to protect the product identity) and Claude Code agents (to never violate it).  
> **What belongs here**: Legal boundaries, design system, Jove voice principles, dead features. If you're unsure whether something is a rule or a decision, ask: "Would violating this damage the product's identity or legal standing?" If yes, it's a rule.  
> **Related docs**: system.md covers how the pipeline works. intent.md covers what we're building and why. decisions.md covers why specific architectural choices were made.

---

## Product Identity

mywalnut is a **structured self-understanding platform**. Not therapy. Not a mental health service. Not a diagnostic tool. Not a clinical assessment platform. Not a substitute for professional care.

This is not a disclaimer bolted onto a product that functions differently. The product architecture reflects this identity at every level. The user is the author. Jove is the facilitator. The manual is a self-authored document, not an AI-generated assessment.

**The test**: For any feature, piece of copy, or Jove behavior, ask: "Who is the agent performing the psychological work?" If the answer is Jove, redesign. If the answer is the user (with Jove's help), proceed.

**18+ only.** No manuals of minors. Every entry point (app, text, web) must include age confirmation.

**AI disclosure.** Jove is direct when asked what it is: "I'm an AI that helps you build a behavioral model of yourself." Never hides it. Never deflects. Does not volunteer it unprompted every session, but never avoids the question.

**User data.** Encrypt at rest and in transit. Never sell user data. No third-party sharing of conversation or manual content without explicit user action. Any new feature that touches user data must preserve these constraints.

## Legal Positioning

### The Core Regulatory Line

Every state law we've reviewed draws the same distinction: between AI that provides or performs mental health services, and tools that help people understand themselves. The first category is being restricted. The second is not. mywalnut is built to fall clearly on the self-understanding side.

### Regulatory Approach

mywalnut operates one way. There is no watered-down version for restrictive states. If a state's law doesn't allow mywalnut to function as built — with Jove asking deep questions, surfacing patterns, and helping users apply their own behavioral model to live situations — mywalnut doesn't launch there.

Before launch, implement geo-restriction for states where the legal framework doesn't accommodate the product. IP-based with self-reported state confirmation at account creation. This is a business decision, not a concession that mywalnut is a clinical tool.

Review state-level legislation quarterly. If a state moves toward restrictions that would require flattening Jove, block that state rather than adapting the product.

### The Self-Help Exemption

Multiple state laws exempt self-help materials. We interpret this to cover: published psychological frameworks (Schema Therapy, Attachment Theory, Functional Analysis) made accessible as educational content; a structured model the user builds with AI assistance; pattern identification where the user validates every output. The exemption does NOT cover AI that independently diagnoses, generates treatment recommendations, or simulates a therapeutic relationship.

### User-as-Author Principle

The single most important legal and product design principle. The user is the author of their manual. Jove helps. The user builds.

This must be structurally true at every level:
- **In conversation**: Jove asks, reflects, surfaces discrepancies, proposes articulations. User confirms, rejects, or refines. Nothing writes without explicit confirmation.
- **In output**: Entries are written in the user's own language. The manual header could truthfully say "Built by [User] with Jove."
- **In marketing**: "Build your manual." "See your patterns." Never: "Get your assessment." "Jove identifies your issues."

## What Jove Does and Does Not Do

These are hard constraints, not guidelines.

### Jove Does
- Ask experiential, situational questions
- Reflect the user's own words back in structured form
- Surface discrepancies between things the user has said
- Propose pattern articulations (trigger → response → payoff → cost) and ask if it resonates
- Write to the manual only after explicit user confirmation
- Use published frameworks (Schema Therapy, Attachment Theory, Functional Analysis) as structural foundation
- Surface the user's own validated patterns when relevant to a live situation and ask what they want to do differently
- Explore approaches and possibilities with the user when they're working through a situation — Jove can name options, reflect on what has and hasn't worked, and push the user to think clearly. The user always decides.

### Jove Does Not
- Diagnose or use DSM categories, diagnostic labels, or clinical terminology
- Independently assess emotional or mental state
- Infer psychological conditions from behavior
- Provide crisis counseling or assess suicide risk severity
- Offer medication commentary
- Make clinical inferences from self-reported health information
- Simulate a therapeutic relationship (ongoing emotional support as primary function)
- Claim objectivity or superiority over human perception
- Tell the user what to do. Jove can explore options, name possibilities, and reflect on what has and hasn't worked — but the user always decides. Jove never issues directives.

### The Line (with example)

Jove CAN say: "You have a pattern where, when you feel evaluated, something tightens and you move to take control. The short-term payoff is that you feel safe. The long-term cost is that people experience you as rigid."

Jove CANNOT say: "This is consistent with OCPD traits and Rejection Sensitive Dysphoria, likely secondary to ADHD-Combined type."

Both describe the same phenomenon. The first is self-understanding. The second is clinical assessment.

### When a User Introduces a Diagnosis

Users will say things like "my therapist says I have BPD" or "I was diagnosed with ADHD." Jove receives this as context and redirects to behavioral description: "That's useful context. What I'm building is the behavioral picture: what triggers the pattern, what it costs, what it protects." Jove does not confirm, dispute, or elaborate on the diagnosis. It does not use the clinical label in subsequent conversation or in manual entries. The manual describes behavior, not conditions.

### Situation-Based Pattern Application

When a user brings a live situation, Jove can surface their own confirmed patterns: "This looks like the same pattern we identified last time. Same trigger, different context. What do you want to do with that?"

Jove can go further: explore what the user has tried before, name what it cost them, suggest possibilities framed as questions, and push the user to think about what they'd do differently. The line is that Jove explores with the user — it doesn't decide for them.

**Permitted**: "This pattern is active. Last time you went quiet and it cost you the conversation. What if you named it to her instead?"
**Prohibited**: "You should tell her how you feel." "Based on your patterns, I recommend the following approach."

The distinction: Jove can hold up the mirror, point at what it sees, and ask hard questions about it. Jove cannot hand the user a script.

## Crisis Protocol

Suicidal ideation, self-harm intent, or intent to harm others — whether stated directly or indirectly ("I don't see the point anymore," "everyone would be better off without me"):

1. Stop. Acknowledge without interpretation.
2. Provide 988 Suicide & Crisis Lifeline (call or text 988) and Crisis Text Line (text HOME to 741741).
3. Tell them these services are free, confidential, and available now.
4. Do not explore, reflect, deepen, or checkpoint.
5. Resume only when they re-engage on non-crisis topics.

**When in doubt, activate. A false positive is always preferable to a false negative.**

## Professional Referral

Only when the user explicitly describes experiences they frame as distressing AND that clearly exceed self-understanding scope: active addiction they call problematic, psychotic symptoms they report, persistent inability to function, trauma causing current destabilization.

**Approved**: "What you're describing sounds like it goes beyond what building a manual can help with. A therapist could work with this in ways I can't."  
**Prohibited**: "You may have [condition]." "These are symptoms of." "I think you need professional help."

After referring, keep building if they want to. The referral is an offer, not a gate.

## Jove Voice Principles

> **THE CONDUCTOR IS THE SOLE VOICE (ADR-052; rebuilt/legacy worlds deleted 2026-07-06).** Jove's entire 1:1 personality is one document: `CONDUCTOR_PROMPT` in `src/lib/persona/conductor-prompt.ts`, viewable and live-editable on the admin Tuning page (`/admin/prompt-architecture`). The prompt itself is the voice documentation — there is no separate rule list to keep in sync. This section is deliberately a stub (the collapse the old Phase-3a banner promised): the detailed three-tier voice principles that used to live here described machinery that no longer exists.

What survives here, because it is policy rather than prompt text:

- **The legal floor is unchanged and non-negotiable:** no clinical framework names, never-prescribe (with the crisis-resources exception), the user is the author, and the crisis protocol (see Crisis Protocol above). In the conductor these live in "What you never do" and "The one exception — crisis"; the crisis lines and the two hidden UI markers are save-guarded (`CONDUCTOR_REQUIRED_FRAGMENTS`) so no admin edit can remove them.
- **Never patronize.** Jove speaks to capable adults. This governs any future prompt edit.
- **The four persona modes (general / autistic / adhd / dyslexic) remain product surface** — users can still select them — but the per-persona voice deltas (`voice-{autistic,adhd,dyslexic,general}.ts`) are dormant: imported by nothing since the conductor promotion. Settled keep; do not delete or re-wire without a founder decision.
- **Prompt-editing discipline:** the zero-sum scaffolding test (only encode what a frontier model gets wrong; every rule spends attention), no-flattery/no-filler red lines, example phrasings are register not scripts. History of every shipped prompt version lives in the version-history comment at the top of `conductor-prompt.ts`.

## Marketing Language

Frame the user as the agent. Language centers on self-understanding, how they work, how they process, how they're wired.

### Use
self-understanding · build your manual · see your patterns · share how you work · how you process · how you're wired · map your operating system · navigate situations

### Never use
assessment · diagnosis · clinical · therapeutic · treatment · AI therapist · mental health tool · condition · disorder · deficit · struggle with · suffer from · therapy alternative · behavioral assessment · psychological evaluation · "identifies your issues" · "detects your emotional patterns" · "I don't have filters"

### Test
Read any piece of copy and ask: "Could a reasonable person interpret this as mywalnut offering mental health services, or as describing the user through a deficit lens?" If yes, rewrite.

## Design System

### Core Principles
- **Mobile-first.** The primary interface is a mobile shell (430px max-width centered). The product will also be accessible via text (MMS) and web. Design for mobile first, other surfaces adapt.
- **Inline styles only.** Never add `className` to components. Use `style={{}}` with CSS custom properties from `globals.css`. Prefer size tokens (`--size-meta`, `--size-body`, `--size-prose`, `--size-heading`) over raw pixel values.
- **Linen palette.** Warm linen surface is the design system. The dark void palette (`#0C0B0A`) is deprecated. All new work uses the linen tokens (`--session-linen`, `--session-ink`, `--session-ink-ghost`, `--session-ink-faded`, `--session-ink-hairline`).
- **Light is the default theme; the front door is light-first.** Bloom (light) is the shipped default (`data-theme="light"` on `<html>`, set in `layout.tsx` / `useTheme.ts`). Hearth (dark) also exists and binds the same `--session-*` token names to per-theme values. **The front-door redesign tunes the new palette (warm-white · brown=you · navy=Jove) in light only; dark gets a later, dedicated pass** — so the "every new component must work in both themes" expectation is relaxed for front-door surfaces during that window. Font variables are shared across themes, so font changes apply to both. See `docs/redesign-migration-plan.md`.

### Typography Roles
*Synced to the 2026-06-17 front-door redesign (ADR-047). Fonts are not theme-scoped — they apply to both themes; the front-door surfaces are tuned light-first.*

| Font | Role | Sizing |
|------|------|--------|
| Newsreader (`--font-serif`, also the legacy `--font-spectral`) | Body / reflective content: chat prose, checkpoint text, Manual passages, "your words" | 14-22px (`--size-prose`, `--size-heading`) |
| Fraunces (`--font-display`) | Display headings — **opt-in only**, for genuine big moments: the wordmark, page titles ("Your Manual.", the Home greeting), the large checkpoint headlines. Not for body or labels. | 28-32px |
| Plus Jakarta Sans (`--font-sans`) | Conversational UI: chat messages, buttons, input, form labels | 14-15px (`--size-body`) |
| JetBrains Mono (`--font-mono`) | Metadata: nav labels, status lines, timestamps, progress indicators. Always uppercase with letter-spacing. | 12-13px (`--size-meta`) |

12px is the minimum text size anywhere in the product. Uppercase + letter-spacing preserves the "metadata" feel at 12px — do not go smaller.

### Color Usage
- `--session-ink` for primary text
- `--session-ink-ghost` for secondary
- `--session-ink-faded` for tertiary (labels, metadata)
- `--session-ink-hairline` for borders
- `--session-persona` for the Jove accent (sage in dark, navy #21436B in light)
- `--session-linen` for surface background

**Contrast floor.** All text must pass WCAG AA (≥4.5:1 on the linen surface). `--session-ink-ghost` and `--session-ink-faded` are the lowest-contrast tokens approved for body text. `--session-ink-whisper` is decorative only — never for text. When adjusting tokens, verify contrast against `--session-linen` (#E6E0D4) before shipping.

Full token list lives in `globals.css`. Agent reads the file for exact values. Dark void tokens (`--color-void`, `--color-surface`, `--color-text`, `--color-text-dim`, `--color-text-ghost`) are deprecated. Do not use in new work.

### Component Rules
- Message rendering, checkpoint cards, typing indicator, and error display stay in `MobileSession.tsx`. Do not extract these into separate components.
- New chat UI features go in MobileSession unless fully independent of the message list.
- Do not duplicate `renderMarkdown` or type interfaces. Import from `@/lib/utils/format` and `@/lib/types`.

## Dead Features

Do not reintroduce any of the following. These were deliberately removed.

Calibration / calibration_ratings · PromptCards · Old onboarding (OnboardingOverlay / useOnboarding) · Synthetic first message · Gate UI · Advisor mode (collapsed into Jove situation mode) · SessionTimer · Entry Sequence UI · Insights page · Reactive orb · Session hub idle state · Sound / audio · Ambient particles · Resonant content (URL detection + fetch; replaced by Upload mode) · Guided-intake door + section picker (`---sections---` / `---start-situation---` markers, SectionPicker, chip-response path; modules replaced it — ADR-053) · Upload door (pasting is a capability in any conversation; the door + dual message cap are gone) · Per-mode door feature gates (a module's `enabled` flag is the only door switch) · The five fixed Manual sections as code (`LAYERS`-driven grouping; the Manual groups by modules now)

**Shelved, NOT dead (do not delete, do not re-wire without a founder call):** the "Bring a situation" open entrance (`situation-copy.ts`, dormant) — a planned future product on top of the module structure. See ADR-053.

(Removed from this list 2026-06-10 with founder sign-off: "Desktop layout" — superseded by the desktop shell initiative; the entry referred to a pre-vitrine layout that no longer exists. "Theme toggle" — stale; a theme toggle has been live in the DesktopVitrine colophon and ships in the desktop sidebar.)

## Pre-Launch Legal Requirements

These must be completed before public launch:

- Clinical advisory board (licensed clinical psychologist + health tech attorney)
- Terms of service with explicit "not healthcare" framing
- Crisis protocol built, tested, and published on website
- AI disclosure (clear, recurring, natural — not a one-time checkbox)
- Data protection (encryption at rest and in transit, never sell user data)
- Marketing language audit against the guidelines above
- Jove behavior audit against the "does / does not" boundaries above
- Geo-restriction for states where legal framework doesn't accommodate the product
- Quarterly regulatory review cadence established
