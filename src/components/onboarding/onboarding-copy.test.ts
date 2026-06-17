import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Read files as strings so the test catches deletions, renames, and regressions
// without needing to mount React components.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("PR3 onboarding copy pass", () => {
  // EntryScreen was deleted 2026-06-10: /login now renders LoginScreen
  // directly. The marketing landing at / owns the brand moment.

  // ─── SeedScreen (merged consent screen) ──────────────────────────────────
  // 2026-06-17: InfoScreens + PersonaModeScreen were folded away (onboarding
  // collapsed to one post-login screen). SeedScreen now carries the
  // proposition, affirmative provenance, the single clinical boundary, the
  // crisis pointer, and the age gate.
  describe("SeedScreen", () => {
    const src = read("src/components/onboarding/SeedScreen.tsx");

    it("contains the merged trust + proposition beats", () => {
      expect(src).toContain("{PERSONA_NAME} is AI.");
      expect(src).toContain("notice patterns in how you work");
      expect(src).toContain("from what you actually say, in your own words");
      expect(src).toContain("things you confirm become entries in your Manual");
      expect(src).toContain("You&rsquo;re the authority on how you work");
      expect(src).toContain("isn&rsquo;t here to fix you");
      expect(src).toContain("Short answers are fine.");
      expect(src).toContain("Leave and come back whenever.");
    });

    it("uses the 'What this is, and isn't' heading with walnut period", () => {
      expect(src).toContain("What this is, and isn&rsquo;t");
      expect(src).toContain("var(--session-walnut)");
    });

    it("states the clinical boundary once, with the crisis pointer", () => {
      expect(src).toContain("This isn&rsquo;t therapy, and {PERSONA_NAME} isn&rsquo;t a clinician.");
      expect(src).toContain("not a replacement");
      expect(src).toContain("Crisis Support is one tap away");
    });

    it("does NOT contain the old framework-pointer, standalone no-diagnosis line, or negation", () => {
      expect(src).not.toContain("surfaces patterns using psychological frameworks");
      expect(src).not.toContain("doesn&rsquo;t diagnose or treat");
      expect(src).not.toContain("It doesn&rsquo;t diagnose, and it&rsquo;s not trying to fix how you work.");
    });

    it("uses 'I'm 18 or older' (not 'I am')", () => {
      expect(src).toContain("I&rsquo;m 18 or older");
      expect(src).not.toContain("I am 18 or older");
    });

    it("does NOT set dead localStorage keys", () => {
      expect(src).not.toContain("mantle_age_confirmed");
      expect(src).not.toContain("mantle_onboarding_completed");
    });

    it("clears first-session flags before creating a fresh anonymous user", () => {
      expect(src).toContain('removeItem("mw_first_session_completed")');
      expect(src).toContain('removeItem("mw_signin_banner_dismissed")');
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

    it("uses bootstrap (Jove speaks first) when Navigate a situation is tapped", () => {
      expect(src).toContain('startConversation("situation")');
      // The canned message string from before the bootstrap pattern must
      // be gone — no more inverse-engineered intent on turn 1.
      expect(src).not.toContain("I have a situation I want to work through");
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
      expect(overlay).toMatch(/onAction\("confirmed"/);
      expect(overlay).toMatch(/onAction\("refined"\)/);
      expect(overlay).toMatch(/onAction\("rejected"\)/);
      expect(overlay).toMatch(/onAction\("deferred"\)/);
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
