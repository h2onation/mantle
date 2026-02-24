## /ship - Wrap Up and Deploy

1. Run `npm run build` to verify no build errors
2. Run `npx tsc --noEmit` to verify no type errors
3. Stage all changes with specific file names (not `git add -A`)
4. Write a conventional commit message summarizing the work
5. Push to the current branch
6. If on a feature branch, create a PR to main and merge it

Never skip the build check step. If the build fails, fix the errors before committing.
