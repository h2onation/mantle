# Branch Cleanup Skill
1. List all local branches: `git branch`
2. List worktrees: `git worktree list`
3. For each branch to delete:
   a. First remove its worktree if one exists: `git worktree remove <path>`
   b. Verify cwd is still valid (cd to repo root if needed)
   c. Then delete the branch: `git branch -d <name>`
4. CRITICAL: Never run rm -rf on directories containing .env files
5. After cleanup, run `pwd` and `git branch` to confirm clean state
