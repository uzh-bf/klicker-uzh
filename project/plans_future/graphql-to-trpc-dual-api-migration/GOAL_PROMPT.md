# Goal Prompt: Finish the KlickerUZH GraphQL to tRPC Migration

You are working in the KlickerUZH repository.

Worktree:

`/Volumes/HOME/Git/klicker/klicker-uzh/.claude/worktrees/trpc-dual-api`

Branch:

`codex/trpc-dual-api-migration`

Target branch:

`v3`

Primary plan:

`project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Supporting files:

- `project/plans_future/graphql-to-trpc-dual-api-migration/README.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S00-plan-and-audit.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S01-api-package-kernel.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S02-backend-dual-mount.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S03-client-provider-shells.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S04-vertical-migrations.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S05-realtime-migration.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S06-final-cleanup.md`

Objective:

Migrate KlickerUZH from GraphQL/Apollo/generated operations to tRPC end to end. Keep GraphQL and tRPC running in parallel until all active consumers are migrated, runtime-verified, and cleanup gates pass. Continue slice by slice until final verification works without GraphQL, or until a stop condition in the plan requires user input.

Current status:

- `packages/api` tRPC foundation exists.
- Backend mounts `/api/trpc` beside `/api/graphql`.
- tRPC providers exist beside Apollo in PWA and manage.
- Frontend-control has completed its migration and Apollo cleanup.
- PWA and manage still use Apollo/generated GraphQL operations.
- GraphQL subscriptions are still active.
- The next slice is S04E1: PWA participant identity and low-risk course reads.

Hard constraints:

- Do not delete `packages/graphql`, `/api/graphql`, GraphQL WS, Apollo, generated GraphQL operations, GraphQL codegen, or GraphQL dependencies before S06 cleanup gates pass.
- Do not start S06 until all active Apollo/GraphQL/generated operation/subscription consumers are gone and the user has explicitly approved final GraphQL removal.
- Add new API behavior in `packages/api`.
- Use existing GraphQL resolvers/services as behavior sources. Extract transport-neutral services only when needed to remove GraphQL coupling.
- Use Zod inputs, SuperJSON serialization, narrow DTO outputs, and type-only router imports in browser code.
- Do not import server runtime modules into browser bundles.
- Do not add runtime imports from `@klicker-uzh/graphql` to `packages/api`.
- Preserve auth, permission, cookie, LTI, assessment, realtime, and cache invalidation semantics.
- Use the repo-pinned command form: `volta run --node 20.19.4 --pnpm 10.15.0 pnpm ...`.
- Keep lockfiles in sync with package manifest changes.

Execution loop:

1. Read `FULL_IMPLEMENTATION_PLAN.md`.
2. Check `git status --short --branch`.
3. Identify the first incomplete slice from `Progress` and `Next Steps`.
4. If uncommitted work belongs to the active slice, inspect it and continue. If unrelated, leave it alone.
5. Update `Progress` before coding with active slice, write scope, operation mapping, verification plan, and cleanup gates.
6. Inspect the relevant GraphQL documents, generated operation types, resolvers, services/helpers, permissions, side effects, and active frontend consumers.
7. Implement the smallest complete migration for one user workflow.
8. Add focused API tests where behavior can be isolated cheaply.
9. Run focused checks. After API router changes, run `@klicker-uzh/api build` before app-local checks.
10. Run coexistence audits during S04/S05. Run cleanup audits during S06.
11. Browser-verify UI-facing slices with `npx agent-browser` screenshots against a real local Klicker stack. If local data or infrastructure blocks a state, record the exact gap in `Progress` and do not claim visual verification.
12. Run a review subagent for correctness, behavior, scope, and test gaps when available. If subagents are unavailable, do an explicit self-review and record that limitation.
13. Run a separate simplification subagent when available. If unavailable, do an explicit simplification pass and record that limitation.
14. Integrate accepted findings, rerun affected checks, and update `Progress` with evidence and next step.
15. Commit only the slice files with a conventional commit message.
16. Continue to the next slice.

First slice to implement:

S04E1 PWA participant identity and low-risk course reads.

Initial operation mapping:

```text
Slice: S04E1 PWA participant identity and low-risk course reads
GraphQL operation(s): SelfDocument, GetParticipantCoursesDocument, GetPracticeCoursesDocument
GraphQL resolver(s): self, participantCourses, getPracticeCourses
Behavior source: ParticipantService.getSelf, CourseService.getParticipantCourses, ParticipantService.getPracticeCourses
tRPC router.procedure: participant.self, participant.courses, participant.practiceCourses
Input schema: optional liveQuizId for self
Output DTO: self participant DTO, course list DTO, practice course DTO
Active frontend consumers: Layout, bookmarks page, practice landing page, index locale redirect if kept small
Apollo cache/refetch/subscription behavior: read-only hooks; keep PWA Apollo mounted for unmigrated flows
React Query replacement: tRPC useQuery with enabled guards and normal query invalidation
Browser verification path: participant login, course list/bookmarks/practice pages
Cleanup blocked until: all PWA reads, mutations, realtime, and app Apollo gates complete
```

Expected slice order after S04E1:

- S04F PWA home, participations, and course landing reads.
- S04G PWA auth, join, account, and push mutations.
- S04H PWA practice quiz, microlearning, and non-realtime activity flows.
- S04I PWA group activity non-realtime.
- S04J manage shell/settings/course/dashboard reads.
- S04K manage resource/sharing/catalog/group/collection reads.
- S04L manage course and activity authoring mutations.
- S04M manage element/tag/answer collection editing.
- S04N manage analytics/evaluation/grading/reporting.
- S04O secondary consumers, scripts, and Cypress.
- S04P generated type leak cleanup.
- S04Q API no-GraphQL runtime dependency gate.
- S05 realtime bridge, tRPC subscription transport, and app realtime migrations.
- S05 app-side GraphQL WS and Apollo removal gates.
- S06 final GraphQL cleanup only after explicit approval.
- S07 MR/PR finish.

Final cleanup requirements:

- Complete all S04 workflow migrations.
- Complete all S05 realtime migrations with GraphQL subscriptions kept active until app subscribers are gone.
- Complete S04Q so `packages/api` has no runtime dependency on `@klicker-uzh/graphql`.
- Do not start S06 until all cleanup audits are clean or every remaining hit is documented as intentionally retained, and the user has explicitly approved final GraphQL removal.
- During S06, remove backend GraphQL runtime, `packages/graphql`, codegen, generated/persisted artifacts, GraphQL dependencies, docs/deploy residue, and lockfile residue in separate reviewable commits.
- Run final checks:
  - `volta run --node 20.19.4 --pnpm 10.15.0 pnpm install --frozen-lockfile`
  - `volta run --node 20.19.4 --pnpm 10.15.0 pnpm run check:all`
  - `volta run --node 20.19.4 --pnpm 10.15.0 pnpm run build`
  - `volta run --node 20.19.4 --pnpm 10.15.0 pnpm run test:run`
- Browser-verify main manage, PWA, control, and realtime flows.
- Run final security review and handle or explicitly defer findings.
- Use `$mr-description-writer` for the MR/PR body, checking the whole branch against `v3`.
- Include a concise `Next Steps` section when ready or blocked.

Stop conditions:

- Stop before S06 if any active GraphQL/Apollo/generated operation consumer remains.
- Stop before S06 if any GraphQL subscription consumer remains.
- Stop before S06 if external/public GraphQL compatibility is required.
- Stop before S06 if the user has not explicitly approved final GraphQL removal.
- Stop within a slice if behavior would require guessing about auth, cookie, LTI, assessment, or realtime semantics.
- Stop and report if required runtime verification cannot be completed because local infrastructure or seeded data is unavailable and code-only verification would be misleading.

Expected outcome:

The branch ends with a fully verified tRPC implementation, no active GraphQL runtime/dependencies, clean cleanup audits, updated project progress, final security review, and an MR/PR-ready summary covering the whole branch.
