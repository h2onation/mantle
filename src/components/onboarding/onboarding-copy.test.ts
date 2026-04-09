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

    it("uses new headline 'Map your operating system.'", () => {
      expect(src).toContain("Map your operating system.");
    });

    it("uses new subhead", () => {
      expect(src).toContain("Navigate the world with it. Share it with the people around you.");
    });

    it("does NOT contain the old headline", () => {
      expect(src).not.toContain("You understand yourself in fragments.");
    });

    it("does NOT contain the old 'That's why' prefix pattern", () => {
      expect(src).not.toContain("That&apos;s why");
    });

    it("does NOT contain a Create account link", () => {
      expect(src).not.toContain("Create account");
      expect(src).not.toContain("onSignup");
    });

    it("contains all 10 rotation sentences", () => {
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

    it("contains all 4 body paragraphs", () => {
      expect(src).toContain("You&rsquo;ll build a manual.");
      expect(src).toContain("You build it by talking to Sage.");
      expect(src).toContain("Over time, Sage identifies patterns");
      expect(src).toContain("Your manual is yours.");
    });

    it("does NOT contain the old 'Sage finds the pattern underneath' headline", () => {
      expect(src).not.toContain("Sage finds the pattern underneath");
    });
  });

  // ─── SeedScreen ──────────────────────────────────────────────────────────
  describe("SeedScreen", () => {
    const src = read("src/components/onboarding/SeedScreen.tsx");

    it("contains all 3 body paragraphs", () => {
      expect(src).toContain("Sage is AI. It identifies patterns using published frameworks");
      expect(src).toContain("You&rsquo;re the authority on your own experience.");
      expect(src).toContain("Short answers are fine.");
    });

    it("uses 'I'm 18 or older' (not 'I am')", () => {
      expect(src).toContain("I&rsquo;m 18 or older");
      expect(src).not.toContain("I am 18 or older");
    });

    it("uses new disclaimer about complement to therapy", () => {
      expect(src).toContain("Sage is a great complement to therapy");
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

    it("contains new welcome block with three bold labels", () => {
      expect(src).toContain("This is where you talk to Sage.");
      expect(src).toContain("Navigate a situation.");
      expect(src).toContain("Write to your manual directly.");
      expect(src).toContain("Just get it out.");
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
