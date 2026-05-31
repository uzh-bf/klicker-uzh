# Goal Prompt

Migrate KlickerUZH from GraphQL/Apollo to tRPC incrementally using the dual-api plan in `project/plans_future/graphql-to-trpc-dual-api-migration/`.

Work through the slices in order:

1. `S00-plan-and-audit.md`
2. `S01-api-package-kernel.md`
3. `S02-backend-dual-mount.md`
4. `S03-client-provider-shells.md`
5. `S04-vertical-migrations.md`
6. `S05-realtime-migration.md`
7. `S06-final-cleanup.md`

Hard constraints:

- Keep GraphQL running in parallel until S06 cleanup gates pass.
- Do not delete `packages/graphql`, `/api/graphql`, Apollo providers, generated GraphQL operations, GraphQL subscriptions, GraphQL codegen, or GraphQL dependencies before S06.
- Add the new API in `packages/api` and mount it at `/api/trpc`.
- Use existing services/resolver behavior as the behavior source; do not rewrite business logic while changing transport.
- Use Zod inputs, SuperJSON serialization, DTO outputs, and type-only router imports in browser code.
- Migrate one frontend workflow at a time and verify it end to end before moving on.
- For every UI-facing slice, run the app locally and verify the migrated workflow with `npx agent-browser` screenshots.
- After each slice, run the focused verification commands in that slice file and commit the result before starting the next slice.

For the current slice:

1. Read the slice file completely.
2. Inspect the listed inputs.
3. Fill in any operation mapping required by the slice.
4. Implement the smallest complete change that satisfies the slice acceptance criteria.
5. Run the slice verification commands.
6. Run the GraphQL coexistence audit to confirm the old API is still present unless this is S06.
7. Commit with a conventional commit message.
8. Update this plan if you discover a durable migration constraint.

Stop before S06 if any audit still shows active GraphQL consumers. S06 may proceed only when all previous slices are complete, all active consumers are migrated, and the final cleanup audits are clean or intentionally documented.
