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
  // The Seed copy moved into the admin-editable app-copy registry (the strings
  // are now plain JS with real Unicode punctuation, not JSX entities). The copy
  // assertions read the registry; the structural ones (the walnut-period span,
  // the localStorage logic) still read the component.
  describe("SeedScreen", () => {
    const src = read("src/components/onboarding/SeedScreen.tsx");
    const copy = read("src/lib/persona/app-copy.ts");

    it("contains the merged trust + proposition beats", () => {
      expect(copy).toContain("${PERSONA_NAME} is AI.");
      expect(copy).toContain("notice patterns in how you work");
      expect(copy).toContain("from what you actually say, in your own words");
      expect(copy).toContain("things you confirm become entries in your Manual");
      expect(copy).toContain("You’re the authority on how you work");
      expect(copy).toContain("isn’t here to fix you");
      expect(copy).toContain("Short answers are fine.");
      expect(copy).toContain("Leave and come back whenever.");
    });

    it("uses the 'What this is, and isn't' heading with walnut period", () => {
      expect(copy).toContain("What this is, and isn’t");
      // The styled period stays in the component, beside the heading slot.
      expect(src).toContain("var(--session-walnut)");
      expect(src).toContain("{seed.heading}");
    });

    it("states the clinical boundary once, with the crisis pointer", () => {
      expect(copy).toContain("This isn’t therapy, and ${PERSONA_NAME} isn’t a clinician.");
      expect(copy).toContain("not a replacement");
      expect(copy).toContain("Crisis Support is one tap away");
    });

    it("does NOT contain the old framework-pointer, standalone no-diagnosis line, or negation", () => {
      expect(copy).not.toContain("surfaces patterns using psychological frameworks");
      expect(copy).not.toContain("doesn’t diagnose or treat");
      expect(copy).not.toContain("It doesn’t diagnose, and it’s not trying to fix how you work.");
    });

    it("uses 'I'm 18 or older' (not 'I am')", () => {
      expect(copy).toContain("I’m 18 or older");
      expect(copy).not.toContain("I am 18 or older");
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
    const mobileHome = read("src/components/mobile/MobileHome.tsx");
    const desktopHome = read("src/components/desktop/DesktopHome.tsx");
    // The "ways to begin" module cards: modules are founder-authored rows
    // (the modules table); WaysToBegin renders whatever enabled modules the
    // server sends. Both Home views render WaysToBegin.
    const waysToBegin = read("src/components/home/WaysToBegin.tsx");

    it("Home renders the module cards on both platforms", () => {
      expect(mobileHome).toContain("<WaysToBegin");
      expect(desktopHome).toContain("<WaysToBegin");
    });

    it("Home starts a module conversation via the bootstrap (no canned user message)", () => {
      expect(waysToBegin).toContain("onStartConversation(m.slug)");
      // The canned message string from before the bootstrap pattern must
      // be gone — no more inverse-engineered intent on turn 1.
      expect(waysToBegin).not.toContain("I have a situation I want to work through");
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

    it("MobileSession no longer hosts the retired 3-card entry screen", () => {
      // The 3-card launcher moved to Home (ADR-048 follow-up); MobileSession
      // is now only the active conversation.
      expect(src).not.toContain("Navigate a situation");
      expect(src).not.toContain("Guided intake");
    });

    it("uses new sign-in nudge copy", () => {
      expect(src).toContain("Create an account to keep your manual");
      expect(src).not.toContain("Sign in to keep your progress");
    });

    it("uses the three-way checkpoint action labels (save / close / far-off)", () => {
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).toContain("Add to my Manual");
      expect(overlay).toContain("Close &mdash; the words are off");
      expect(overlay).toContain("That&rsquo;s not it");
    });

    it("does NOT contain the old checkpoint card action labels", () => {
      expect(src).not.toContain("Yes, write to manual");
      expect(src).not.toMatch(/>\s*Not quite\s*</);
      expect(src).not.toMatch(/>\s*Not at all\s*</);
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).not.toContain("Jove, let&rsquo;s rework together");
      expect(overlay).not.toMatch(/>\s*Discard\s*</);
    });

    it("dispatches actions via onAction callback from the overlay", () => {
      const overlay = read("src/components/checkpoint/CheckpointOverlay.tsx");
      expect(overlay).toMatch(/onAction\("confirmed"/);
      expect(overlay).toMatch(/onAction\("refined"\)/);
      expect(overlay).toMatch(/onAction\("rejected"\)/);
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
