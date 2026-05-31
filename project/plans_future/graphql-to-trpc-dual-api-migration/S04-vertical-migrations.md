# S04 Vertical Migrations

## Goal

Migrate GraphQL operations to tRPC by user workflow, not by file extension or generated artifact. Each vertical should add narrowly scoped procedures, DTOs, and client hook replacements while leaving unrelated Apollo screens untouched.

## Dependencies

- S01 complete.
- S02 complete.
- S03 complete for the target frontend app.

## Candidate Vertical Order

Start with low-risk read-heavy workflows before mutations and realtime:

1. Control app status/readiness reads.
2. PWA participant profile/account reads.
3. Manage catalog object browser reads.
4. Course/session detail reads.
5. Isolated mutations with simple invalidation.
6. Cross-screen workflows.
7. Realtime/live quiz workflows after S05 backend bridge exists.

The exact order should be adjusted after S00 audit results.

## Write Scope Per Vertical

- `packages/api/src/trpc/routers/<domain>.ts`
- `packages/api/src/trpc/dto/<domain>.ts`
- Optional `packages/api/src/trpc/schemas/<domain>.ts`
- Existing service modules only when a GraphQL resolver contains logic that should be extracted for reuse
- One frontend workflow at a time
- Shared components only when needed by that workflow

## Avoid Scope

- Do not migrate unrelated screens in the same slice.
- Do not return broad Prisma models to the browser.
- Do not delete the GraphQL operation until all consumers of that operation are gone.
- Do not replace a shared component's props with strict tRPC DTO types if Apollo-backed pages still use it.

## Operation Mapping Template

For each vertical, document this before coding:

```text
GraphQL operation:
GraphQL resolver:
Service/helper behavior source:
tRPC router.procedure:
Input schema:
Output DTO:
Active frontend consumers:
Apollo cache/refetch behavior:
React Query invalidation replacement:
Browser verification path:
```

## Implementation Checklist Per Vertical

1. Add/extend a package-level test for the tRPC procedure or DTO mapper where the behavior is isolated enough to test cheaply.
2. Add Zod input schema.
3. Reuse existing GraphQL service/domain logic.
4. Return a deliberate DTO.
5. Wire the frontend hook with `enabled` guards for router/query params.
6. Replace Apollo refetch/cache writes with React Query invalidation.
7. Keep generated GraphQL type replacements narrow.
8. Run focused typechecks.
9. Verify the migrated page in a browser when the local environment is available.
10. Audit for leftover consumers before removing the specific GraphQL operation.

## Acceptance Criteria Per Vertical

- Migrated workflow is behaviorally equivalent.
- Unmigrated GraphQL workflows still work.
- No server-only imports reach browser bundles.
- Query invalidation replaces previous Apollo cache behavior.
- Browser verification evidence exists for user-facing changes.

## Verification

```bash
pnpm --filter @klicker-uzh/api test
pnpm --filter @klicker-uzh/api check
pnpm --filter <target-app> check
pnpm --filter <target-app> build
rg -n "<GraphQLDocumentName>|<GeneratedTypeName>" apps packages
rg -n "@apollo/client|@trpc|/api/graphql|/api/trpc" <target-files>
```

For UI workflows:

```bash
npx agent-browser open <local-url>
npx agent-browser screenshot /tmp/<workflow>-before.png --full
npx agent-browser screenshot /tmp/<workflow>-after.png --full
```

## Agent Prompt

Choose exactly one vertical from this file and implement it end to end. Start by filling the operation mapping template in the plan, then add the tRPC procedure/DTO, migrate only the target workflow, verify it, and audit that all unrelated GraphQL consumers remain intact.
