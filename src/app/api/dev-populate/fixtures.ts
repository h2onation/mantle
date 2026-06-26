// Dev-populate fixtures: one sample Manual entry per section.
//
// These are NOT hand-authored. Each is the output of the REAL composeManualEntry
// (the same Opus path the live checkpoint uses), captured once and frozen here.
// That keeps a single source of truth for how an entry is written — the route
// just inserts these rows, with zero model calls per click. The result is a
// deterministic, realistic Manual for looking at the UI; for live end-to-end
// composition, use the Simulate tool instead.
//
// REGENERATE (only when the composition prompt in confirm-checkpoint.ts drifts):
//   1. Write a throwaway `scripts/_capture-populate-fixtures.ts` that loads
//      .env.local (see scripts/voice-ab.ts), imports composeManualEntry, and for
//      each section feeds a one-paragraph drafted reflection as `checkpointText`
//      with empty conversationHistory / languageBank / manualComponents. The
//      `content` fields below double as good seed drafts.
//   2. `npx tsx scripts/_capture-populate-fixtures.ts`
//   3. Verify each composed `section` matches its intended slug (every entry
//      homes on one of the five), then paste the JSON below.
//   4. Delete the throwaway script — it is not committed (Complexity Gate).

export interface PopulateFixture {
  /** Life-area section slug — the structural key the Manual groups by. */
  section: string;
  /** Composed title (the line shown in the Manual list). */
  name: string;
  content: string;
  /** Closed-set tags from the composer ("strength" / relationship sub-tags). */
  tags: string[];
  /** Compressed summary used when older entries are shown back to Jove. */
  summary: string;
  key_words: string[];
}

export const POPULATE_FIXTURES: PopulateFixture[] = [
  {
    section: "relationships",
    name: "I go offline exactly when the people closest to me need words",
    content: `When voices get raised, I go offline. It isn't stonewalling — input shuts down and I can't reach my own words until later, by which point the moment has passed. And the way I care routes through doing, not saying: I fix the thing, I remember the detail, I show up. So the people closest to me — the ones scanning hardest for spoken reassurance — end up least sure of where they stand with me, because the one channel I go quiet on is the one that matters most when stakes are highest. The gap they feel isn't absence of care; it's the care never coming through the channel they're listening on.`,
    tags: [],
    summary:
      "Under raised voices their system goes offline and words are unreachable until later; care routes through doing, so those closest scan hardest for spoken reassurance on the one channel that goes quiet.",
    key_words: [
      "go offline",
      "shuts down",
      "can't reach my words",
      "care through doing",
      "spoken reassurance",
    ],
  },
  {
    section: "work-money",
    name: "I go quiet under pressure while I get solid ground under my feet",
    content: `When the pressure spikes and other people are waiting on me, I go quiet and inward — I research, I try to get solid ground under my feet before I move. The processing is the work, but from the outside it looks like I've checked out. By the time I surface with something, the situation has often moved without me, and there's damage to walk back that wouldn't be there if I'd just said something half-formed earlier. The bind: the thing that makes my answer worth waiting for — that I won't move until I actually know — is the same thing that makes me look absent when people need a signal. I can absorb a lot inside this. Being underestimated, a stretch of bad calls, a role that's smaller than I want — fine, as long as the work still has a path to mattering. What I can't absorb is being asked to misrepresent what I know is true. That's the line; everything else is negotiable.`,
    tags: [],
    summary:
      "Under high-stakes pressure he goes quiet and inward to get solid ground before moving; it reads as withdrawal and decisions move without him. He can absorb a lot if the work matters, but not being asked to misrepresent what he knows is true.",
    key_words: [
      "go quiet",
      "solid ground",
      "withdrawal",
      "misrepresent",
      "path to mattering",
    ],
  },
  {
    section: "routines-structure",
    name: "I go offline when plans change while my system recalculates",
    content: `When a plan changes I go still. From the outside it reads as resistance or sulking, but my system has gone offline while it integrates the new variables. Give me five minutes and I'm fine. Interrupt me in the first thirty seconds — ask what's wrong, push for a reaction — and I lose another five, because the recalculation restarts each time something new gets added.

The routines I run aren't preferences. They're load-bearing. The morning sequence, the known route, the buffer between things — each one is quietly absorbing a cost I'd otherwise be paying in the moment, in real time, with whatever attention I have left. That's why when one collapses it isn't the single change that lands hardest. It's that the scaffolding I was leaning on for everything else just went out from under me, and now every other thing in the day is also uncovered.`,
    tags: [],
    summary:
      "When plans change he goes still while his system goes offline to integrate new variables; interruption restarts the recalculation. His routines aren't preferences but load-bearing scaffolding absorbing costs he'd otherwise pay in the moment.",
    key_words: [
      "offline",
      "recalculation",
      "load-bearing",
      "scaffolding",
      "buffer",
      "interrupt",
    ],
  },
  {
    section: "sensory-burnout",
    name: "I hold each layer quietly until my body decides for me",
    content: `I don't break at the last thing. I break because the last thing landed on top of everything already there. The stack builds quietly — a too-loud voice, a bright room, a plan that fell through — none of it individually loud enough to name. Mid-stack, none of it looks like enough to say something about, so I hold each layer until my body makes the decision my words couldn't. From the outside it looks like an overreaction to a light switch; from inside, the lights were just what arrived when I was already full. Recovery isn't optional downtime — it's the maintenance that keeps the next day from starting already half-full.`,
    tags: [],
    summary:
      "He doesn't break at the last thing; the stack builds quietly because no single layer looks loud enough to name, so he holds each one until his body decides for him.",
    key_words: [
      "stack",
      "too-loud",
      "half-full",
      "the last thing",
      "holding each layer",
    ],
  },
  {
    section: "interests-flow",
    name: "I lose track of time when something pulls me all the way in",
    content: `When something real catches me, the noise drops away and time stops mattering. I go all the way down — I see the whole map, I catch what others miss, and the work comes out with a depth that surprises people who only know the scattered version of me. The same intensity that costs me in a loud meeting is what pays off here; it's the same wiring, just given the right conditions. What I need to protect isn't the focus itself — that takes care of itself once I'm in. It's the conditions that let me get there: an uninterrupted stretch, a problem worth the descent, and permission to disappear into it without having to surface and account for myself partway through.`,
    tags: ["strength"],
    summary:
      "When a real problem catches him, he drops into hours of uninterrupted depth where noise falls away and he sees the whole map; the conditions, not the focus, are what need protecting.",
    key_words: [
      "disappear into it",
      "whole map",
      "uninterrupted stretch",
      "go all the way down",
      "noise drops away",
    ],
  },
];
