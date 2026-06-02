# Goal Prompt: Work Through the tRPC Migration Plan to End-to-End Verification

You are working in the KlickerUZH repository on branch `codex/trpc-dual-api-migration`.

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

Migrate KlickerUZH from GraphQL/Apollo/generated operations to tRPC end to end, with GraphQL and tRPC running in parallel until all active consumers are migrated, runtime-verified, and cleanup gates pass. Continue slice by slice until final end-to-end verification without GraphQL works, or until a stop condition in the plan is reached.

Current status:

- `packages/api` tRPC foundation exists.
- Backend mounts `/api/trpc` beside `/api/graphql`.
- Frontend tRPC providers exist beside Apollo in manage, PWA, and control.
- S04A control read pilot is committed and runtime-verified.
- S04B control read migration may have uncommitted work. Check `git status` first and continue it without overwriting.
- GraphQL must remain live until S06 cleanup readiness is clean and explicitly approved.

Hard constraints:

- Do not delete `packages/graphql`, `/api/graphql`, Apollo providers, generated GraphQL operations, GraphQL subscriptions, GraphQL codegen, or GraphQL dependencies before S06 cleanup gates pass.
- Add new API behavior in `packages/api`.
- Use existing GraphQL services/resolvers as behavior source. Extract shared service logic only when needed to remove transport coupling.
- Use Zod inputs, SuperJSON serialization, narrow DTO outputs, and type-only router imports in browser code.
- Do not import server runtime modules into browser bundles.
- Migrate one user workflow slice at a time.
- Preserve unrelated user changes in the worktree.
- Keep lockfiles in sync with package manifest changes.
- Use the repo-pinned command form: `volta run --node 20.19.4 --pnpm 10.15.0 pnpm ...`.

Execution loop:

1. Read `FULL_IMPLEMENTATION_PLAN.md`.
2. Check `git status --short --branch` and identify the first incomplete slice from `Progress`.
3. If uncommitted work belongs to the active slice, inspect it and continue. If unrelated, leave it alone.
4. Update `Progress` with active slice, write scope, and operation mapping before coding.
5. Inspect the relevant GraphQL operations, resolvers, services, and active frontend consumers.
6. Implement the smallest complete migration for that one workflow.
7. Add or update focused API tests where behavior can be isolated cheaply.
8. Run focused checks. After API router changes, always run `@klicker-uzh/api build` before app-local checks.
9. Run coexistence audits during S04/S05. Run cleanup audits during S06.
10. Browser-verify UI-facing slices with `npx agent-browser` screenshots against a real local Klicker stack. If local data or infrastructure blocks a state, record the exact gap in `Progress`.
11. Run a review subagent for correctness, behavior, scope, and test gaps.
12. Run a separate simplification subagent for unnecessary complexity, dead code, and noisy churn.
13. Integrate accepted findings, rerun affected checks, and update `Progress` with evidence and next step.
14. Commit only the slice's files with a conventional commit message.
15. Continue to the next slice.

Final cleanup requirements:

- Complete all S04 app/workflow migrations.
- Complete all S05 realtime migrations with GraphQL subscriptions kept active until app subscribers are gone.
- Do not start S06 until all cleanup audits are clean or every remaining hit is documented as intentionally retained, and the user has approved final GraphQL removal.
- During S06, remove backend GraphQL runtime, `packages/graphql`, codegen, generated/persisted artifacts, GraphQL dependencies, docs/deploy residue, and lockfile residue in separate reviewable commits.
- Run full final checks:
  - `pnpm install --frozen-lockfile`
  - `pnpm run check:all`
  - `pnpm run build`
  - `pnpm run test:run`
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
- Stop and report if required runtime verification cannot be completed because local infrastructure or seeded data is unavailable.

Expected outcome:

The branch ends with a fully verified tRPC implementation, no active GraphQL runtime/dependencies, clean cleanup audits, updated project progress, final security review, and an MR/PR-ready summary covering the whole branch.
