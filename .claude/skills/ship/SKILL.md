# Ship Skill
1. Run `npm run build` to verify no errors
2. **Review docs for drift**: Check if the changes on this branch affect anything documented in `.claude/SYSTEM_MAP.md` or `.claude/diagrams/*.md`. If so, update those files to reflect the new behavior. Common triggers:
   - New or changed API routes → update `api-routes.md` and SYSTEM_MAP
   - Changed auth flow → update `auth-flow.md`
   - Changed checkpoint/extraction logic → update `sage-conversation-pipeline.md`, `extraction-pipeline.md`
   - Changed SSE events → update `sse-protocol.md`
   - New tables or columns → update `database-schema.md`
   - New user-facing features or flows → update `user-flows.md` and SYSTEM_MAP
   - If in doubt, scan the diagrams and system map for anything that no longer matches reality
   - If diagram or system map updates are needed, commit them as part of the merge (before or alongside the merge commit)
3. Checkout main: `git checkout main`
4. Merge the feature branch INTO main: `git merge <branch-name>`
5. Push to origin: `git push origin main`
6. Delete the feature branch: `git branch -d <branch-name>`
7. If a worktree exists for the branch, delete it FIRST with `git worktree remove <path>` BEFORE deleting the branch
8. Verify cwd is valid after cleanup
9. NEVER delete .env.local or other dotenv files
