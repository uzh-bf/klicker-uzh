# S03 Client Provider Shells

## Goal

Add opt-in tRPC client helpers and providers beside Apollo in frontend apps. This slice should not migrate screens yet; it only makes future vertical migrations possible.

## Dependencies

- S01 complete.
- S02 complete.

## Write Scope

- App-level provider/client helper files in:
  - `apps/frontend-manage`
  - `apps/frontend-pwa`
  - `apps/frontend-control`
- App `package.json` files for pinned `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, and `superjson`
- `pnpm-lock.yaml`

## Avoid Scope

- Do not remove Apollo providers.
- Do not rewrite screens yet.
- Do not import `appRouter` runtime into browser code. Import `type AppRouter` only.

## Implementation Checklist

1. Inspect each app's current Apollo provider placement.
2. Add a local tRPC helper that imports `type AppRouter` from `@klicker-uzh/api`.
3. Configure SuperJSON on all terminating tRPC links.
4. Use the backend `/api/trpc` path and existing origin/cookie behavior.
5. Add QueryClient provider without disrupting existing Apollo provider order.
6. Keep provider shells tiny and app-local until the first vertical proves common abstractions are worth extracting.

## Acceptance Criteria

- Each touched app typechecks.
- Apollo imports/providers still exist.
- No page behavior changes are intended.

## Progress

### 2026-06-02 Done

- Added app-local tRPC helpers and `TrpcProvider` wrappers in `apps/frontend-control`, `apps/frontend-manage`, and `apps/frontend-pwa`.
- Kept Apollo providers mounted in all three apps.
- Added pinned client dependencies: `@trpc/client@10.45.2`, `@trpc/react-query@10.45.2`, `@tanstack/react-query@4.42.0`, `superjson@2.2.6`.
- tRPC client URL derives from the existing GraphQL API URL and rewrites `/api/graphql` to `/api/trpc`.
- PWA helper forwards the participant bearer token from `sessionStorage`; manage/control helpers preserve cookie credentials.

Evidence:

- `pnpm --filter @klicker-uzh/frontend-control check` passed.
- `pnpm --filter @klicker-uzh/frontend-manage check` passed.
- `pnpm --filter @klicker-uzh/frontend-pwa check` passed.
- Apollo coexistence audit still finds `@apollo/client` and `ApolloProvider`.
- tRPC audit finds `@trpc`, `createTRPCReact`, `TrpcProvider`, and `/api/trpc`.
- Browser smoke not run: local Klicker backend/control frontend were not listening on `localhost:3000` or `localhost:3003`; full dev stack was not started implicitly.

## Verification

```bash
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-pwa check
pnpm --filter @klicker-uzh/frontend-control check
rg -n "@apollo/client|ApolloProvider" apps/frontend-manage apps/frontend-pwa apps/frontend-control
rg -n "@trpc|createTRPC|/api/trpc|type AppRouter" apps/frontend-manage apps/frontend-pwa apps/frontend-control
```

## Agent Prompt

Implement S03 from this file. Add tRPC providers beside Apollo and keep all existing Apollo providers in place. Use type-only router imports in browser code and verify provider coexistence with source audits and app typechecks.
