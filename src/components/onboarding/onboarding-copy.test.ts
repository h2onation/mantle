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

    it("uses the new headline", () => {
      expect(src).toContain("A more complete manual of how your mind works.");
    });

    it("uses the new subhead", () => {
      expect(src).toContain("Built for neurodivergent adults.");
    });

    it("uses the new explainer heading", () => {
      expect(src).toContain("An oversimplification of how it works:");
    });

    it("contains all 4 numbered explainer beats", () => {
      // Persona name is interpolated via PERSONA_NAME constant; assert
      // the surrounding copy without the name.
      expect(src).toContain("You bring a situation that is on your mind &mdash;");
      expect(src).toContain("Talking it through with {PERSONA_NAME} helps you organize");
      expect(src).toContain("Underneath the conversation, {PERSONA_NAME} is building a model");
      expect(src).toContain("it proposes an entry for your Manual. You decide what&rsquo;s true.");
      expect(src).toContain("Over time, your Manual becomes a more complete picture of how you work.");
      expect(src).toContain("See how your Manual connects with others.");
    });

    it("marks the two future-feature items with the (Coming soon) qualifier", () => {
      // One mid-sentence on item 3, one leading on item 4.
      const matches = src.match(/\(Coming soon\)/g);
      expect(matches?.length).toBe(2);
      expect(src).toContain("mw-entry-soon");
    });

    it("uses the beta line and matches the wordmark spelling", () => {
      // Wordmark is "my walnut" (two words). The supplied copy draft used
      // "mywalnut" (one word) here; we corrected to match the wordmark.
      expect(src).toContain("my walnut is in early access.");
      expect(src).not.toContain("mywalnut");
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
      expect(src).toContain(">my walnut<");
    });

    it("declares responsive breakpoints and an 880px desktop max-width", () => {
      expect(src).toContain("min-width: 768px");
      expect(src).toContain("min-width: 1024px");
      expect(src).toContain("max-width: 880px");
    });

    it("does NOT contain the previous 'Map your operating system.' headline", () => {
      expect(src).not.toContain("Map your operating system.");
    });

    it("does NOT contain the previous subhead", () => {
      expect(src).not.toContain("Navigate the world with it. Share it with the people around you.");
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

    it("contains all 10 rotation sentences (unchanged content)", () => {
      expect(src).toContain("You shut down and people think you");
      expect(src).toContain("You see the pattern everyone else is missing.");
      expect(src).toContain("When you lock in");
      expect(src).toContain("Plans changed and your whole system locked up.");
      expect(src).toContain("You mask all day and no one knows what that costs.");
      expect(src).toContain("You rehearse conversations before you have them.");
      expect(src).toContain("The people you love get a version of loyalty");
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
