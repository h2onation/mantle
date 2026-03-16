---
name: ship
description: Merge current branch to main with required state.md update. Use this for merging only. For other workflows see /cleanup and /evaluate.
---

Merge the current branch to main with a state.md update gate.

1. Run `npm run build` and `npm run test`. Stop if either fails.

2. Read `docs/state.md` and the branch diff (`git diff main...HEAD`).

3. Update `docs/state.md` based on what this branch changes:
   - New feature → add to "Deployed Features" or update "Not Yet Functional"
   - Bug fix → remove from or update "Known Issues"
   - New known issue → add to "Known Issues"
   - Completed work → update "In-Flight Work"
   - Update "Last verified" date on any section you touched

4. Show me the state.md changes before committing.

5. After approval: commit the state.md update, merge into main, push.

If nothing in the branch affects state.md (pure refactor, test-only, docs-only), say so and skip the update. Still run build and test.
