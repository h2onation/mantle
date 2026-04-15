# mywalnut — System Map

*Written for a non-technical product lead. No code knowledge required.*

---

## What mywalnut is

mywalnut is a mobile web app where an AI conversationalist called **Jove** has deep, reflective conversations with users. Through these conversations, Jove gradually builds a five-layer behavioral model called the **User Manual** — a structured portrait of who you are and how you operate. Nothing enters the manual unless the user explicitly confirms it.

---

## The five layers

> Canonical layer definitions live in `src/lib/manual/layers.ts` — single source of truth. All consumers (Jove prompts, classifier, mobile UI, tests) import from there.

| Layer | Name | What it captures |
|-------|------|-----------------|
| 1 | Some of My Patterns | What behavior means when the user can't explain it in the moment — silence, freezing, shutdown, masking, signals others misread |
| 2 | How I Process Things | Sensory experience, how change lands, how information gets taken in, what overload looks and feels like |
| 3 | What Helps | What the user needs to function — alone time, routine, environment, recovery, structure (non-negotiable, not preference) |
| 4 | How I Show Up with People | How the user connects, handles conflict, shows care, what withdrawal and closeness look like from their side |
| 5 | Where I'm Strong | What the user brings when conditions are right — strengths in context, not in isolation |

Each layer can hold **1 component** (the integrated portrait) and up to **2 patterns** (specific recurring loops). A fully complete manual has 5 components and up to 10 patterns.

---

## How a conversation works

1. **User sends a message** — could be their opening seed thought or a continuation of an ongoing conversation.

2. **Jove responds** — using context from the user's existing manual, their language patterns (exact phrases they've used), and how deep the current conversation has gone. Jove manages its own conversational style:
   - **Mode 1 (Situation-Led)**: Deepens whatever the user brings up naturally.
   - **Mode 2 (Direct Exploration)**: After 2+ confirmed manual entries, asks more targeted questions.
   - **Mode 3 (Synthesis)**: When all 5 layers have content, weaves cross-layer narrative.

3. **Behind the scenes**, an "extraction" process runs in parallel analyzing the conversation for signals: which layers are being touched, how deep the reflection is, whether the user has said something checkpoint-worthy.

4. **When the moment is right**, Jove composes a proposed manual entry and presents it as a **checkpoint card** — the user sees a polished insight about themselves and can:
   - **Confirm** it (writes to the manual)
   - **Reject** it (Jove pivots)
   - **Refine** it (Jove adjusts)

5. Nothing enters the manual without explicit user consent.

---

## What the user sees

### Four tabs at the bottom
- **Session** — The active conversation with Jove. Includes a side drawer for switching between past conversations.
- **Manual** — The user's growing manual. Populated layers appear in green "meadow" panels. Empty layers show below in dark space.
- **Guidance** — Locked until the first manual entry is confirmed. Currently a placeholder ("coming soon").
- **Settings** — Account, logout, session history, Text Jove (phone linking), dev tools (admin only), data deletion.

### Checkpoint cards
These appear inline in the chat when Jove proposes a manual entry. They show the layer, type (component or pattern), a title, and the composed insight text. The user taps confirm, reject, or refine.

### Explore with Jove
From the manual tab, users can tap "Explore with Jove" on any layer to start a targeted conversation that digs deeper into that area.

---

## How users get in

### New users
1. See the splash screen with rotating "That's why . ." examples
2. Tap "Get Started"
3. Read "How It Works" — a single page explaining the process
4. "Before You Start" — confirm age (18+), read the disclosure, tap Begin
5. An anonymous account is created silently — no email needed upfront
6. Chat opens with a welcome message and three tappable chips to start the conversation

### Guest-to-real conversion
After confirming their first checkpoint, anonymous users are prompted to create a real account (email or Google). This preserves all their conversation history and manual entries.

### Returning users
Log in with email/password or Google OAuth and pick up where they left off.

---

## The extraction system

This is the "intelligence layer" that helps Jove have better conversations. On every turn:

1. A separate AI process reads the last few messages and the existing extraction state.
2. It produces structured analysis: which layers are being touched, how deep the user is going, notable phrases the user has used (the "language bank"), and whether the conversation is approaching checkpoint quality.
3. This analysis is saved and fed back to Jove on the next turn, giving Jove richer context.

**Key detail**: This runs in parallel with Jove's response — the user never waits for it. Jove always sees the analysis from one turn ago, which is fine because the analysis is cumulative.

---

## The checkpoint quality bar

Not every interesting thing the user says becomes a manual entry. The system looks for:
- **Concrete examples** from the user's life (not abstract statements)
- **Mechanism** — the user explaining *why* they do something, not just *what*
- **Charged language** — emotional or vivid phrasing that suggests real self-awareness
- **Behavior-driver link** — connecting actions to underlying motivations

First-time checkpoints have a lower bar (1 example, mechanism OR driver link). Later checkpoints require more depth.

---

## Safety

- If crisis-level content is detected (self-harm, danger), the checkpoint system is disabled entirely for that turn and Jove includes 988 Suicide & Crisis Lifeline information.
- Crisis events are logged to a safety_events table that only the service role can access — never visible to the user.

---

## Admin tools

Admins (set via database, not UI) can access a read-only debug view from Settings:
- See all users and their conversation/component counts
- Browse any user's conversations and full message threads
- View checkpoint metadata and extraction snapshots per message
- View a user's manual entries

All admin access is logged to an audit trail. The admin view is read-only — no ability to modify user data.

---

## Data architecture (simplified)

- **Profiles** — One per user, auto-created when they sign up
- **Conversations** — Each chat session. Stores the latest extraction analysis.
- **Messages** — Every message in every conversation. Checkpoint messages include metadata about what was proposed.
- **Manual Components** — The confirmed manual entries. Tied to the user, not to any specific conversation.
- **Manual Changelog** — Archives previous versions when entries are updated or replaced.

---

## What's not built yet

- **Export manual** — The settings button exists but doesn't do anything yet
- **Guidance tab** — Unlocks after first confirmation but only shows "coming soon"
- **Text Jove (SMS)** — Phone linking and verification works. Inbound SMS route exists as an echo bot. Real Jove conversation over SMS not yet wired up.

---

## Key numbers

- **185 automated tests**, all run in under 1 second with zero API cost (everything mocked)
- **4 AI model calls per turn** (max): Jove response, extraction analysis, checkpoint classification (fallback), manual entry composition (fallback)
- **Sliding window**: Conversations over 50 messages keep the first 2 + last 48 messages
- **Session summary**: Auto-generated (by a smaller AI model) when a conversation goes stale for 30+ minutes

---

## Diagrams

Visual diagrams are available in `.claude/diagrams/`:

| Diagram | What it shows |
|---------|--------------|
| `persona-conversation-pipeline.md` | How a single message flows through the system |
| `database-schema.md` | All tables and their relationships |
| `auth-flow.md` | How users sign up, log in, and convert from guest to real |
| `user-flows.md` | Onboarding, checkpoints, layer discovery, session flow, manual view |
| `extraction-pipeline.md` | How the extraction system analyzes conversations |
| `sse-protocol.md` | How real-time streaming works between server and client |
| `api-routes.md` | All API endpoints and their purposes |

*These diagrams use Mermaid syntax and can be viewed in any Markdown renderer that supports Mermaid (GitHub, VS Code with extensions, etc.).*
