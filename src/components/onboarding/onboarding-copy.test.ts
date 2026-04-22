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
      // Headline breaks across three lines with `<br />` separators and
      // the terminal "." is wrapped in a span for the sage-accent
      // treatment, so assert on the phrase bodies line-by-line.
      expect(src).toContain("A more complete manual");
      expect(src).toContain("of how your mind");
      expect(src).toContain("works");
    });

    it("uses the masthead paratext as publication signal", () => {
      // "Built for neurodivergent adults." subhead was absorbed into
      // the masthead's two-line editorial paratext. The page now reads
      // as a publication — issue number, season, audience note.
      expect(src).toContain("Issue One");
      expect(src).toContain("Spring 2026");
      expect(src).toContain("A manual for neurodivergent adults");
    });

    it("contains all 4 method beats with italic chapter titles", () => {
      // Four chapters now: On bringing / On listening / On composing /
      // On sharing. Italic chapter titles set the editorial register;
      // the prose bodies are preserved verbatim from the earlier
      // numbered beats.
      expect(src).toContain("On bringing");
      expect(src).toContain("On listening");
      expect(src).toContain("On composing");
      expect(src).toContain("On sharing");
      expect(src).toContain("You bring a situation that is on your mind &mdash;");
      expect(src).toContain("Talking it through with {PERSONA_NAME} helps you organize");
      expect(src).toContain("Underneath the conversation, {PERSONA_NAME} is building a model");
      expect(src).toContain("it proposes an entry for your Manual. You decide what&rsquo;s true.");
      expect(src).toContain("Over time, your Manual becomes a more complete picture of how you work.");
      expect(src).toContain("See how your Manual connects with others.");
    });

    it("no longer flags items 3 and 4 with a (Coming soon) qualifier", () => {
      expect(src).not.toContain("(Coming soon)");
      expect(src).not.toContain("mw-entry-soon");
    });

    it("includes the pull-quote chapter break", () => {
      // The product's core promise is elevated to an editorial
      // pull-quote floating between the method and the CTA.
      expect(src).toContain("Nothing enters the manual");
      expect(src).toContain("unless you confirm it");
    });

    it("uses an editorial CTA and drops the filled-plate beta line", () => {
      // The "my walnut is in early access." kicker is gone. The CTA is
      // now a text-only italic link with an arrow ornament, preceded
      // by an italic invitation line. No filled sage plate.
      expect(src).toContain("A manual waits to be written.");
      expect(src).not.toContain("my walnut is in early access");
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
      expect(src).toContain("my walnut");
    });

    it("includes a colophon signature line in the footer", () => {
      // Editorial footer signs the document: one italic colophon
      // line above the legal row.
      expect(src).toContain("Set in Newsreader");
      expect(src).toContain("Assembled in conversation");
    });

    it("declares responsive breakpoints and a 1120px editorial max-width", () => {
      expect(src).toContain("min-width: 768px");
      expect(src).toContain("min-width: 1024px");
      expect(src).toContain("1120px");
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

    it("ships the 10 rotating-specimen sentences", () => {
      // Rotating specimen is back, unframed, set in italic Newsreader
      // below the hero headline. Six-point-five-second dwell; each
      // sentence reads like a photograph.
      expect(src).toContain("ROTATING_EXAMPLES");
      expect(src).toContain("You shut down and people think you");
      expect(src).toContain("The people you love get a version of loyalty");
    });

    it("does NOT import the removed HeroManualVignette component", () => {
      // HeroManualVignette was deleted when the landing reverted to
      // the rotating-specimen approach. No lingering import.
      expect(src).not.toContain("HeroManualVignette");
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
