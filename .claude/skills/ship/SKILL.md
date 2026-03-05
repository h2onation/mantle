# Ship Skill
1. Run `npm run build` to verify no errors
2. Checkout main: `git checkout main`
3. Merge the feature branch INTO main: `git merge <branch-name>`
4. Push to origin: `git push origin main`
5. Delete the feature branch: `git branch -d <branch-name>`
6. If a worktree exists for the branch, delete it FIRST with `git worktree remove <path>` BEFORE deleting the branch
7. Verify cwd is valid after cleanup
8. NEVER delete .env.local or other dotenv files
