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

    it("uses hero-scale 'mywalnut.' wordmark with walnut period", () => {
      expect(src).toContain("mywalnut");
      expect(src).toContain("var(--session-walnut)");
    });

    it("uses 'A private manual' eyebrow", () => {
      expect(src).toContain("A private manual");
    });

    it("uses italic Spectral thesis line with persona name", () => {
      expect(src).toContain("A behavioral playbook for how you actually work");
      expect(src).toContain("{PERSONA_NAME}");
    });

    it("uses 'Sign in' as the primary CTA (closed beta)", () => {
      expect(src).toContain("Sign in");
      expect(src).toContain("onLogin");
      expect(src).not.toContain("Already have access?");
    });

    it("includes privacy and terms links", () => {
      expect(src).toContain('href="/privacy"');
      expect(src).toContain('href="/terms"');
    });

    // ── Dead copy and old concepts (negative assertions) ─────

    it("does NOT carry editorial-pastiche paratext or colophon", () => {
      expect(src).not.toContain("Issue One");
      expect(src).not.toContain("Spring 2026");
      expect(src).not.toContain("Set in Newsreader");
      expect(src).not.toContain("Assembled in conversation");
    });

    it("does NOT contain gerund chapter titles", () => {
      expect(src).not.toContain("On bringing");
      expect(src).not.toContain("On listening");
      expect(src).not.toContain("On composing");
      expect(src).not.toContain("On sharing");
    });

    it("does NOT contain the rotating specimen or pull-quote", () => {
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

    it("does NOT contain (Coming soon) qualifiers", () => {
      expect(src).not.toContain("(Coming soon)");
      expect(src).not.toContain("mw-entry-soon");
    });

    it("does NOT contain the old multi-section landing page content", () => {
      expect(src).not.toContain("Join the waitlist");
      expect(src).not.toContain("Your Manual, in five layers");
      expect(src).not.toContain("How it works");
    });
  });

  // ─── InfoScreens ─────────────────────────────────────────────────────────
  describe("InfoScreens", () => {
    const src = read("src/components/onboarding/InfoScreens.tsx");

    it("contains the disclaimer prose", () => {
      expect(src).toContain("{PERSONA_NAME} is a careful, direct companion.");
      expect(src).toContain("helps you notice patterns in how you work");
      expect(src).toContain("the things you confirm become entries in your Manual");
      expect(src).toContain("isn&rsquo;t therapy");
      expect(src).toContain("Crisis Support");
    });

    it("uses 'Before you begin' eyebrow", () => {
      expect(src).toContain("Before you begin");
    });

    it("uses 'What this is, and isn't' heading with walnut period", () => {
      expect(src).toContain("What this is, and isn&rsquo;t");
      expect(src).toContain("var(--session-walnut)");
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
      expect(src).toContain("{PERSONA_NAME} is a great complement to therapy");
    });

    it("does NOT set dead localStorage keys", () => {
      expect(src).not.toContain("mantle_age_confirmed");
      expect(src).not.toContain("mantle_onboarding_completed");
    });

    it("clears first-session flags before creating a fresh anonymous user", () => {
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

    it("uses entry card labels instead of old welcome chips", () => {
      expect(src).toContain("Navigate a situation");
      expect(src).toContain("Guided intake");
      expect(src).toContain("Upload");
      expect(src).not.toContain("I just need to think out loud");
    });

    it("sends a kickstart message when Navigate a situation is tapped", () => {
      expect(src).toContain('sendMessage("I have a situation I want to work through")');
    });

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

    it("uses entry cards for empty-state welcome", () => {
      expect(src).toContain("Navigate a situation");
      expect(src).toContain("Guided intake");
      expect(src).not.toContain("What&apos;s on your mind? Or if it helps");
    });

    it("uses new sign-in nudge copy", () => {
      expect(src).toContain("Create an account to keep your manual");
      expect(src).not.toContain("Sign in to keep your progress");
    });

    it("uses the new checkpoint card action labels", () => {
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).toContain("Add to my Manual");
      expect(overlay).toContain("Jove, let&rsquo;s rework together");
      expect(overlay).toContain("Discard");
    });

    it("does NOT contain the old checkpoint card action labels", () => {
      expect(src).not.toContain("Yes, write to manual");
      expect(src).not.toMatch(/>\s*Not quite\s*</);
      expect(src).not.toMatch(/>\s*Not at all\s*</);
    });

    it("renders the refinement-ceiling inline message in the overlay", () => {
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).toContain("Close but not quite is fine.");
      expect(overlay).toContain("let it go");
    });

    it("dispatches actions via onAction callback from the overlay", () => {
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).toContain("onAction(\"confirmed\")");
      expect(overlay).toContain("onAction(\"refined\")");
      expect(overlay).toContain("onAction(\"rejected\")");
      expect(overlay).toContain("onAction(\"deferred\")");
    });

    it("computes refinement-ceiling state from refinement_count >= 2", () => {
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
