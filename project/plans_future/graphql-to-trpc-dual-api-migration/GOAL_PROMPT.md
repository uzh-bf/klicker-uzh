# Goal Prompt: tRPC Migration UX and Client Quality Audit

You are working in the KlickerUZH repository.

Worktree:

`/Volumes/HOME/Git/klicker/klicker-uzh/.claude/worktrees/trpc-dual-api`

Branch:

`codex/trpc-dual-api-migration`

Target branch:

`v3`

Primary plan:

`project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Objective:

Audit and improve already migrated tRPC workflows from a user-experience and
client-quality perspective while keeping GraphQL and tRPC working side by side.

Focus:

- Loading states: every migrated interaction should have a clear initial
  loading state, background-fetch behavior, or skeleton/fallback that fits the
  screen.
- Mutation UX: submits and action buttons should expose pending state, avoid
  double-submit, and reset cleanly after success or failure.
- Failure handling: recoverable errors should show useful UI feedback and leave
  forms/pages interactive.
- Optimistic behavior: use optimistic cache updates only where rollback is
  straightforward and existing product behavior benefits from it.
- Cache/performance: use React Query/tRPC invalidation, `enabled` guards,
  scoped refetching, and existing SSR/prefetch paths deliberately. Avoid broad
  invalidations when a narrower one is available.
- tRPC usage: stay compatible with installed `@trpc/*` `10.45.2` and
  `@tanstack/react-query` `4.42.0`. Do not introduce v11-only APIs or a new
  adapter migration in this pass.

Hard constraints:

- Do not start S06 GraphQL cleanup.
- Do not start new migration slices unless needed to fix a UX bug in an already
  migrated workflow.
- Keep `/api/graphql`, `/api/trpc`, Apollo, tRPC, and package-level GraphQL/tRPC
  tests working in parallel.
- Use the current docs before changing tRPC/TanStack Query patterns.
- Prefer small, reversible fixes over new abstractions.
- Update the primary plan `Progress` section with scope, evidence, and remaining
  UX risks.
- Commit and push focused fixes to PR #5132 when verified.

Execution loop:

1. Refresh branch and PR state.
2. Map migrated tRPC consumers in PWA, manage, control, and shared client code.
3. Audit loading/error/cache/invalidation/optimistic behavior.
4. Implement only clear, high-confidence fixes.
5. Run focused package/app checks and targeted tests.
6. Record evidence and residual risks in the plan.
7. Commit and push the slice.
8. Monitor PR checks and reviews after push.

Stop when:

- A change would require a new API migration slice.
- A change would remove or disable GraphQL.
- Local verification is blocked by infrastructure and code-only evidence would be
  misleading.
- PR CI/review requires triage before more UX work is useful.
