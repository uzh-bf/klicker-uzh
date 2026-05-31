# S01 API Package Kernel

## Goal

Create `packages/api` as the new tRPC API package while leaving `packages/graphql` untouched. The first router should be intentionally small: a root router with a `system.health` query that proves type generation, build, and backend mounting work.

## Dependencies

- S00 complete.

## Write Scope

- `packages/api/**`
- `apps/backend-docker/package.json` for direct dependency wiring if backend imports tRPC helpers
- `turbo.json` only if dev task ordering needs the new package built
- `pnpm-lock.yaml`

## Avoid Scope

- Do not edit GraphQL schema/resolver behavior.
- Do not move GraphQL services yet.
- Do not introduce frontend tRPC clients yet.
- Do not remove Apollo or codegen.

## Package Shape

`packages/api` should contain:

```text
packages/api/
  package.json
  rollup.config.js
  tsconfig.json
  src/
    index.ts
    trpc/
      context.ts
      init.ts
      root.ts
      routers/
        system.ts
      __tests__/
        system.test.ts
```

## Dependencies

Use pinned versions matching the current repo constraints:

- `@trpc/server`
- `superjson`
- `zod`
- workspace dependencies only when needed for context or DTOs

Do not add React Query or client dependencies until S03.

## Implementation Checklist

1. Add a failing Vitest test for `system.health` through `appRouter.createCaller`.
2. Add `TRPCContext` with the backend dependencies needed by future procedures. Use types where cheap and `unknown` for transport-specific objects that would pull unnecessary runtime dependencies.
3. Initialize tRPC once with SuperJSON:
   - `router`
   - `publicProcedure`
   - `createCallerFactory`
4. Create `systemRouter.health`.
5. Create `appRouter`.
6. Export:
   - `appRouter`
   - `createCallerFactory`
   - `type AppRouter`
   - `type RouterInputs`
   - `type RouterOutputs`
   - context/procedure helper types needed by backend/domain routers
7. Build and typecheck the package.

## Acceptance Criteria

- `@klicker-uzh/api` builds independently.
- The test proves the root router is callable.
- The package exports client-safe router types.
- No GraphQL files are deleted or modified.

## Verification

```bash
pnpm --filter @klicker-uzh/api test
pnpm --filter @klicker-uzh/api check
pnpm --filter @klicker-uzh/api build
rg -n "@klicker-uzh/api|@trpc/server|superjson" packages/api apps/backend-docker package.json pnpm-lock.yaml
rg -n "/api/graphql|graphql-yoga|@klicker-uzh/graphql" apps/backend-docker packages/graphql
```

## Agent Prompt

Implement S01 from this file. Keep GraphQL untouched. Write the failing `system.health` router test first, implement the smallest tRPC kernel that passes it, then run the focused package checks and report whether GraphQL remains present.
