---
name: ship
description: Merge current branch to main with required state.md update. Use this for merging only. For other workflows see /cleanup and /evaluate.
---

Merge the current branch to main, then update state.md on main.

state.md is updated AFTER the merge, directly on main. This prevents merge conflicts when shipping multiple branches — state.md is only ever edited linearly on main.

1. Run `npm run build` and `npm run test`. Stop if either fails.

2. Read the branch diff (`git diff main...HEAD`) so you know what changed.

3. Merge into main and push. Do NOT update state.md on the feature branch.

4. After the merge, while on main, read `docs/state.md` and update it based on what the branch changed:
   - New feature → add to "Deployed Features" or update "Not Yet Functional"
   - Bug fix → remove from or update "Known Issues"
   - New known issue → add to "Known Issues"
   - Completed work → update "In-Flight Work"
   - Update "Last verified" date on any section you touched

5. Commit the state.md update directly on main and push. Show the state.md diff in the output so I can see what changed.

If nothing in the branch affects state.md (pure refactor, test-only, docs-only), say so and skip the update. Still run build and test.
