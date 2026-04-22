import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Read files as strings so the test catches deletions, renames, and regressions
// without needing to mount React components.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("PR3 onboarding copy pass", () => {
  // ─── EntryScreen ─────────────────────────────────────────────────────────
  describe("EntryScreen", () => {
    const src = read("src/components/onboarding/EntryScreen.tsx");

    it("uses a single direct headline", () => {
      // Hero headline reads as a plain statement of the product's
      // output: "A private manual of how you work." No line breaks
      // forced in the source; the terminal "." is wrapped in a span
      // for the sage-accent treatment.
      expect(src).toContain("A private manual of how you work");
    });

    it("uses a plain-English subhead with the product's promise", () => {
      // Three short sentences, no affectation. Wordmark spelling is
      // "my walnut" (two words) — matches the marketing convention.
      expect(src).toContain("my walnut is an AI that helps you write one");
      expect(src).toContain("Nothing enters unless you confirm it.");
      expect(src).toContain("Built for neurodivergent adults.");
    });

    it("shows a sample Manual entry as the hero's visual anchor", () => {
      // Replaces the sand-ripples photograph / rotating specimen /
      // vignette. A real entry rendered as type: kicker + italic
      // first-person statement + prose elaboration. Assert on
      // short substrings — the JSX formatter wraps these long
      // phrases across source lines.
      expect(src).toContain("How I process things");
      expect(src).toContain("When plans shift without warning");
      expect(src).toContain("voice is the first thing");
      expect(src).toContain("speech is where");
    });

    it("uses three plain numbered method steps", () => {
      // No roman numerals, no gerund chapter titles. Short,
      // functional prose. Persona name is interpolated via
      // PERSONA_NAME, asserted without the name.
      expect(src).toContain("Talk to {PERSONA_NAME} about things on your mind.");
      expect(src).toContain("Conversations, situations, patterns you keep noticing.");
      expect(src).toContain("{PERSONA_NAME} proposes patterns it sees. You confirm what&rsquo;s true.");
      expect(src).toContain("Nothing gets written without your explicit confirmation.");
      expect(src).toContain("The patterns become your Manual.");
      expect(src).toContain("Yours to keep");
      expect(src).toContain("share with the people you trust");
    });

    it("lists the five Manual layers", () => {
      // Product surface area shown literally. Reinforces what a
      // Manual actually is for a first-time visitor.
      expect(src).toContain("Your Manual, in five layers");
      expect(src).toContain("Some of my patterns");
      expect(src).toContain("How I process things");
      expect(src).toContain("What helps");
      expect(src).toContain("How I show up with people");
      expect(src).toContain("Where I&rsquo;m strong");
    });

    it("uses 'Join the waitlist' as the primary CTA pointing to /waitlist", () => {
      expect(src).toContain("Join the waitlist");
      expect(src).toContain('href="/waitlist"');
    });

    it("uses 'Already have access? Log in.' as the secondary entry to login", () => {
      expect(src).toContain("Already have access?");
      expect(src).toContain("Log in.");
    });

    it("preserves the 'my walnut' wordmark at the top", () => {
      expect(src).toContain("my walnut");
    });

    it("declares responsive breakpoints", () => {
      expect(src).toContain("min-width: 768px");
      expect(src).toContain("min-width: 1024px");
    });

    // ── Dead copy and old concepts (negative assertions) ─────

    it("does NOT carry editorial-pastiche paratext or colophon", () => {
      // The previous "Issue One · Spring 2026" masthead + "Set in
      // Newsreader. Printed on linen..." colophon were costume.
      // Both removed in the clear/premium pass.
      expect(src).not.toContain("Issue One");
      expect(src).not.toContain("Spring 2026");
      expect(src).not.toContain("Set in Newsreader");
      expect(src).not.toContain("Assembled in conversation");
    });

    it("does NOT contain gerund chapter titles", () => {
      // The "On bringing / On listening / On composing / On
      // sharing" chapter affect was twee. Replaced with three
      // plain method steps.
      expect(src).not.toContain("On bringing");
      expect(src).not.toContain("On listening");
      expect(src).not.toContain("On composing");
      expect(src).not.toContain("On sharing");
    });

    it("does NOT contain the rotating specimen or pull-quote", () => {
      // Both removed in the clear/premium pass. Note: "Nothing
      // enters the manual" (with article) was the pull-quote;
      // the current subhead's "Nothing enters unless you confirm
      // it" is unrelated phrasing without "the manual".
      expect(src).not.toContain("ROTATING_EXAMPLES");
      expect(src).not.toContain("You shut down and people think you");
      expect(src).not.toContain("Nothing enters the manual");
    });

    it("does NOT reference the removed HeroManualVignette or sand-ripples image", () => {
      expect(src).not.toContain("HeroManualVignette");
      expect(src).not.toContain("hero-sand");
    });

    it("does NOT contain the previous 'Map your operating system.' headline", () => {
      expect(src).not.toContain("Map your operating system.");
    });

    it("does NOT contain the old 'You understand yourself in fragments.' headline", () => {
      expect(src).not.toContain("You understand yourself in fragments.");
    });

    it("does NOT contain the old 'That's why' prefix pattern", () => {
      expect(src).not.toContain("That&apos;s why");
    });

    it("does NOT contain a Create account link", () => {
      expect(src).not.toContain("Create account");
      expect(src).not.toContain("onSignup");
    });

    it("does NOT contain (Coming soon) qualifiers", () => {
      expect(src).not.toContain("(Coming soon)");
      expect(src).not.toContain("mw-entry-soon");
    });
  });

  // ─── InfoScreens ─────────────────────────────────────────────────────────
  describe("InfoScreens", () => {
    const src = read("src/components/onboarding/InfoScreens.tsx");

    it("contains the 2 new body beats", () => {
      // Persona name is interpolated via PERSONA_NAME constant; assert the
      // surrounding copy without the name.
      expect(src).toContain("You&rsquo;ll build your Manual by talking to {PERSONA_NAME}.");
      expect(src).toContain("Bring real situations &mdash;");
      expect(src).toContain("{PERSONA_NAME} reflects patterns back.");
      expect(src).toContain("You decide what goes in.");
      expect(src).toContain("Builds best when you show up most days for the first two weeks.");
    });

    it("does NOT contain the old 'finds the pattern underneath' headline", () => {
      expect(src).not.toContain("finds the pattern underneath");
    });

    it("does NOT contain the old 4-paragraph body copy", () => {
      expect(src).not.toContain("You&rsquo;ll build a manual.");
      expect(src).not.toContain("You build it by talking to {PERSONA_NAME}.");
      expect(src).not.toContain("Your manual is yours.");
    });
  });

  // ─── SeedScreen ──────────────────────────────────────────────────────────
  describe("SeedScreen", () => {
    const src = read("src/components/onboarding/SeedScreen.tsx");

    it("contains the 2 new body beats", () => {
      // Persona name is interpolated via PERSONA_NAME constant.
      expect(src).toContain("{PERSONA_NAME} is AI. It surfaces patterns using psychological frameworks.");
      expect(src).toContain("It doesn&rsquo;t diagnose, and it&rsquo;s not trying to fix how you work.");
      expect(src).toContain("You&rsquo;re the authority on your own experience.");
      expect(src).toContain("Short answers are fine.");
      expect(src).toContain("Leave and come back whenever.");
    });

    it("does NOT contain the old 3-paragraph body copy", () => {
      expect(src).not.toContain("identifies patterns using published frameworks");
      expect(src).not.toContain("You can leave and come back whenever.");
    });

    it("uses 'I'm 18 or older' (not 'I am')", () => {
      expect(src).toContain("I&rsquo;m 18 or older");
      expect(src).not.toContain("I am 18 or older");
    });

    it("uses new disclaimer about complement to therapy", () => {
      // Persona name is interpolated via PERSONA_NAME constant.
      expect(src).toContain("{PERSONA_NAME} is a great complement to therapy");
    });

    it("does NOT set dead localStorage keys", () => {
      expect(src).not.toContain("mantle_age_confirmed");
      expect(src).not.toContain("mantle_onboarding_completed");
    });

    it("clears first-session flags before creating a fresh anonymous user", () => {
      // Prevents a browser that previously completed a first session from
      // treating a brand-new anonymous user as returning and skipping the
      // welcome block with chips.
      expect(src).toContain('removeItem("mw_first_session_completed")');
      expect(src).toContain('removeItem("mw_signin_banner_dismissed")');
    });

    it("does NOT contain old 'works best when' headline", () => {
      expect(src).not.toContain("works best when you");
    });
  });

  // ─── AuthPromptModal ─────────────────────────────────────────────────────
  describe("AuthPromptModal", () => {
    const src = read("src/components/onboarding/AuthPromptModal.tsx");

    it("uses 'Keep your manual' headline", () => {
      expect(src).toContain("Keep your manual");
      expect(src).not.toContain("Save your manual");
    });

    it("uses the new body copy", () => {
      expect(src).toContain("Create an account so you don&rsquo;t lose what you&rsquo;ve built.");
    });

    it("does NOT use em dashes in disclaimer", () => {
      expect(src).not.toContain("&mdash;");
    });
  });

  // ─── MobileSession welcome block and chips ──────────────────────────────
  describe("MobileSession", () => {
    const src = read("src/components/mobile/MobileSession.tsx");

    it("uses new welcome chip labels", () => {
      expect(src).toContain("I have a situation I want to work through");
      expect(src).toContain("I know something about myself I want to capture");
      expect(src).toContain("I just need to think out loud");
    });

    it("does NOT contain old chip labels", () => {
      expect(src).not.toContain("I have questions about how this works");
      expect(src).not.toContain("I have a specific situation on my mind");
      expect(src).not.toContain("could use help finding a starting point");
    });

    // Gate 8: the welcome-prose block (three-paragraph Jove intro +
    // "no wrong place to start" line) was deleted. Modal 1 carries
    // that teaching now. The chips remain as the empty-state
    // affordance.
    it("does NOT contain the old welcome-prose block", () => {
      expect(src).not.toContain("This is where you talk to {PERSONA_NAME}.");
      expect(src).not.toContain("Navigate a situation.");
      expect(src).not.toContain("Write to your manual directly.");
      expect(src).not.toContain("Just get it out.");
      expect(src).not.toContain("There is no wrong place to start");
    });

    it("does NOT contain old 'start small' welcome line", () => {
      expect(src).not.toContain("start small and see where you");
    });

    it("uses new returning-user prompt", () => {
      expect(src).toContain("What&rsquo;s going on? Or we can pick up where we left off.");
      expect(src).not.toContain("What&apos;s on your mind? Or if it helps");
    });

    it("uses new sign-in nudge copy", () => {
      expect(src).toContain("Create an account to keep your manual");
      expect(src).not.toContain("Sign in to keep your progress");
    });

    // Track A Phase 7-Low (7a): checkpoint card action label revisions.
    // Underlying action values (confirmed/refined/rejected) are unchanged
    // — only the display labels move.
    it("uses the new checkpoint card action labels", () => {
      expect(src).toContain("Put it in my Manual");
      expect(src).toContain("Close but not quite");
      expect(src).toContain("This is not me");
    });

    it("does NOT contain the old checkpoint card action labels", () => {
      expect(src).not.toContain("Yes, write to manual");
      // "Not quite" is also a substring of "Close but not quite" so an
      // exact-string negative would fail. Asserting on the old standalone
      // button text (with its closing tag context) is more precise — but
      // since both labels live in JSX with the same </button> closing,
      // we use the surrounding whitespace pattern from the source.
      expect(src).not.toMatch(/>\s*Not quite\s*</);
      expect(src).not.toMatch(/>\s*Not at all\s*</);
    });

    // Track A Phase 7-Mid (7c): refinement-ceiling card UI fires on
    // refinement_count >= 2.
    it("renders the refinement-ceiling inline message and two-button fork", () => {
      expect(src).toContain("Close but not quite is fine.");
      expect(src).toContain(
        "Want me to put it in as it is, or let it go and we come back to it?"
      );
      expect(src).toContain("Put it in as it is");
      expect(src).toContain("Let it go");
    });

    it("dispatches the new deferred action from the ceiling 'Let it go' button", () => {
      // "Let it go" must dispatch the new "deferred" action — NOT
      // "rejected". The two share DB behavior, but the system message
      // differs so Jove skips the POST-REJECTION fixed line. The user
      // already explained twice what was off; the rejection probe
      // would be wrong here.
      expect(src).toMatch(/setCheckpointActionState\("deferred"\)/);
      expect(src).toMatch(/confirmCheckpoint\("deferred"\)/);
    });

    it("computes refinement-ceiling state from refinement_count >= 2", () => {
      // The threshold is "third attempt" — count 0 (initial) + count 1
      // (after first refinement) → user sees normal UI; count 2 (after
      // second refinement) → user sees ceiling UI on the next render.
      expect(src).toContain("refinement_count");
      expect(src).toMatch(/>=\s*2/);
    });
  });

  // ─── docs/rules.md marketing language ───────────────────────────────────
  describe("docs/rules.md marketing language", () => {
    const src = read("docs/rules.md");

    it("contains 'Use' and 'Never use' lists", () => {
      expect(src).toMatch(/### Use\b/);
      expect(src).toMatch(/### Never use\b/);
    });

    it("lists deficit-framing words in 'Never use'", () => {
      expect(src).toContain("deficit");
      expect(src).toContain("disorder");
      expect(src).toContain("suffer from");
    });
  });

  // ─── terms page product description ────────────────────────────────────
  describe("terms/page.tsx", () => {
    const src = read("src/app/terms/page.tsx");

    it("uses new product description", () => {
      expect(src).toContain("mywalnut is a self-understanding platform.");
      expect(src).toContain("legal accommodation document");
    });
  });

  // ─── share-manual share text ───────────────────────────────────────────
  describe("share-manual.ts", () => {
    const src = read("src/lib/utils/share-manual.ts");

    it("uses new share text", () => {
      expect(src).toContain("This is a guide to how they work, written in their own words.");
      expect(src).toContain("Each entry was confirmed by them as accurate.");
    });
  });
});
