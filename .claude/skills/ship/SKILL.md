# Ship Skill
1. Verify `.env.local` exists. If missing, create the symlink: `ln -s /Users/jeffwaters/mantle/.env.local .env.local` (do NOT copy the file).
2. Run `npm run build` to verify no errors
3. **Review docs for drift**: Check if the changes on this branch affect anything documented in `.claude/SYSTEM_MAP.md` or `.claude/diagrams/*.md`. If so, update those files to reflect the new behavior. Common triggers:
   - New or changed API routes → update `api-routes.md` and SYSTEM_MAP
   - Changed auth flow → update `auth-flow.md`
   - Changed checkpoint/extraction logic → update `sage-conversation-pipeline.md`, `extraction-pipeline.md`
   - Changed SSE events → update `sse-protocol.md`
   - New tables or columns → update `database-schema.md`
   - New user-facing features or flows → update `user-flows.md` and SYSTEM_MAP
   - If in doubt, scan the diagrams and system map for anything that no longer matches reality
   - If diagram or system map updates are needed, commit them as part of the merge (before or alongside the merge commit)
4. Checkout main: `git checkout main`
5. Merge the feature branch INTO main: `git merge <branch-name>`
6. Push to origin: `git push origin main`
7. Do NOT delete the worktree or feature branch. You are running inside the worktree — deleting it destroys your own cwd and causes cascading failures. The worktree and branch will be cleaned up when the next session starts.
8. NEVER delete .env.local or other dotenv files
