# S02 Backend Dual Mount

## Goal

Mount the tRPC router at `/api/trpc` in `apps/backend-docker` while keeping `/api/graphql` and the GraphQL WebSocket server unchanged.

## Dependencies

- S01 complete.

## Write Scope

- `apps/backend-docker/src/app.ts`
- `apps/backend-docker/package.json`
- `turbo.json` if dev build ordering needs `@klicker-uzh/api#build`
- `pnpm-lock.yaml`

## Avoid Scope

- Do not change `/api/graphql`.
- Do not change GraphQL persisted operations.
- Do not change GraphQL WS setup in `apps/backend-docker/src/index.ts` unless a context type export requires it.
- Do not migrate any frontend call yet.

## Implementation Checklist

1. Import `appRouter` and `type TRPCContext` from `@klicker-uzh/api`.
2. Import `createExpressMiddleware` from `@trpc/server/adapters/express`.
3. Create a context factory that maps existing backend dependencies into `TRPCContext`.
4. Register `app.use('/api/trpc', createExpressMiddleware(...))` after auth middleware and before/near the GraphQL mount.
5. Keep `app.use('/api/graphql', yogaApp as any)` intact.
6. Update logs only if useful; do not rename GraphQL logs in a way that suggests it is gone.

## Acceptance Criteria

- Backend typecheck passes.
- Source audit shows both `/api/trpc` and `/api/graphql`.
- Existing GraphQL imports from `@klicker-uzh/graphql` remain in backend.

## Verification

```bash
pnpm --filter @klicker-uzh/backend-docker check
pnpm --filter @klicker-uzh/backend-docker build
rg -n "/api/trpc|createExpressMiddleware|@klicker-uzh/api" apps/backend-docker packages/api
rg -n "/api/graphql|graphql-yoga|graphql-ws|@klicker-uzh/graphql" apps/backend-docker packages/graphql
```

Optional local smoke when the backend is running:

```bash
curl -sS http://localhost:3000/api/trpc/system.health
curl -sS http://localhost:3000/healthz
```

## Agent Prompt

Implement S02 from this file. Preserve the GraphQL Yoga mount and GraphQL WS path exactly. Add the tRPC Express middleware with the same authenticated request context source, then verify that both endpoint strings are present in the backend source.
