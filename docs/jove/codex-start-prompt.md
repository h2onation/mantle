# First Codex Prompt

Place this complete package at `docs/jove/` in the mywalnut repository. Start Codex in Plan mode and paste the prompt below.

---

We are implementing Jove, the mywalnut mascot. The complete approved source of truth is in `docs/jove/`.

Goal:
Determine the safest minimal architecture for adding Jove to this existing Next.js application. Do not modify any files during this step.

Required reading:

- `docs/jove/README.md`
- `docs/jove/character-bible.md`
- `docs/jove/visual-spec.md`
- `docs/jove/motion-spec.md`
- `docs/jove/scene-manifest.md`
- `docs/jove/implementation-contract.md`
- All four approved images under `docs/jove/references/`
- Any repository `AGENTS.md` instructions

Inspect:

1. Next.js version and router structure.
2. TypeScript and styling conventions.
3. Existing animation dependencies and reduced-motion patterns.
4. Existing chat bubble and response-loading components.
5. Existing development galleries, Storybook, or visual test routes.
6. Existing feature-flag conventions.
7. Existing tests, lint, type-check, build, and visual verification commands.
8. Any architecture or rendering constraint that conflicts with the Jove implementation contract.

Return:

- Relevant file paths.
- The smallest recommended component structure.
- The best location for a development gallery.
- The safest first real chat integration point.
- Existing tools or conventions that should be reused.
- Risks, unknowns, or conflicts.
- Exact checks that must run after implementation.
- A proposed implementation sequence of no more than five bounded steps.

Constraints:

- Do not edit files.
- Do not add dependencies.
- Do not propose backend or LLM changes.
- Do not expand the approved character or scene inventory.
- Do not assume file locations; inspect them.
- If confidence is below high because essential context is missing, stop and state exactly what is missing.

Done when:
I have an evidence-based repository-specific plan that I can review before authorizing any code changes.

---

Do not proceed to implementation until the inspection report has been reviewed.
