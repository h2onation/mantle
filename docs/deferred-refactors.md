# Deferred refactors

Out-of-scope items spotted during refactors but not addressed in the same session. Each entry is a small, well-scoped follow-up.

- Reconcile guided-intake-copy.test.ts type — uses ConversationContext shape, should call with OneOnOnePromptOptions shape. 2 pre-existing TS errors at lines 31, 51.
