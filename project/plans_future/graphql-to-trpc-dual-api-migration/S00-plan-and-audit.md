# S00 Plan and Audit

## Goal

Create and maintain the source-of-truth map for the migration. This slice is complete when the plan exists, the high-risk dependencies are known, and later agents have clear rules that prevent premature GraphQL removal.

## Dependencies

None.

## Write Scope

- `project/plans_future/graphql-to-trpc-dual-api-migration/**`
- Optional concise learnings in `AGENTS.md` when a durable project pattern is discovered

## Avoid Scope

- No source-code behavior changes.
- No dependency changes.
- No GraphQL deletion.

## Inputs to Inspect

- `packages/graphql/src/graphql/ops/*.graphql`
- `packages/graphql/src/schema/**`
- `packages/graphql/src/services/**`
- `packages/graphql/src/lib/context.ts`
- `apps/backend-docker/src/app.ts`
- `apps/backend-docker/src/index.ts`
- `apps/frontend-manage/**`
- `apps/frontend-pwa/**`
- `apps/frontend-control/**`
- `packages/shared-components/**`
- `turbo.json`
- `package.json`
- `pnpm-lock.yaml`

## Audit Commands

```bash
rg -n "@apollo/client|graphql-yoga|graphql-ws|graphql-codegen|/api/graphql|@klicker-uzh/graphql" apps packages package.json pnpm-lock.yaml
rg -n "useQuery|useMutation|useSubscription|DocumentNode|TypedDocumentNode" apps packages
rg --files packages/graphql/src/graphql/ops
rg -n "Subscription|subscribe|pubSub|createPubSub|useServer" apps packages
```

## Acceptance Criteria

- The dual-stack migration plan is committed before implementation.
- The plan states that GraphQL remains live until S06 cleanup gates pass.
- Later slices have explicit write scope, avoid scope, verification commands, and handoff prompts.

## Handoff Notes

Keep this document updated when new migration-critical facts are discovered, especially generated GraphQL type leaks in shared helpers or subscription paths that need a bridge.
