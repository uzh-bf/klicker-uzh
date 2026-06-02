# Goal Prompt: End-to-End tRPC Migration

You are working in the KlickerUZH repository on branch `codex/trpc-dual-api-migration`.

Primary plan:

`project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`

Supporting slice files:

- `project/plans_future/graphql-to-trpc-dual-api-migration/README.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S00-plan-and-audit.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S01-api-package-kernel.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S02-backend-dual-mount.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S03-client-provider-shells.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S04-vertical-migrations.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S05-realtime-migration.md`
- `project/plans_future/graphql-to-trpc-dual-api-migration/S06-final-cleanup.md`

Objective:

Migrate KlickerUZH from GraphQL/Apollo/generated operations to tRPC end to end, with GraphQL and tRPC running in parallel until all active consumers are migrated, runtime-verified, and cleanup gates pass.

Current status:

- tRPC foundation exists in `packages/api`.
- Backend mounts `/api/trpc`.
- Frontend tRPC providers exist beside Apollo in manage, pwa, and control.
- Frontend-control has a first read-only pilot.
- GraphQL must remain live until the final cleanup slices.

Hard constraints:

- Do not delete `packages/graphql`, `/api/graphql`, Apollo providers, generated GraphQL operations, GraphQL subscriptions, GraphQL codegen, or GraphQL dependencies before the S06 cleanup gates in `FULL_IMPLEMENTATION_PLAN.md`.
- Add new API behavior in `packages/api`.
- Use existing GraphQL services/resolvers as behavior source. Extract shared service logic only when needed to remove transport coupling.
- Use Zod inputs, SuperJSON serialization, narrow DTO outputs, and type-only router imports in browser code.
- Do not import server runtime modules into browser bundles.
- Migrate one workflow slice at a time.
- Update the `Progress` section of `FULL_IMPLEMENTATION_PLAN.md` before and after every slice.
- Run focused verification for every slice.
- Run GraphQL coexistence audits before S06 and cleanup audits during S06.
- For UI-facing slices, verify with `npx agent-browser` screenshots against a real local Klicker dev stack. If the local stack is unavailable, record that gap in `Progress` and do not claim runtime completion.
- After every slice, review the diff for correctness and scope, simplify incidental complexity, then commit with a conventional commit message.
- Keep lockfiles in sync with package manifest changes.

Execution loop:

1. Read `FULL_IMPLEMENTATION_PLAN.md` and identify the first incomplete slice.
2. Update `Progress` with the active slice and intended write scope.
3. Fill the operation mapping template for the slice.
4. Inspect the listed GraphQL operations, resolvers, services, and active frontend consumers.
5. Implement the smallest complete migration for that one workflow.
6. Add or update API tests where behavior can be isolated cheaply.
7. Run the slice checks. Always rebuild `@klicker-uzh/api` before app-local checks after API router changes.
8. Run coexistence audit unless this is an S06 cleanup slice.
9. Browser-verify UI changes when the local stack is available.
10. Update `Progress` with commands, results, screenshots, skipped runtime gates, and next step.
11. Commit only that slice.
12. Continue to the next slice.

Finish requirements:

- Complete all S04 workflow migrations.
- Complete S05 realtime migration with GraphQL subscriptions still active until app subscribers are gone.
- Run S06 only after cleanup audits prove no active GraphQL consumers remain and the user has approved final removal.
- Run final security review before branch finalization.
- Use `$mr-description-writer` for the MR/PR body, checking the whole branch against `v3`.
- Include a concise `Next Steps` section when the branch is ready or if blocked.

Stop conditions:

- Stop before S06 if any active GraphQL consumer remains.
- Stop and report if runtime behavior cannot be verified because local infrastructure is unavailable.
- Stop and ask if an external/public GraphQL compatibility requirement is discovered.
